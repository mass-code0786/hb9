import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";

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

paymentsRouter.post("/payments/create", async (req, res) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
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
  res.status(201).json(rows[0] || { ...parsed.data, status: "pending" });
});

paymentsRouter.get("/payments/history", async (req, res) => {
  const walletAddress = typeof req.query.walletAddress === "string" ? req.query.walletAddress : "";
  const rows = await query(
    `select * from payment_orders
     where ($1::text = '' or wallet_address = $1)
     order by created_at desc
     limit 100`,
    [walletAddress]
  );
  res.json({ items: rows });
});
