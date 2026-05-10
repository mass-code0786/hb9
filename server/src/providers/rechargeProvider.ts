import { randomUUID } from "crypto";

export type RechargeQuoteInput = {
  country: string;
  operator: string;
  mobile: string;
  amount: number;
  asset: "BNB" | "USDT";
};

export type RechargeProvider = {
  quote(input: RechargeQuoteInput): Promise<{ provider: string; fee: number; payable: number; etaSeconds: number }>;
  create(input: RechargeQuoteInput & { paymentOrderId?: string }): Promise<{ providerReference: string; status: "pending" | "success" | "failed" }>;
};

export const mockRechargeProvider: RechargeProvider = {
  async quote(input) {
    const fee = Number((input.amount * 0.012).toFixed(2));
    return { provider: "mock", fee, payable: Number((input.amount + fee).toFixed(2)), etaSeconds: 60 };
  },
  async create() {
    return { providerReference: `mock-${randomUUID()}`, status: "pending" };
  }
};
