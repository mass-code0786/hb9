import { Router } from "express";
import crypto from "node:crypto";
import type { Request } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { query } from "../db/pool.js";
import { asyncHandler, fail, ok } from "../http.js";
import { getRechargeProvider } from "../providers/recharge/factory.js";
import { VerificationError, verifyBlockchainTransaction, type BlockchainVerification } from "../services/blockchainVerifier.js";
import type { RechargeOrder, RechargeQuote } from "../providers/recharge/types.js";

const phoneRegex = /^\+?\d{6,18}$/;
const txHashRegex = /^(0x)?[a-zA-Z0-9]{12,128}$/;
const quotes = new Map<string, RechargeQuote>();
const memoryOrders = new Map<string, RechargeOrder>();

const quoteSchema = z.object({
  countryCode: z.string().trim().min(2).max(3).transform((value) => value.toUpperCase()),
  operatorId: z.string().trim().min(2).max(80),
  phoneNumber: z.string().trim().transform((value) => value.replace(/[^\d+]/g, "")).pipe(z.string().regex(phoneRegex)),
  productId: z.string().trim().min(2).max(100),
  cryptoSymbol: z.enum(["BNB", "USDT"]),
  network: z.string().trim().min(2).max(32),
  walletAddress: z.string().trim().min(10).max(128).optional()
});

const createSchema = z.object({
  quoteId: z.string().uuid(),
  txHash: z.string().trim().regex(txHashRegex),
  walletAddress: z.string().trim().min(10).max(128).optional()
});

const webhookSchema = z.object({
  providerOrderId: z.string().trim().min(3).max(128),
  status: z.enum(["success", "failed"]),
  failureReason: z.string().trim().max(500).optional()
});

export const rechargeRouter = Router();

async function audit(walletAddress: string | null, action: string, entityId: string | null, metadata: Record<string, unknown>) {
  await query(
    `insert into audit_logs (actor_wallet_address, action, entity_type, entity_id, metadata)
     values ($1,$2,'recharge_order',$3,$4::jsonb)`,
    [walletAddress, action, entityId, JSON.stringify(metadata)]
  );
}

async function persistQuote(quote: RechargeQuote, walletAddress?: string) {
  await query(
    `insert into recharge_quotes
      (id, user_wallet_address, country_code, operator_id, operator_name, phone_number, local_currency, local_amount, usd_amount, fx_rate, platform_fee, crypto_symbol, crypto_amount, network, expires_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     on conflict (id) do nothing`,
    [
      quote.id,
      walletAddress || null,
      quote.countryCode,
      quote.operatorId,
      quote.operatorName,
      quote.phoneNumber,
      quote.localCurrency,
      quote.localAmount,
      quote.usdAmount,
      quote.fxRate,
      quote.platformFee,
      quote.cryptoSymbol,
      quote.cryptoAmount,
      quote.network,
      quote.expiresAt
    ]
  );
}

async function persistOrder(order: RechargeOrder) {
  await query(
    `insert into recharge_orders
      (id, user_wallet_address, country_code, operator_id, operator_name, phone_number, local_currency, local_amount, crypto_symbol, crypto_amount, network, tx_hash, provider, provider_order_id, status, failure_reason, refund_status, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     on conflict (id) do update set status = excluded.status, failure_reason = excluded.failure_reason, refund_status = excluded.refund_status, updated_at = now()`,
    [
      order.id,
      order.userWalletAddress || null,
      order.countryCode,
      order.operatorId,
      order.operatorName,
      order.phoneNumber,
      order.localCurrency,
      order.localAmount,
      order.cryptoSymbol,
      order.cryptoAmount,
      order.network,
      order.txHash,
      order.provider,
      order.providerOrderId || null,
      order.status,
      order.failureReason || null,
      order.refundStatus || "none",
      order.createdAt,
      order.updatedAt
    ]
  );
}

async function txHashAlreadyUsed(txHash: string) {
  const normalized = txHash.toLowerCase();
  if (Array.from(memoryOrders.values()).some((order) => order.txHash.toLowerCase() === normalized)) return true;
  const rows = await query<{ id: string }>(
    `select id from recharge_orders where lower(tx_hash) = lower($1)
     union all
     select id from payment_orders where lower(tx_hash) = lower($1)
     limit 1`,
    [txHash]
  );
  return Boolean(rows[0]);
}

