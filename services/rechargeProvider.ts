import type { RechargeCountry, RechargeOperator, RechargeOrder, RechargeProduct, RechargeQuote } from "@/types/wallet";
import { rechargeCountries, supportedCountryCount } from "@/services/recharge/catalog";
import { getRechargeProvider } from "@/services/recharge/rechargeProviderFactory";
import type { RechargeCreateRequest, RechargeQuoteRequest } from "@/services/recharge/types";

const provider = getRechargeProvider("mock");
const localOrders: RechargeOrder[] = [];
const localQuotes = new Map<string, RechargeQuote>();

type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  message: string;
  error: string | null;
};

function sanitizePhoneNumber(value: string) {
  return value.replace(/[^\d+]/g, "").slice(0, 18);
}

export { rechargeCountries, supportedCountryCount };

function apiUrl(path: string) {
  const configured = (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
  const localDefault = process.env.NODE_ENV === "development" ? "http://localhost:4000" : "";
  return `${configured || localDefault}/api${path}`;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });
  const envelope = await response.json().catch(() => null) as ApiEnvelope<T> | null;
  if (!response.ok || !envelope?.success || envelope.data == null) {
    throw new Error(envelope?.error || envelope?.message || "Recharge API request failed.");
  }
  return envelope.data;
}

function allowDevFallback() {
  return process.env.NODE_ENV !== "production";
}

export async function fetchRechargeCountries(): Promise<RechargeCountry[]> {
  try {
    const data = await apiRequest<{ items: RechargeCountry[] }>("/recharge/countries");
    if (data.items.length) return data.items;
  } catch (err) {
    if (!allowDevFallback()) throw err;
  }
  return provider.listCountries();
}

export async function fetchRechargeOperators(countryCode: string): Promise<RechargeOperator[]> {
  try {
    const data = await apiRequest<{ items: RechargeOperator[] }>(`/recharge/operators?country=${encodeURIComponent(countryCode)}`);
    return data.items;
  } catch (err) {
    if (!allowDevFallback()) throw err;
  }
  return provider.listOperators(countryCode);
}

export async function fetchRechargeProducts(operatorId: string): Promise<RechargeProduct[]> {
  try {
    const data = await apiRequest<{ items: RechargeProduct[] }>(`/recharge/products?operatorId=${encodeURIComponent(operatorId)}`);
    return data.items;
  } catch (err) {
    if (!allowDevFallback()) throw err;
  }
  return provider.listProducts(operatorId);
}

export async function quoteRecharge(input: RechargeQuoteRequest): Promise<RechargeQuote> {
  try {
    const quote = await apiRequest<RechargeQuote>("/recharge/quote", {
      method: "POST",
      body: JSON.stringify({ ...input, phoneNumber: sanitizePhoneNumber(input.phoneNumber) })
    });
    localQuotes.set(quote.id, quote);
    return quote;
  } catch (err) {
    if (!allowDevFallback()) throw err;
    const quote = await provider.quote({
      ...input,
      phoneNumber: sanitizePhoneNumber(input.phoneNumber)
    });
    localQuotes.set(quote.id, quote);
    return quote;
  }
}

export async function submitRecharge(input: RechargeCreateRequest): Promise<RechargeOrder> {
  try {
    const order = await apiRequest<RechargeOrder>("/recharge/create", {
      method: "POST",
      body: JSON.stringify(input)
    });
    localOrders.unshift(order);
    return order;
  } catch (err) {
    if (!allowDevFallback()) throw err;
    const quote = localQuotes.get(input.quoteId);
    if (!quote) throw new Error("Quote expired. Create a new quote.");
    const order = await provider.create({ ...input, quote });
    localOrders.unshift(order);
    return order;
  }
}

export async function getRechargeStatus(orderId: string): Promise<RechargeOrder | undefined> {
  try {
    return await apiRequest<RechargeOrder>(`/recharge/status/${encodeURIComponent(orderId)}`);
  } catch (err) {
    if (!allowDevFallback()) throw err;
  }
  const order = localOrders.find((item) => item.id === orderId);
  if (!order) return undefined;
  const status = await provider.status(orderId);
  return { ...order, ...status };
}

export async function getRechargeHistory(walletAddress?: string): Promise<RechargeOrder[]> {
  if (walletAddress) {
    try {
      const data = await apiRequest<{ items: RechargeOrder[] }>(`/recharge/history?walletAddress=${encodeURIComponent(walletAddress)}`);
      return data.items;
    } catch (err) {
      if (!allowDevFallback()) throw err;
    }
  }
  return localOrders;
}
