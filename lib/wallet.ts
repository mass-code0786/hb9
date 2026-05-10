import { ethers } from "ethers";
import * as bip39 from "bip39";

export function generateMnemonic() {
  return bip39.generateMnemonic(128);
}

export function normalizeMnemonic(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function validateMnemonic(value: string) {
  const normalized = normalizeMnemonic(value);
  return normalized.split(" ").length === 12 && bip39.validateMnemonic(normalized);
}

export function walletFromMnemonic(mnemonic: string) {
  return ethers.HDNodeWallet.fromPhrase(normalizeMnemonic(mnemonic), undefined, "m/44'/60'/0'/0/0");
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
