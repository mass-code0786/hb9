import { mockRechargeProvider } from "./mockProvider";
import type { RechargeProvider } from "../types";

export const dtOneProvider: RechargeProvider = {
  ...mockRechargeProvider,
  name: "dtone"
};

