import { ethers } from "ethers";

export type QrPaymentRequest = {
  mode: "static" | "dynamic";
  merchant: string;
  category: "merchant" | "petrol" | "personal";
  address: string;
  asset: "BNB" | "USDT";
  amount: string;
  reference: string;
};

export type ParsedQrResult = {
  request: QrPaymentRequest | null;
  error: string;
};

export function parseQrPayload(value: string): QrPaymentRequest {
  return parseQrPayloadSafe(value).request || {
    mode: "static",
    merchant: "Invalid QR",
    category: "personal",
    address: "",
    asset: "USDT",
    amount: "",
    reference: `invalid-${Date.now()}`
  };
}

export function parseQrPayloadSafe(value: string): ParsedQrResult {
  const trimmed = value.trim();
  if (!trimmed) return { request: null, error: "QR payload is empty." };

  try {
    const parsed = JSON.parse(trimmed) as Partial<QrPaymentRequest>;
    const address = parsed.address || "";
    if (!ethers.isAddress(address)) {
      return { request: null, error: "Payment QR does not contain a valid BSC address." };
    }
    return {
      error: "",
      request: {
      mode: parsed.mode === "dynamic" ? "dynamic" : "static",
      merchant: parsed.merchant || "HB9 Merchant",
      category: parsed.category || "merchant",
      address,
      asset: parsed.asset === "BNB" ? "BNB" : "USDT",
      amount: parsed.amount || "",
      reference: parsed.reference || `qr-${Date.now()}`
      }
    };
  } catch {
    if (!ethers.isAddress(trimmed)) {
      return { request: null, error: "QR code is not a valid wallet address or payment JSON." };
    }
    return {
      error: "",
      request: {
      mode: "static",
      merchant: "Static BSC QR",
      category: "personal",
      address: trimmed,
      asset: "USDT",
      amount: "",
      reference: `static-${Date.now()}`
      }
    };
  }
}
