import type { RechargeOrder, RechargeQuote } from "@/types/wallet";
import { fxRatesToUsd, rechargeCountries, rechargeOperators, rechargeProducts } from "../catalog";
import type { RechargeCreateRequest, RechargeProvider, RechargeQuoteRequest } from "../types";

const cryptoUsd: Record<"BNB" | "USDT", number> = {
  BNB: 612,
  USDT: 1
};

function mockId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export const mockRechargeProvider: RechargeProvider = {
  name: "mock",
  async listCountries() {
    return rechargeCountries;
  },
  async listOperators(countryCode) {
    return rechargeOperators.filter((operator) => operator.countryCode === countryCode);
  },
  async listProducts(operatorId) {
    return rechargeProducts.filter((product) => product.operatorId === operatorId);
  },
  async quote(input: RechargeQuoteRequest): Promise<RechargeQuote> {
    const country = rechargeCountries.find((item) => item.code === input.countryCode) || rechargeCountries[0];
    const operator = rechargeOperators.find((item) => item.id === input.operatorId) || rechargeOperators[0];
    const product = rechargeProducts.find((item) => item.id === input.productId) || rechargeProducts[0];
    const fxRate = fxRatesToUsd[product.localCurrency] || 1;
    const usdAmount = Number((product.localAmount * fxRate).toFixed(2));
    const platformFee = Number(Math.max(0.15, usdAmount * 0.018).toFixed(2));
    const cryptoAmount = Number(((usdAmount + platformFee) / cryptoUsd[input.cryptoSymbol]).toFixed(input.cryptoSymbol === "BNB" ? 6 : 2));

    return {
      id: mockId("quote"),
      countryCode: country.code,
      countryName: country.name,
      operatorId: operator.id,
      operatorName: operator.name,
      phoneNumber: input.phoneNumber,
      productId: product.id,
      productName: product.name,
      localCurrency: product.localCurrency,
      localAmount: product.localAmount,
      usdAmount,
      fxRate,
      platformFee,
      cryptoSymbol: input.cryptoSymbol,
      cryptoAmount,
      network: input.network,
      estimatedDelivery: "Usually under 60 seconds",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    };
  },
  async create(input: RechargeCreateRequest & { quote: RechargeQuote }): Promise<RechargeOrder> {
    const failed = input.txHash.toLowerCase().includes("fail");
    const now = new Date().toISOString();
    return {
      id: mockId("recharge"),
      countryCode: input.quote.countryCode,
      countryName: input.quote.countryName,
      operatorId: input.quote.operatorId,
      operatorName: input.quote.operatorName,
      phoneNumber: input.quote.phoneNumber,
      localCurrency: input.quote.localCurrency,
      localAmount: input.quote.localAmount,
      cryptoAsset: input.quote.cryptoSymbol,
      cryptoAmount: input.quote.cryptoAmount,
      network: input.quote.network,
      txHash: input.txHash,
      providerOrderId: mockId("mock-provider"),
      status: failed ? "refund_pending" : "success",
      failureReason: failed ? "Mock provider failure triggered by tx hash containing fail." : undefined,
      refundStatus: failed ? "review_required" : "none",
      createdAt: now,
      updatedAt: now
    };
  },
  async status() {
    return { status: "success" };
  }
};

