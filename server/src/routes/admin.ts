import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { query } from "../db/pool.js";
import { asyncHandler, fail, ok } from "../http.js";
import { createAdminToken, requireAdmin, verifyAdminPassword } from "../adminAuth.js";

export const adminRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200)
});

const rechargePatchSchema = z.object({
  status: z.enum(["awaiting_payment", "payment_detected", "processing_recharge", "success", "failed", "refund_pending", "refunded"]).optional(),
  refundStatus: z.enum(["none", "review_required", "pending", "refunded", "rejected"]).optional(),
  failureReason: z.string().max(500).optional(),
  adminNote: z.string().max(1000).optional()
});

const paymentPatchSchema = z.object({
  status: z.enum(["pending", "success", "failed"]).optional(),
  adminNote: z.string().max(1000).optional()
});

const activeProviderSchema = z.object({
  provider: z.enum(["mock", "reloadly", "dtone", "ding"])
});

const providerTestSchema = z.object({
  provider: z.enum(["mock", "reloadly", "dtone", "ding"])
});

const feesSchema = z.object({
  rechargePlatformFeePercent: z.number().min(0).max(25),
  fixedFee: z.number().min(0).max(1000),
  minimumFee: z.number().min(0).max(1000),
  qrPayFeePercent: z.number().min(0).max(25),
  refundFee: z.number().min(0).max(1000),
  supportedCryptoSymbols: z.array(z.enum(["BNB", "USDT"])).min(1)
});

async function auditAdmin(email: string, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown>) {
  await query(
    `insert into audit_logs (actor_wallet_address, action, entity_type, entity_id, metadata)
     values ($1,$2,$3,$4,$5::jsonb)`,
    [email, action, entityType, entityId, JSON.stringify(metadata)]
  );
}

function maskPhone(phone: unknown) {
  const value = String(phone || "");
  if (value.length <= 5) return value;
  return `${value.slice(0, 3)}****${value.slice(-2)}`;
}

function maskKey(value: string) {
  if (!value) return "";
  return value.length <= 8 ? "configured" : `${value.slice(0, 4)}...${value.slice(-4)}`;
}

adminRouter.post("/admin/login", asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid admin login");
    return;
  }
  if (parsed.data.email !== config.adminEmail || !verifyAdminPassword(parsed.data.password)) {
    fail(res, "Invalid admin credentials.", 401, "Login failed");
    return;
  }
  const role = "super_admin" as const;
  const token = createAdminToken(parsed.data.email, role);
  await auditAdmin(parsed.data.email, "admin.login", "admin_session", null, { role });
  ok(res, { token, admin: { email: parsed.data.email, role } }, "Admin login successful");
}));

adminRouter.post("/admin/logout", requireAdmin, asyncHandler(async (req, res) => {
  await auditAdmin(req.admin?.email || "admin", "admin.logout", "admin_session", null, {});
  ok(res, { loggedOut: true }, "Admin logged out");
}));

adminRouter.get("/admin/me", requireAdmin, asyncHandler(async (req, res) => {
  ok(res, { admin: req.admin }, "Admin session loaded");
}));

adminRouter.get("/admin/summary", requireAdmin, asyncHandler(async (_req, res) => {
  const recharge = await query<Record<string, unknown>>(
    `select
      count(*)::int as total,
      count(*) filter (where status = 'success')::int as successful,
      count(*) filter (where status = 'failed')::int as failed,
      count(*) filter (where status = 'refund_pending')::int as refund_pending,
      coalesce(sum(crypto_amount),0)::float as volume
     from recharge_orders`
  );
  const payments = await query<Record<string, unknown>>("select count(*)::int as total, coalesce(sum(amount),0)::float as volume from payment_orders");
  const audits = await query("select action, actor_wallet_address, entity_type, entity_id, metadata, created_at from audit_logs order by created_at desc limit 8");
  const r = recharge[0] || { total: 0, successful: 0, failed: 0, refund_pending: 0, volume: 0 };
  const p = payments[0] || { total: 0, volume: 0 };
  ok(res, {
    totalRechargeOrders: Number(r.total || 0),
    successfulRechargeOrders: Number(r.successful || 0),
    failedRechargeOrders: Number(r.failed || 0),
    refundPending: Number(r.refund_pending || 0),
    totalPaymentOrders: Number(p.total || 0),
    totalVolume: Number(r.volume || 0) + Number(p.volume || 0),
    providerStatus: config.rechargeProvider,
    recentAuditLogs: audits
  }, "Admin summary loaded");
}));

