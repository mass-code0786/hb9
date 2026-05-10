import { mockRechargeProvider } from "./mockProvider";
import type { RechargeProvider } from "../types";

export const dingProvider: RechargeProvider = {
  ...mockRechargeProvider,
  name: "ding"
};

