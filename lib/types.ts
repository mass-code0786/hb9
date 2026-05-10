export type EncryptedVault = {
  version: 1;
  address: string;
  cipherText: string;
  iv: string;
  salt: string;
  createdAt: string;
};

export type TokenBalance = {
  bnb: string;
  usdt: string;
};

export type TxStatus = {
  hash?: string;
  state: "idle" | "estimating" | "signing" | "submitted" | "confirmed" | "failed";
  message: string;
};