adminRouter.get("/admin/recharge-orders", requireAdmin, asyncHandler(async (req, res) => {
  const search = typeof req.query.search === "string" ? `%${req.query.search}%` : "";
  const rows = await query<Record<string, unknown>>(
    `select * from recharge_orders
     where ($1::text = '' or user_wallet_address ilike $1 or operator_name ilike $1 or tx_hash ilike $1)
     order by created_at desc limit 100`,
    [search]
  );
  ok(res, { items: rows.map((row) => ({ ...row, phone_number: maskPhone(row.phone_number) })) }, "Recharge orders loaded");
}));

adminRouter.get("/admin/recharge-orders/:id", requireAdmin, asyncHandler(async (req, res) => {
  const rows = await query("select * from recharge_orders where id = $1 limit 1", [req.params.id]);
  if (!rows[0]) {
    fail(res, "Recharge order not found", 404, "Not found");
    return;
  }
  ok(res, rows[0], "Recharge order loaded");
}));

adminRouter.patch("/admin/recharge-orders/:id", requireAdmin, asyncHandler(async (req, res) => {
  const orderId = String(req.params.id || "");
  const parsed = rechargePatchSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid recharge update");
    return;
  }
  const rows = await query(
    `update recharge_orders
     set status = coalesce($2, status), refund_status = coalesce($3, refund_status), failure_reason = coalesce($4, failure_reason), updated_at = now()
     where id = $1 returning *`,
    [orderId, parsed.data.status || null, parsed.data.refundStatus || null, parsed.data.failureReason || null]
  );
  if (parsed.data.adminNote) {
    await query(
      `insert into admin_notes (admin_email, entity_type, entity_id, note)
       values ($1,'recharge_order',$2,$3)`,
      [req.admin?.email || "admin", orderId, parsed.data.adminNote]
    );
  }
  await auditAdmin(req.admin?.email || "admin", "admin.recharge.update", "recharge_order", orderId, parsed.data);
  ok(res, rows[0] || { id: orderId, ...parsed.data }, "Recharge order updated");
}));

adminRouter.get("/admin/payment-orders", requireAdmin, asyncHandler(async (req, res) => {
  const search = typeof req.query.search === "string" ? `%${req.query.search}%` : "";
  const rows = await query(
    `select * from payment_orders
     where ($1::text = '' or wallet_address ilike $1 or merchant_name ilike $1 or tx_hash ilike $1)
     order by created_at desc limit 100`,
    [search]
  );
  ok(res, { items: rows }, "Payment orders loaded");
}));

adminRouter.get("/admin/payment-orders/:id", requireAdmin, asyncHandler(async (req, res) => {
  const rows = await query("select * from payment_orders where id = $1 limit 1", [req.params.id]);
  if (!rows[0]) {
    fail(res, "Payment order not found", 404, "Not found");
    return;
  }
  ok(res, rows[0], "Payment order loaded");
}));

adminRouter.patch("/admin/payment-orders/:id", requireAdmin, asyncHandler(async (req, res) => {
  const orderId = String(req.params.id || "");
  const parsed = paymentPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid payment update");
    return;
  }
  const rows = await query("update payment_orders set status = coalesce($2,status), updated_at = now() where id = $1 returning *", [orderId, parsed.data.status || null]);
  if (parsed.data.adminNote) {
    await query(
      `insert into admin_notes (admin_email, entity_type, entity_id, note)
       values ($1,'payment_order',$2,$3)`,
      [req.admin?.email || "admin", orderId, parsed.data.adminNote]
    );
  }
  await auditAdmin(req.admin?.email || "admin", "admin.payment.update", "payment_order", orderId, parsed.data);
  ok(res, rows[0] || { id: orderId, ...parsed.data }, "Payment order updated");
}));

adminRouter.get("/admin/users", requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await query<Record<string, unknown>>(
    `select
      coalesce(u.wallet_address, r.user_wallet_address, p.wallet_address) as wallet_address,
      min(coalesce(u.created_at, r.created_at, p.created_at)) as first_seen,
      max(coalesce(u.updated_at, r.updated_at, p.updated_at)) as last_activity,
      count(distinct r.id)::int as recharge_count,
      count(distinct p.id)::int as payment_count,
      coalesce(sum(r.crypto_amount),0)::float + coalesce(sum(p.amount),0)::float as total_volume
     from users u
     full outer join recharge_orders r on r.user_wallet_address = u.wallet_address
     full outer join payment_orders p on p.wallet_address = coalesce(u.wallet_address, r.user_wallet_address)
     where coalesce(u.wallet_address, r.user_wallet_address, p.wallet_address) is not null
     group by coalesce(u.wallet_address, r.user_wallet_address, p.wallet_address)
     order by last_activity desc nulls last
     limit 100`
  );
  ok(res, { items: rows.map((row) => ({ ...row, local_wallet_only: true })) }, "Users loaded");
}));

