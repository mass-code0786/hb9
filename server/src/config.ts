import "dotenv/config";

export const config = {
  port: Number(process.env.API_PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || "",
  rechargeProvider: process.env.RECHARGE_PROVIDER || "mock"
};
