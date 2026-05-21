import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { asyncHandler, fail, ok } from "../http.js";
import { VerificationError, verifyBlockchainTransaction, type BlockchainVerification } from "../services/blockchainVerifier.js";

const paymentSchema = z.object({
  walletAddress: z.string().min(10).optional(),
  merchantName: z.string().min(1),
  merchantAddress: z.string().min(10),
  category: z.enum(["merchant", "petrol", "personal"]),
  amount: z.number().positive(),
  asset: z.enum(["BNB", "USDT"]),
  qrMode: z.enum(["static", "dynamic"]),
  txHash: z.string().trim().regex(/^(0x)?[a-zA-Z0-9]{12,128}$/).optional(),
  network: z.string().trim().min(2).max(32).default("bsc")
});

export const paymentsRouter = Router();

async function txHashAlreadyUsed(txHash: string) {
  const rows = await query<{ id: string }>(
    `select id from recharge_orders where lower(tx_hash) = lower($1)
     union all
     select id from payment_orders where lower(tx_hash) = lower($1)
     limit 1`,
    [txHash]
  );
  return Boolean(rows[0]);
}

function verificationValues(verification: BlockchainVerification | null) {
  return [
    verification?.chainId || null,
    verification?.tokenSymbol || null,
    verification?.tokenContract || null,
    verification?.fromAddress || null,
    verification?.toAddress || null,
    verification?.verifiedAmount || null,
    verification?.confirmations || null,
    verification?.verifiedAt || null,
    verification?.verificationStatus || "unverified",
    null
  ];
}

paymentsRouter.post("/payments/create", asyncHandler(async (req, res) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid payment create request");
    return;
  }
  let verification: BlockchainVerification | null = null;
  if (parsed.data.txHash) {
    if (await txHashAlreadyUsed(parsed.data.txHash)) {
      fail(res, "Transaction hash has already been used.", 409, "Duplicate transaction");
      return;
    }
    try {
      verification = await verifyBlockchainTransaction({
        txHash: parsed.data.txHash,
        network: parsed.data.network,
        tokenSymbol: parsed.data.asset,
        requiredAmount: parsed.data.amount,
        expectedRecipient: parsed.data.merchantAddress
      });
    } catch (err) {
      const message = err instanceof VerificationError ? err.publicReason : "Transaction verification failed.";
      fail(res, message, err instanceof VerificationError ? err.statusCode : 400, "Payment transaction verification failed");
      return;
    }
  }
  const verificationColumns = verificationValues(verification);
  const rows = await query(
    `insert into payment_orders
      (wallet_address, merchant_name, merchant_address, category, amount, asset, qr_mode, tx_hash, status,
       chain_id, token_symbol, token_contract, from_address, to_address, verified_amount, confirmations, verified_at, verification_status, verification_error)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     returning *`,
    [
      parsed.data.walletAddress || null,
      parsed.data.merchantName,
      parsed.data.merchantAddress,
      parsed.data.category,
      parsed.data.amount,
      parsed.data.asset,
      parsed.data.qrMode,
      parsed.data.txHash || null,
      verification ? "success" : "pending",
      ...verificationColumns
    ]
  );
  const order = rows[0] || { ...parsed.data, status: "pending" };
  await query(
    `insert into audit_logs (actor_wallet_address, action, entity_type, entity_id, metadata)
     values ($1,'payment.create','payment_order', null, $2::jsonb)`,
    [parsed.data.walletAddress || null, JSON.stringify({ merchantName: parsed.data.merchantName, amount: parsed.data.amount, asset: parsed.data.asset })]
  );
  ok(res, order, "Payment order created", 201);
}));

paymentsRouter.get("/payments/history", asyncHandler(async (req, res) => {
  const walletAddress = typeof req.query.walletAddress === "string" ? req.query.walletAddress.trim() : "";
  if (!walletAddress) {
    fail(res, "walletAddress query parameter is required", 400, "Invalid payment history request");
    return;
  }
  const rows = await query(
    `select * from payment_orders
     where wallet_address = $1
     order by created_at desc
     limit 100`,
    [walletAddress]
  );
  ok(res, { items: rows }, "Payment history loaded");
}));
