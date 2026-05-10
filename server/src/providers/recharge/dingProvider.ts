import { config } from "../../config.js";
import { mockRechargeProvider } from "./mockProvider.js";
import type { RechargeProvider } from "./types.js";

export const dingProvider: RechargeProvider = {
  ...mockRechargeProvider,
  name: "ding",
  async create(input) {
    if (!config.dingApiKey) throw new Error("Ding credentials are not configured.");
    return { ...(await mockRechargeProvider.create(input)), provider: "ding" };
  }
};

