import { mockRechargeProvider } from "./mockProvider";
import type { RechargeProvider } from "../types";

export const reloadlyProvider: RechargeProvider = {
  ...mockRechargeProvider,
  name: "reloadly"
};

