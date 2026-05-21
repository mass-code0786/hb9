import { config } from "../../config.js";
import { dingProvider } from "./dingProvider.js";
import { dtOneProvider } from "./dtOneProvider.js";
import { mockRechargeProvider } from "./mockProvider.js";
import { reloadlyProvider } from "./reloadlyProvider.js";
import type { RechargeProvider, RechargeProviderName } from "./types.js";

export function getRechargeProvider(name = config.rechargeProvider): RechargeProvider {
  const provider = name.toLowerCase() as RechargeProviderName;
  if (provider === "reloadly") return reloadlyProvider;
  if (provider === "dtone") return dtOneProvider;
  if (provider === "ding") return dingProvider;
  if (process.env.NODE_ENV === "production") {
    throw new Error("RECHARGE_PROVIDER must be a live provider in production.");
  }
  return mockRechargeProvider;
}
