import type { RechargeCountry, RechargeOperator, RechargeOrder, RechargeProduct, RechargeQuote } from "@/types/wallet";

export type RechargeProviderName = "mock" | "reloadly" | "dtone" | "ding";

export type RechargeQuoteRequest = {
  countryCode: string;
  operatorId: string;
  phoneNumber: string;
  productId: string;
  cryptoSymbol: "BNB" | "USDT";
  network: string;
  walletAddress?: string;
};

export type RechargeCreateRequest = {
  quoteId: string;
  txHash: string;
  walletAddress?: string;
};

export type RechargeProvider = {
  name: RechargeProviderName;
  listCountries(): Promise<RechargeCountry[]>;
  listOperators(countryCode: string): Promise<RechargeOperator[]>;
  listProducts(operatorId: string): Promise<RechargeProduct[]>;
  quote(input: RechargeQuoteRequest): Promise<RechargeQuote>;
  create(input: RechargeCreateRequest & { quote: RechargeQuote }): Promise<RechargeOrder>;
  status(orderId: string): Promise<Partial<RechargeOrder>>;
};

