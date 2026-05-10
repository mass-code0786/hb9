import { config } from "../../config.js";
import { mockRechargeProvider } from "./mockProvider.js";
import type { RechargeProvider } from "./types.js";

export const reloadlyProvider: RechargeProvider = {
  ...mockRechargeProvider,
  name: "reloadly",
  async create(input) {
    if (!config.reloadlyClientId || !config.reloadlyClientSecret) {
      throw new Error("Reloadly credentials are not configured.");
    }
    return { ...(await mockRechargeProvider.create(input)), provider: "reloadly" };
  }
};

