import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { asyncHandler, fail, ok } from "../http.js";
import { mockRechargeProvider } from "../providers/rechargeProvider.js";

const rechargeSchema = z.object({
  walletAddress: z.string().min(10).optional(),
  country: z.string().min(2),
  operator: z.string().min(1),
  mobile: z.string().min(4),
  amount: z.number().positive(),
  asset: z.enum(["BNB", "USDT"])
});

export const rechargeRouter = Router();

rechargeRouter.post("/recharge/quote", asyncHandler(async (req, res) => {
  const parsed = rechargeSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid recharge quote request");
    return;
  }
  const quote = await mockRechargeProvider.quote(parsed.data);
  ok(res, quote, "Recharge quote created");
}));

rechargeRouter.post("/recharge/create", asyncHandler(async (req, res) => {
  const parsed = rechargeSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid recharge create request");
    return;
  }
  const provider = await mockRechargeProvider.create(parsed.data);
  const rows = await query(
    `insert into recharge_orders (wallet_address, country, operator, mobile, amount, asset, provider, provider_reference, status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     returning *`,
    [
      parsed.data.walletAddress || null,
      parsed.data.country,
      parsed.data.operator,
      parsed.data.mobile,
      parsed.data.amount,
      parsed.data.asset,
      "mock",
      provider.providerReference,
      provider.status
    ]
  );
  const order = rows[0] || { ...parsed.data, ...provider };
  await query(
    `insert into audit_logs (actor_wallet_address, action, entity_type, entity_id, metadata)
     values ($1,'recharge.create','recharge_order', null, $2::jsonb)`,
    [parsed.data.walletAddress || null, JSON.stringify({ provider: "mock", mobile: parsed.data.mobile, amount: parsed.data.amount })]
  );
  ok(res, order, "Recharge order created", 201);
}));

rechargeRouter.get("/recharge/history", asyncHandler(async (req, res) => {
  const walletAddress = typeof req.query.walletAddress === "string" ? req.query.walletAddress : "";
  const rows = await query(
    `select * from recharge_orders
     where ($1::text = '' or wallet_address = $1)
     order by created_at desc
     limit 100`,
    [walletAddress]
  );
  ok(res, { items: rows }, "Recharge history loaded");
}));
