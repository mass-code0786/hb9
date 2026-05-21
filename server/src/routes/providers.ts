import { Router } from "express";
import { z } from "zod";
import { asyncHandler, ok } from "../http.js";
import { config } from "../config.js";
import { query } from "../db/pool.js";
import { requireAdmin } from "../adminAuth.js";

export const providersRouter = Router();

const providerStatusSchema = z.object({
  provider: z.enum(["mock", "reloadly", "dtone", "ding"]),
  enabled: z.boolean()
});

providersRouter.get("/providers/status", asyncHandler(async (_req, res) => {
  ok(res, {
    recharge: {
      provider: config.rechargeProvider,
      status: "ready",
      secretsExposed: false
    },
    qrPayments: {
      provider: "internal",
      status: "ready",
      secretsExposed: false
    }
  }, "Provider status loaded");
}));

providersRouter.get("/admin/recharge/providers", requireAdmin, asyncHandler(async (_req, res) => {
  ok(res, {
    activeProvider: config.rechargeProvider,
    autoRefundEnabled: config.autoRefundEnabled,
    providers: [
      { provider: "mock", configured: true, enabled: config.rechargeProvider === "mock" },
      { provider: "reloadly", configured: Boolean(config.reloadlyClientId && config.reloadlyClientSecret), enabled: config.rechargeProvider === "reloadly" },
      { provider: "dtone", configured: Boolean(config.dtOneApiKey && config.dtOneApiSecret), enabled: config.rechargeProvider === "dtone" },
      { provider: "ding", configured: Boolean(config.dingApiKey), enabled: config.rechargeProvider === "ding" }
    ]
  }, "Recharge provider settings loaded");
}));

providersRouter.post("/admin/recharge/provider-status", requireAdmin, asyncHandler(async (req, res) => {
  const parsed = providerStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, message: "Invalid provider status request", error: JSON.stringify(parsed.error.flatten()) });
    return;
  }
  await query(
    `insert into api_provider_settings (provider, enabled)
     values ($1,$2)
     on conflict (provider) do update set enabled = excluded.enabled, updated_at = now()`,
    [parsed.data.provider, parsed.data.enabled]
  );
  ok(res, { provider: parsed.data.provider, enabled: parsed.data.enabled, secretsExposed: false }, "Recharge provider status saved");
}));
