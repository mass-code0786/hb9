import { dingProvider } from "./providers/dingProvider";
import { dtOneProvider } from "./providers/dtOneProvider";
import { mockRechargeProvider } from "./providers/mockProvider";
import { reloadlyProvider } from "./providers/reloadlyProvider";
import type { RechargeProvider, RechargeProviderName } from "./types";

export function getRechargeProvider(name = "mock"): RechargeProvider {
  const provider = name.toLowerCase() as RechargeProviderName;
  if (provider === "reloadly") return reloadlyProvider;
  if (provider === "dtone") return dtOneProvider;
  if (provider === "ding") return dingProvider;
  return mockRechargeProvider;
}