async function saveRechargeVerification(orderId: string, verification: BlockchainVerification) {
  await query(
    `update recharge_orders
     set chain_id = $2,
         token_symbol = $3,
         token_contract = $4,
         from_address = $5,
         to_address = $6,
         verified_amount = $7,
         confirmations = $8,
         verified_at = $9,
         verification_status = $10,
         verification_error = null,
         updated_at = now()
     where id = $1`,
    [
      orderId,
      verification.chainId,
      verification.tokenSymbol,
      verification.tokenContract,
      verification.fromAddress,
      verification.toAddress,
      verification.verifiedAmount,
      verification.confirmations,
      verification.verifiedAt,
      verification.verificationStatus
    ]
  );
}

function verifyWebhookSignature(req: Request) {
  if (!config.rechargeWebhookSecret) throw new VerificationError("Recharge webhook secret is not configured.");
  const signature = typeof req.headers["x-hb9-signature"] === "string" ? req.headers["x-hb9-signature"] : "";
  const timestamp = typeof req.headers["x-hb9-timestamp"] === "string" ? req.headers["x-hb9-timestamp"] : "";
  if (!signature || !timestamp) throw new VerificationError("Webhook signature headers are required.");
  const timestampMs = Number(timestamp);
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    throw new VerificationError("Webhook timestamp is outside the allowed tolerance.");
  }
  const payload = `${timestamp}.${JSON.stringify(req.body)}`;
  const expected = crypto.createHmac("sha256", config.rechargeWebhookSecret).update(payload).digest("hex");
  const left = Buffer.from(signature.replace(/^sha256=/, ""), "hex");
  const right = Buffer.from(expected, "hex");
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    throw new VerificationError("Webhook signature is invalid.");
  }
}

function mapDbOrder(row: Record<string, unknown>): RechargeOrder {
  return {
    id: String(row.id),
    userWalletAddress: row.user_wallet_address ? String(row.user_wallet_address) : undefined,
    countryCode: String(row.country_code),
    countryName: String(row.country_name || row.country_code),
    operatorId: String(row.operator_id),
    operatorName: String(row.operator_name),
    phoneNumber: String(row.phone_number),
    localCurrency: String(row.local_currency),
    localAmount: Number(row.local_amount),
    cryptoSymbol: row.crypto_symbol === "BNB" ? "BNB" : "USDT",
    cryptoAmount: Number(row.crypto_amount),
    network: String(row.network),
    txHash: String(row.tx_hash),
    provider: row.provider === "reloadly" || row.provider === "dtone" || row.provider === "ding" ? row.provider : "mock",
    providerOrderId: row.provider_order_id ? String(row.provider_order_id) : undefined,
    status: String(row.status) as RechargeOrder["status"],
    failureReason: row.failure_reason ? String(row.failure_reason) : undefined,
    refundStatus: String(row.refund_status || "none") as RechargeOrder["refundStatus"],
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at || row.created_at)).toISOString()
  };
}

rechargeRouter.get("/recharge/countries", asyncHandler(async (_req, res) => {
  const provider = getRechargeProvider();
  ok(res, { items: await provider.listCountries() }, "Recharge countries loaded");
}));

rechargeRouter.get("/recharge/operators", asyncHandler(async (req, res) => {
  const country = typeof req.query.country === "string" ? req.query.country.toUpperCase() : "";
  if (!country) {
    fail(res, "country query parameter is required", 400, "Invalid recharge operators request");
    return;
  }
  ok(res, { items: await getRechargeProvider().listOperators(country) }, "Recharge operators loaded");
}));

rechargeRouter.get("/recharge/products", asyncHandler(async (req, res) => {
  const operatorId = typeof req.query.operatorId === "string" ? req.query.operatorId : "";
  if (!operatorId) {
    fail(res, "operatorId query parameter is required", 400, "Invalid recharge products request");
    return;
  }
  ok(res, { items: await getRechargeProvider().listProducts(operatorId) }, "Recharge products loaded");
}));

rechargeRouter.post("/recharge/quote", asyncHandler(async (req, res) => {
  const parsed = quoteSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid recharge quote request");
    return;
  }
  const quote = await getRechargeProvider().quote(parsed.data);
  quotes.set(quote.id, quote);
  await persistQuote(quote, parsed.data.walletAddress);
  await audit(parsed.data.walletAddress || null, "recharge.quote", null, { quoteId: quote.id, provider: config.rechargeProvider });
  ok(res, quote, "Recharge quote created");
}));

