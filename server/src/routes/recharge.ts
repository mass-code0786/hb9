import { Router } from "express";
import { z } from "zod";
import { query } from "../db/pool.js";
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

rechargeRouter.post("/recharge/quote", async (req, res) => {
  const parsed = rechargeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const quote = await mockRechargeProvider.quote(parsed.data);
  res.json(quote);
});

rechargeRouter.post("/recharge/create", async (req, res) => {
  const parsed = rechargeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
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
  res.status(201).json(rows[0] || { ...parsed.data, ...provider });
});

rechargeRouter.get("/recharge/history", async (req, res) => {
  const walletAddress = typeof req.query.walletAddress === "string" ? req.query.walletAddress : "";
  const rows = await query(
    `select * from recharge_orders
     where ($1::text = '' or wallet_address = $1)
     order by created_at desc
     limit 100`,
    [walletAddress]
  );
  res.json({ items: rows });
});
