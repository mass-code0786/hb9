export type RechargeProviderName = "mock" | "reloadly" | "dtone" | "ding";
export type RechargeStatus = "awaiting_payment" | "payment_detected" | "processing_recharge" | "success" | "failed" | "refund_pending" | "refunded";

export type RechargeCountry = {
  code: string;
  name: string;
  currency: string;
  dialCode: string;
  flag: string;
};

export type RechargeOperator = {
  id: string;
  countryCode: string;
  name: string;
  logoUrl?: string;
};

export type RechargeProduct = {
  id: string;
  operatorId: string;
  name: string;
  localAmount: number;
  localCurrency: string;
  validity?: string;
};

export type RechargeQuoteRequest = {
  countryCode: string;
  operatorId: string;
  phoneNumber: string;
  productId: string;
  cryptoSymbol: "BNB" | "USDT";
  network: string;
  walletAddress?: string;
};

export type RechargeQuote = {
  id: string;
  countryCode: string;
  countryName: string;
  operatorId: string;
  operatorName: string;
  phoneNumber: string;
  productId: string;
  productName: string;
  localCurrency: string;
  localAmount: number;
  usdAmount: number;
  fxRate: number;
  platformFee: number;
  cryptoSymbol: "BNB" | "USDT";
  cryptoAmount: number;
  network: string;
  estimatedDelivery: string;
  expiresAt: string;
};

export type RechargeCreateRequest = {
  quoteId: string;
  txHash: string;
  walletAddress?: string;
};

export type RechargeOrder = {
  id: string;
  userWalletAddress?: string;
  countryCode: string;
  countryName: string;
  operatorId: string;
  operatorName: string;
  phoneNumber: string;
  localCurrency: string;
  localAmount: number;
  cryptoSymbol: "BNB" | "USDT";
  cryptoAmount: number;
  network: string;
  txHash: string;
  provider: RechargeProviderName;
  providerOrderId?: string;
  status: RechargeStatus;
  failureReason?: string;
  refundStatus?: "none" | "review_required" | "pending" | "refunded" | "rejected";
  createdAt: string;
  updatedAt: string;
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

