import type { RechargeCountry, RechargeOperator, RechargeOrder, RechargeProduct, RechargeQuote } from "@/types/wallet";
import { rechargeCountries, supportedCountryCount } from "@/services/recharge/catalog";
import { getRechargeProvider } from "@/services/recharge/rechargeProviderFactory";
import type { RechargeCreateRequest, RechargeQuoteRequest } from "@/services/recharge/types";

const provider = getRechargeProvider("mock");
const localOrders: RechargeOrder[] = [];
const localQuotes = new Map<string, RechargeQuote>();

function sanitizePhoneNumber(value: string) {
  return value.replace(/[^\d+]/g, "").slice(0, 18);
}

export { rechargeCountries, supportedCountryCount };

export async function fetchRechargeCountries(): Promise<RechargeCountry[]> {
  return provider.listCountries();
}

export async function fetchRechargeOperators(countryCode: string): Promise<RechargeOperator[]> {
  return provider.listOperators(countryCode);
}

export async function fetchRechargeProducts(operatorId: string): Promise<RechargeProduct[]> {
  return provider.listProducts(operatorId);
}

export async function quoteRecharge(input: RechargeQuoteRequest): Promise<RechargeQuote> {
  const quote = await provider.quote({
    ...input,
    phoneNumber: sanitizePhoneNumber(input.phoneNumber)
  });
  localQuotes.set(quote.id, quote);
  return quote;
}

export async function submitRecharge(input: RechargeCreateRequest): Promise<RechargeOrder> {
  const quote = localQuotes.get(input.quoteId);
  if (!quote) throw new Error("Quote expired. Create a new quote.");
  const order = await provider.create({ ...input, quote });
  localOrders.unshift(order);
  return order;
}

export async function getRechargeStatus(orderId: string): Promise<RechargeOrder | undefined> {
  const order = localOrders.find((item) => item.id === orderId);
  if (!order) return undefined;
  const status = await provider.status(orderId);
  return { ...order, ...status };
}

export async function getRechargeHistory(): Promise<RechargeOrder[]> {
  return localOrders;
}

