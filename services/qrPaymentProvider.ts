export type QrPaymentRequest = {
  mode: "static" | "dynamic";
  merchant: string;
  category: "merchant" | "petrol" | "personal";
  address: string;
  asset: "BNB" | "USDT";
  amount: string;
  reference: string;
};

export function parseQrPayload(value: string): QrPaymentRequest {
  try {
    const parsed = JSON.parse(value) as Partial<QrPaymentRequest>;
    return {
      mode: parsed.mode === "dynamic" ? "dynamic" : "static",
      merchant: parsed.merchant || "BitzenX Merchant",
      category: parsed.category || "merchant",
      address: parsed.address || "",
      asset: parsed.asset === "BNB" ? "BNB" : "USDT",
      amount: parsed.amount || "",
      reference: parsed.reference || `qr-${Date.now()}`
    };
  } catch {
    return {
      mode: "static",
      merchant: "Static BSC QR",
      category: "personal",
      address: value,
      asset: "USDT",
      amount: "",
      reference: `static-${Date.now()}`
    };
  }
}
