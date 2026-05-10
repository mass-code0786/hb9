import { config } from "../../config.js";
import { mockRechargeProvider } from "./mockProvider.js";
import type { RechargeProvider } from "./types.js";

export const dtOneProvider: RechargeProvider = {
  ...mockRechargeProvider,
  name: "dtone",
  async create(input) {
    if (!config.dtOneApiKey || !config.dtOneApiSecret) throw new Error("DT One credentials are not configured.");
    return { ...(await mockRechargeProvider.create(input)), provider: "dtone" };
  }
};