rechargeRouter.post("/recharge/create", asyncHandler(async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid recharge create request");
    return;
  }
  const quote = quotes.get(parsed.data.quoteId);
  if (!quote) {
    fail(res, "Quote expired or not found. Create a new quote.", 404, "Recharge quote unavailable");
    return;
  }
  if (await txHashAlreadyUsed(parsed.data.txHash)) {
    fail(res, "Transaction hash has already been used.", 409, "Duplicate transaction");
    return;
  }

  let verification: BlockchainVerification;
  try {
    verification = await verifyBlockchainTransaction({
      txHash: parsed.data.txHash,
      network: quote.network,
      tokenSymbol: quote.cryptoSymbol,
      requiredAmount: quote.cryptoAmount
    });
  } catch (err) {
    const message = err instanceof VerificationError ? err.publicReason : "Transaction verification failed.";
    await audit(parsed.data.walletAddress || null, "recharge.verification_failed", null, { quoteId: quote.id, txHash: parsed.data.txHash, error: message });
    fail(res, message, err instanceof VerificationError ? err.statusCode : 400, "Recharge transaction verification failed");
    return;
  }

  await audit(parsed.data.walletAddress || null, "recharge.payment_verified", null, { quoteId: quote.id, txHash: parsed.data.txHash, verification });
  const order = await getRechargeProvider().create({ ...parsed.data, quote });
  memoryOrders.set(order.id, order);
  await persistOrder(order);
  await saveRechargeVerification(order.id, verification);
  if (order.status === "refund_pending") {
    await query(
      `insert into recharge_refunds (order_id, tx_hash, crypto_symbol, crypto_amount, status, admin_review_required)
       values ($1,$2,$3,$4,'review_required',true)
       on conflict do nothing`,
      [order.id, order.txHash, order.cryptoSymbol, order.cryptoAmount]
    );
  }
  await audit(parsed.data.walletAddress || null, "recharge.create", order.id, { provider: order.provider, status: order.status, autoRefundEnabled: config.autoRefundEnabled });
  ok(res, order, "Recharge order created", 201);
}));

rechargeRouter.post("/recharge/webhook", asyncHandler(async (req, res) => {
  try {
    verifyWebhookSignature(req);
  } catch (err) {
    const message = err instanceof VerificationError ? err.publicReason : "Webhook signature verification failed.";
    fail(res, message, 401, "Invalid recharge webhook signature");
    return;
  }
  const parsed = webhookSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid recharge webhook request");
    return;
  }
  const nextStatus = parsed.data.status === "success" ? "success" : "refund_pending";
  await query(
    `update recharge_orders
     set status = $1, failure_reason = $2, refund_status = case when $1 = 'refund_pending' then 'review_required' else refund_status end, updated_at = now()
     where provider_order_id = $3`,
    [nextStatus, parsed.data.failureReason || null, parsed.data.providerOrderId]
  );
  await audit(null, "recharge.webhook", null, parsed.data);
  ok(res, { status: nextStatus }, "Recharge webhook accepted");
}));

rechargeRouter.get("/recharge/status/:orderId", asyncHandler(async (req, res) => {
  const orderId = String(req.params.orderId || "");
  const dbRows = await query<Record<string, unknown>>("select * from recharge_orders where id = $1 limit 1", [orderId]);
  const order = dbRows[0] ? mapDbOrder(dbRows[0]) : memoryOrders.get(orderId);
  if (!order) {
    fail(res, "Recharge order not found", 404, "Recharge status unavailable");
    return;
  }
  await audit(order.userWalletAddress || null, "recharge.status", order.id, { status: order.status });
  ok(res, order, "Recharge status loaded");
}));

rechargeRouter.get("/recharge/history", asyncHandler(async (req, res) => {
  const walletAddress = typeof req.query.walletAddress === "string" ? req.query.walletAddress.trim() : "";
  if (!walletAddress) {
    fail(res, "walletAddress query parameter is required", 400, "Invalid recharge history request");
    return;
  }
  const rows = await query<Record<string, unknown>>(
    `select * from recharge_orders
     where user_wallet_address = $1
     order by created_at desc
     limit 100`,
    [walletAddress]
  );
  const items = rows.length > 0 ? rows.map(mapDbOrder) : Array.from(memoryOrders.values()).filter((order) => order.userWalletAddress === walletAddress);
  ok(res, { items }, "Recharge history loaded");
}));
