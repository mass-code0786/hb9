import type { NetworkKey } from "@/lib/networks";

export type TokenSymbol = "BNB" | "USDT" | "USDC" | "MATIC" | "TRX" | "BTC" | "AVAX" | "SOL";

export type WalletToken = {
  symbol: TokenSymbol | string;
  name: string;
  balance: string;
  fiatValue: number;
  price: number;
  change24h: number;
  address?: string;
  decimals?: number;
  id?: string;
  network?: NetworkKey;
  networkName?: string;
  placeholder?: boolean;
  metadataVerified?: boolean;
  favorite?: boolean;
  hidden?: boolean;
  color: string;
};

export type AppTab = "home" | "products" | "team" | "income" | "wallet";

export type WalletScreen =
  | "landing"
  | "create"
  | "confirm"
  | "import"
  | "password"
  | "unlock"
  | "pin-setup"
  | "backup-verify"
  | "dashboard"
  | "receive"
  | "send"
  | "deposit"
  | "withdrawal"
  | "recharge"
  | "qr-pay"
  | "token-details"
  | "manage-tokens"
  | "transactions"
  | "security"
  | "settings"
  | "provider-settings"
  | "about"
  | "help"
  | "terms"
  | "offline";

export type RechargeStatus =
  | "awaiting_payment"
  | "payment_detected"
  | "processing_recharge"
  | "success"
  | "failed"
  | "refund_pending"
  | "refunded";

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

export type RechargeOrder = {
  id: string;
  countryCode: string;
  countryName: string;
  operatorId: string;
  operatorName: string;
  phoneNumber: string;
  localCurrency: string;
  localAmount: number;
  cryptoAsset: "BNB" | "USDT";
  cryptoAmount: number;
  network: string;
  txHash: string;
  status: RechargeStatus;
  refundStatus?: "none" | "review_required" | "pending" | "refunded" | "rejected";
  failureReason?: string;
  providerOrderId?: string;
  createdAt: string;
  updatedAt?: string;
};

export type WalletTransaction = {
  id: string;
  type: "send" | "receive" | "recharge" | "swap" | "qr-pay";
  title: string;
  asset: string;
  amount: string;
  status: "pending" | "success" | "failed";
  hash?: string;
  gasFee?: string;
  counterparty?: string;
  createdAt: string;
};
