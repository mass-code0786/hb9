import type { NetworkKey } from "@/lib/networks";

export type TokenSymbol = "BNB" | "USDT" | "USDC" | "ETH" | "MATIC" | "TRX" | "BTC" | "AVAX" | "SOL";

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

export type AppTab = "home" | "markets" | "trade" | "rewards" | "discover";

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

export type RechargeStatus = "draft" | "processing" | "success" | "failed";

export type RechargeCountry = {
  code: string;
  name: string;
  currency: string;
  dialCode: string;
  operators: string[];
};

export type RechargeOrder = {
  id: string;
  country: string;
  operator: string;
  mobile: string;
  amount: string;
  cryptoAsset: TokenSymbol;
  status: RechargeStatus;
  createdAt: string;
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
