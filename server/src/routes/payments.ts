import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
import { asyncHandler, fail, ok } from "../http.js";

const paymentSchema = z.object({
  walletAddress: z.string().min(10).optional(),
  merchantName: z.string().min(1),
  merchantAddress: z.string().min(10),
  category: z.enum(["merchant", "petrol", "personal"]),
  amount: z.number().positive(),
  asset: z.enum(["BNB", "USDT"]),
  qrMode: z.enum(["static", "dynamic"])
});

export const paymentsRouter = Router();

paymentsRouter.post("/payments/create", asyncHandler(async (req, res) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid payment create request");
    return;
  }
  const rows = await query(
    `insert into payment_orders (wallet_address, merchant_name, merchant_address, category, amount, asset, qr_mode, status)
     values ($1,$2,$3,$4,$5,$6,$7,'pending')
     returning *`,
    [
      parsed.data.walletAddress || null,
      parsed.data.merchantName,
      parsed.data.merchantAddress,
      parsed.data.category,
      parsed.data.amount,
      parsed.data.asset,
      parsed.data.qrMode
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
  const walletAddress = typeof req.query.walletAddress === "string" ? req.query.walletAddress : "";
  const rows = await query(
    `select * from payment_orders
     where ($1::text = '' or wallet_address = $1)
     order by created_at desc
     limit 100`,
    [walletAddress]
  );
  ok(res, { items: rows }, "Payment history loaded");
}));
