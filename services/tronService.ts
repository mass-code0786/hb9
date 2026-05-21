import { TronWeb } from "tronweb";
import { normalizeMnemonic } from "@/lib/wallet";
import { getNetworkConfig } from "@/lib/networks";
import type { TokenConfig } from "@/lib/tokens";

const TRON_PATH = "m/44'/195'/0'/0/0";
const TRON_TOKEN_TRANSFER_FEE_LIMIT = 30_000_000;

type TronBroadcast = {
  result?: boolean;
  txid?: string;
  transaction?: { txID?: string };
  code?: string;
  message?: string;
};

function getTronWeb(privateKey?: string) {
  const config = getNetworkConfig("tron");
  return new TronWeb({
    fullHost: config.rpcUrl || "https://api.trongrid.io",
    privateKey
  });
}

function toDecimal(raw: bigint, decimals: number) {
  const negative = raw < 0n;
  const value = negative ? -raw : raw;
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = (value % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole.toString()}${fraction ? `.${fraction}` : ""}`;
}

function parseUnits(value: string, decimals: number) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error("Enter a valid amount.");
  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) throw new Error(`Use no more than ${decimals} decimal places.`);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
}

function normalizePrivateKey(privateKey: string) {
  return privateKey.replace(/^0x/, "");
}

function assertBroadcast(response: TronBroadcast) {
  if (!response.result) {
    const message = response.message ? hexToText(response.message) : response.code;
    throw new Error(message || "TRON transaction was rejected.");
  }
  return response.txid || response.transaction?.txID || "";
}

function hexToText(value: string) {
  try {
    const bytes = new Uint8Array((value.match(/.{1,2}/g) || []).map((byte) => Number.parseInt(byte, 16)));
    return new TextDecoder().decode(bytes);
  } catch {
    return value;
  }
}

export function tronAccountFromMnemonic(mnemonic: string) {
  const account = TronWeb.fromMnemonic(normalizeMnemonic(mnemonic), TRON_PATH);
  return {
    address: account.address,
    privateKey: normalizePrivateKey(account.privateKey)
  };
}

export function isTronAddress(address: string) {
  return TronWeb.isAddress(address);
}

export async function getTronBalances(address: string, tokens: TokenConfig[]) {
  if (!isTronAddress(address)) throw new Error("Enter a valid TRON address.");
  const tronWeb = getTronWeb();
  const entries = await Promise.all(
    tokens.map(async (token) => {
      if (token.type === "native") {
        const sun = await tronWeb.trx.getBalance(address);
        return [token.id, toDecimal(BigInt(sun), token.decimals)] as const;
      }
      if (token.type === "trc20" && token.contractAddress) {
        const contract = await tronWeb.contract().at(token.contractAddress);
        const raw = await contract.balanceOf(address).call();
        return [token.id, toDecimal(BigInt(raw.toString()), token.decimals)] as const;
      }
      return [token.id, "0"] as const;
    })
  );
  return Object.fromEntries(entries);
}

export function estimateTronTransfer(token: TokenConfig) {
  return token.type === "trc20" ? "Up to 30 TRX energy/bandwidth fee" : "Bandwidth fee, usually 0 TRX";
}

export async function sendTronTransfer(mnemonic: string, to: string, amount: string, token: TokenConfig) {
  if (!isTronAddress(to)) throw new Error("Enter a valid TRON recipient address.");
  if (!amount || Number(amount) <= 0) throw new Error("Enter a valid amount.");
  const account = tronAccountFromMnemonic(mnemonic);
  const tronWeb = getTronWeb(account.privateKey);

  if (token.type === "native") {
    const sun = parseUnits(amount, token.decimals);
    const response = await tronWeb.trx.sendTransaction(to, Number(sun), { privateKey: account.privateKey }) as unknown as TronBroadcast;
    return { hash: assertBroadcast(response) };
  }

  if (token.type === "trc20" && token.contractAddress) {
    const rawAmount = parseUnits(amount, token.decimals);
    const contract = await tronWeb.contract().at(token.contractAddress);
    const txid = await contract.transfer(to, rawAmount.toString()).send({ feeLimit: TRON_TOKEN_TRANSFER_FEE_LIMIT }, account.privateKey) as string;
    return { hash: txid };
  }

  throw new Error("This TRON token cannot be sent yet.");
}
