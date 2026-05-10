import { randomUUID } from "node:crypto";
import { countries, fxRatesToUsd, operators, products } from "./catalog.js";
import type { RechargeCreateRequest, RechargeOrder, RechargeProvider, RechargeQuote, RechargeQuoteRequest } from "./types.js";

const cryptoUsd: Record<"BNB" | "USDT", number> = { BNB: 612, USDT: 1 };

export const mockRechargeProvider: RechargeProvider = {
  name: "mock",
  async listCountries() {
    return countries;
  },
  async listOperators(countryCode) {
    return operators.filter((operator) => operator.countryCode === countryCode.toUpperCase());
  },
  async listProducts(operatorId) {
    return products.filter((product) => product.operatorId === operatorId);
  },
  async quote(input: RechargeQuoteRequest): Promise<RechargeQuote> {
    const country = countries.find((item) => item.code === input.countryCode.toUpperCase()) || countries[0];
    const operator = operators.find((item) => item.id === input.operatorId) || operators[0];
    const product = products.find((item) => item.id === input.productId) || products[0];
    const fxRate = fxRatesToUsd[product.localCurrency] || 1;
    const usdAmount = Number((product.localAmount * fxRate).toFixed(2));
    const platformFee = Number(Math.max(0.15, usdAmount * 0.018).toFixed(2));
    const cryptoAmount = Number(((usdAmount + platformFee) / cryptoUsd[input.cryptoSymbol]).toFixed(input.cryptoSymbol === "BNB" ? 6 : 2));

    return {
      id: randomUUID(),
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
      id: randomUUID(),
      userWalletAddress: input.walletAddress,
      countryCode: input.quote.countryCode,
      countryName: input.quote.countryName,
      operatorId: input.quote.operatorId,
      operatorName: input.quote.operatorName,
      phoneNumber: input.quote.phoneNumber,
      localCurrency: input.quote.localCurrency,
      localAmount: input.quote.localAmount,
      cryptoSymbol: input.quote.cryptoSymbol,
      cryptoAmount: input.quote.cryptoAmount,
      network: input.quote.network,
      txHash: input.txHash,
      provider: "mock",
      providerOrderId: `mock-${randomUUID()}`,
      status: failed ? "refund_pending" : "success",
      failureReason: failed ? "Mock provider failure triggered by tx hash containing fail." : undefined,
      refundStatus: failed ? "review_required" : "none",
      createdAt: now,
      updatedAt: now
    };
  },
  async status() {
    return {};
  }
};