adminRouter.get("/admin/audit-logs", requireAdmin, asyncHandler(async (req, res) => {
  const action = typeof req.query.action === "string" ? req.query.action : "";
  const entityType = typeof req.query.entityType === "string" ? req.query.entityType : "";
  const rows = await query(
    `select action, actor_wallet_address, entity_type, entity_id, metadata, created_at
     from audit_logs
     where ($1::text = '' or action = $1) and ($2::text = '' or entity_type = $2)
     order by created_at desc limit 200`,
    [action, entityType]
  );
  ok(res, { items: rows }, "Audit logs loaded");
}));

adminRouter.get("/admin/provider-settings", requireAdmin, asyncHandler(async (_req, res) => {
  ok(res, {
    activeProvider: config.rechargeProvider,
    webhookUrl: "/api/recharge/webhook",
    providers: [
      { provider: "mock", status: "ready", maskedApiKey: "", configured: true },
      { provider: "reloadly", status: config.reloadlyClientId && config.reloadlyClientSecret ? "configured" : "missing_credentials", maskedApiKey: maskKey(config.reloadlyClientId), configured: Boolean(config.reloadlyClientId && config.reloadlyClientSecret) },
      { provider: "dtone", status: config.dtOneApiKey && config.dtOneApiSecret ? "configured" : "missing_credentials", maskedApiKey: maskKey(config.dtOneApiKey), configured: Boolean(config.dtOneApiKey && config.dtOneApiSecret) },
      { provider: "ding", status: config.dingApiKey ? "configured" : "missing_credentials", maskedApiKey: maskKey(config.dingApiKey), configured: Boolean(config.dingApiKey) }
    ]
  }, "Provider settings loaded");
}));

adminRouter.post("/admin/provider-settings/test", requireAdmin, asyncHandler(async (req, res) => {
  const parsed = providerTestSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid provider test");
    return;
  }
  const configured = parsed.data.provider === "mock"
    || (parsed.data.provider === "reloadly" && Boolean(config.reloadlyClientId && config.reloadlyClientSecret))
    || (parsed.data.provider === "dtone" && Boolean(config.dtOneApiKey && config.dtOneApiSecret))
    || (parsed.data.provider === "ding" && Boolean(config.dingApiKey));
  await auditAdmin(req.admin?.email || "admin", "admin.provider.test", "provider_settings", null, { provider: parsed.data.provider, configured });
  ok(res, { provider: parsed.data.provider, configured, status: configured ? "ready" : "missing_credentials" }, "Provider test completed");
}));

adminRouter.post("/admin/provider-settings/active", requireAdmin, asyncHandler(async (req, res) => {
  const parsed = activeProviderSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid active provider");
    return;
  }
  await query(
    `insert into provider_settings (provider, active)
     values ($1,true)
     on conflict (provider) do update set active = true, updated_at = now()`,
    [parsed.data.provider]
  );
  await auditAdmin(req.admin?.email || "admin", "admin.provider.active", "provider_settings", null, parsed.data);
  ok(res, { activeProvider: parsed.data.provider }, "Active provider saved");
}));

adminRouter.get("/admin/fees", requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await query("select * from fee_settings order by updated_at desc limit 1");
  ok(res, rows[0] || {
    recharge_platform_fee_percent: 1.8,
    fixed_fee: 0,
    minimum_fee: 0.15,
    qr_pay_fee_percent: 0.5,
    refund_fee: 0,
    supported_crypto_symbols: ["BNB", "USDT"]
  }, "Fee settings loaded");
}));

adminRouter.post("/admin/fees", requireAdmin, asyncHandler(async (req, res) => {
  const parsed = feesSchema.safeParse(req.body);
  if (!parsed.success) {
    fail(res, JSON.stringify(parsed.error.flatten()), 400, "Invalid fee settings");
    return;
  }
  const rows = await query(
    `insert into fee_settings (recharge_platform_fee_percent, fixed_fee, minimum_fee, qr_pay_fee_percent, refund_fee, supported_crypto_symbols, updated_by)
     values ($1,$2,$3,$4,$5,$6,$7)
     returning *`,
    [
      parsed.data.rechargePlatformFeePercent,
      parsed.data.fixedFee,
      parsed.data.minimumFee,
      parsed.data.qrPayFeePercent,
      parsed.data.refundFee,
      parsed.data.supportedCryptoSymbols,
      req.admin?.email || "admin"
    ]
  );
  await auditAdmin(req.admin?.email || "admin", "admin.fees.update", "fee_settings", null, parsed.data);
  ok(res, rows[0] || parsed.data, "Fee settings saved");
}));
