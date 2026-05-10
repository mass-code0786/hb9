import "dotenv/config";

export const config = {
  port: Number(process.env.API_PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || "",
  rechargeProvider: process.env.RECHARGE_PROVIDER || "mock",
  reloadlyClientId: process.env.RELOADLY_CLIENT_ID || "",
  reloadlyClientSecret: process.env.RELOADLY_CLIENT_SECRET || "",
  dtOneApiKey: process.env.DTONE_API_KEY || "",
  dtOneApiSecret: process.env.DTONE_API_SECRET || "",
  dingApiKey: process.env.DING_API_KEY || "",
  autoRefundEnabled: process.env.AUTO_REFUND_ENABLED === "true",
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 120)
};
