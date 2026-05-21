import crypto from "node:crypto";
import { config } from "../config.js";

export type NowPaymentsCreatePaymentInput = {
  priceAmount: number;
  priceCurrency: "usd";
  payCurrency: string;
  orderId: string;
  orderDescription: string;
  ipnCallbackUrl?: string;
};

export type NowPaymentsPayment = {
  payment_id: string | number;
  payment_status?: string;
  pay_address?: string;
  price_amount?: number;
  price_currency?: string;
  pay_amount?: number;
  pay_currency?: string;
  order_id?: string;
  purchase_id?: string;
  invoice_url?: string;
  actually_paid?: number;
  outcome_amount?: number;
  outcome_currency?: string;
  payin_hash?: string;
  tx_hash?: string;
};

function requireConfigured() {
  if (config.nowPaymentsMockEnabled) return;
  if (!config.nowPaymentsApiKey) throw new Error("NOWPayments API key is not configured.");
}

function endpoint(path: string) {
  return `${config.nowPaymentsBaseUrl.replace(/\/$/, "")}${path}`;
}

function mockPayment(input: NowPaymentsCreatePaymentInput): NowPaymentsPayment {
  return {
    payment_id: `mock_np_${crypto.randomUUID()}`,
    payment_status: "waiting",
    pay_address: "0x0000000000000000000000000000000000000000",
    price_amount: input.priceAmount,
    price_currency: input.priceCurrency,
    pay_amount: input.priceAmount,
    pay_currency: input.payCurrency,
    order_id: input.orderId
  };
}

export async function createNowPaymentsPayment(input: NowPaymentsCreatePaymentInput): Promise<NowPaymentsPayment> {
  if (config.nowPaymentsMockEnabled) return mockPayment(input);
  requireConfigured();
  const response = await fetch(endpoint("/payment"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.nowPaymentsApiKey
    },
    body: JSON.stringify({
      price_amount: input.priceAmount,
      price_currency: input.priceCurrency,
      pay_currency: input.payCurrency,
      order_id: input.orderId,
      order_description: input.orderDescription,
      ipn_callback_url: input.ipnCallbackUrl,
      success_url: config.nowPaymentsSuccessUrl || undefined,
      cancel_url: config.nowPaymentsCancelUrl || undefined
    })
  });
  const data = await response.json().catch(() => null) as NowPaymentsPayment | { message?: string } | null;
  if (!response.ok) throw new Error((data && "message" in data && data.message) || "NOWPayments payment creation failed.");
  return data as NowPaymentsPayment;
}

export async function getNowPaymentsPayment(paymentId: string): Promise<NowPaymentsPayment> {
  if (config.nowPaymentsMockEnabled) {
    return {
      payment_id: paymentId,
      payment_status: "waiting"
    };
  }
  requireConfigured();
  const response = await fetch(endpoint(`/payment/${encodeURIComponent(paymentId)}`), {
    headers: { "x-api-key": config.nowPaymentsApiKey }
  });
  const data = await response.json().catch(() => null) as NowPaymentsPayment | { message?: string } | null;
  if (!response.ok) throw new Error((data && "message" in data && data.message) || "NOWPayments payment status failed.");
  return data as NowPaymentsPayment;
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).sort().reduce<Record<string, unknown>>((result, key) => {
      result[key] = sortObject((value as Record<string, unknown>)[key]);
      return result;
    }, {});
  }
  return value;
}

export function verifyNowPaymentsIpnSignature(payload: unknown, signature: string) {
  if (!config.nowPaymentsIpnSecret) return false;
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha512", config.nowPaymentsIpnSecret.trim())
    .update(JSON.stringify(sortObject(payload)))
    .digest("hex");
  const left = Buffer.from(signature, "hex");
  const right = Buffer.from(expected, "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
