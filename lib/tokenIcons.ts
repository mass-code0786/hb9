import type { NetworkKey } from "@/lib/networks";

export type TokenIconNetwork = NetworkKey | "all";

export type TokenIconFallback = {
  label: string;
  background: string;
  foreground: string;
};

export type TokenIconRegistryItem = {
  symbol: string;
  network: TokenIconNetwork;
  icon: string;
  fallback: TokenIconFallback;
};

export type NetworkIconRegistryItem = {
  network: NetworkKey;
  symbol: string;
  icon: string;
  fallback: TokenIconFallback;
};

const fallbackBySymbol: Record<string, TokenIconFallback> = {
  BNB: { label: "BNB", background: "#f3ba2f", foreground: "#111827" },
  USDT: { label: "USDT", background: "#26a17b", foreground: "#ffffff" },
  USDC: { label: "USDC", background: "#2775ca", foreground: "#ffffff" },
  MATIC: { label: "MATIC", background: "#8247e5", foreground: "#ffffff" },
  TRX: { label: "TRX", background: "#ff060a", foreground: "#ffffff" },
  BTC: { label: "BTC", background: "#f7931a", foreground: "#111827" },
  SOL: { label: "SOL", background: "#111827", foreground: "#ffffff" },
  AVAX: { label: "AVAX", background: "#e84142", foreground: "#ffffff" },
  ARB: { label: "ARB", background: "#28a0f0", foreground: "#ffffff" },
  OP: { label: "OP", background: "#ff0420", foreground: "#ffffff" }
};

export const TOKEN_ICON_REGISTRY: TokenIconRegistryItem[] = [
  { symbol: "BNB", network: "bsc", icon: "/tokens/bnb.svg", fallback: fallbackBySymbol.BNB },
  { symbol: "USDT", network: "all", icon: "/tokens/usdt.svg", fallback: fallbackBySymbol.USDT },
  { symbol: "USDC", network: "all", icon: "/tokens/usdc.svg", fallback: fallbackBySymbol.USDC },
  { symbol: "MATIC", network: "polygon", icon: "/tokens/matic.svg", fallback: fallbackBySymbol.MATIC },
  { symbol: "TRX", network: "tron", icon: "/tokens/trx.svg", fallback: fallbackBySymbol.TRX },
  { symbol: "BTC", network: "bitcoin", icon: "/tokens/btc.svg", fallback: fallbackBySymbol.BTC },
  { symbol: "SOL", network: "solana", icon: "/tokens/sol.svg", fallback: fallbackBySymbol.SOL },
  { symbol: "AVAX", network: "avalanche", icon: "/tokens/avax.svg", fallback: fallbackBySymbol.AVAX },
  { symbol: "ARB", network: "arbitrum", icon: "/tokens/arb.svg", fallback: fallbackBySymbol.ARB },
  { symbol: "OP", network: "optimism", icon: "/tokens/op.svg", fallback: fallbackBySymbol.OP }
];

export const NETWORK_ICON_REGISTRY: NetworkIconRegistryItem[] = [
  { network: "bsc", symbol: "BNB", icon: "/tokens/bnb.svg", fallback: fallbackBySymbol.BNB },
  { network: "polygon", symbol: "MATIC", icon: "/tokens/matic.svg", fallback: fallbackBySymbol.MATIC },
  { network: "tron", symbol: "TRX", icon: "/tokens/trx.svg", fallback: fallbackBySymbol.TRX },
  { network: "avalanche", symbol: "AVAX", icon: "/tokens/avax.svg", fallback: fallbackBySymbol.AVAX },
  { network: "arbitrum", symbol: "ARB", icon: "/tokens/arb.svg", fallback: fallbackBySymbol.ARB },
  { network: "optimism", symbol: "OP", icon: "/tokens/op.svg", fallback: fallbackBySymbol.OP },
  { network: "bitcoin", symbol: "BTC", icon: "/tokens/btc.svg", fallback: fallbackBySymbol.BTC },
  { network: "solana", symbol: "SOL", icon: "/tokens/sol.svg", fallback: fallbackBySymbol.SOL }
];

export const NETWORK_BADGE_STYLES: Record<NetworkKey, string> = {
  bsc: "border-yellow-300/25 bg-yellow-300/10 text-yellow-100",
  ethereum: "border-slate-300/20 bg-slate-300/10 text-slate-200",
  polygon: "border-purple-300/25 bg-purple-400/10 text-purple-100",
  tron: "border-red-300/25 bg-red-500/10 text-red-100",
  avalanche: "border-red-300/25 bg-red-500/10 text-red-100",
  arbitrum: "border-sky-300/25 bg-sky-500/10 text-sky-100",
  optimism: "border-red-300/25 bg-red-500/10 text-red-100",
  bitcoin: "border-orange-300/25 bg-orange-400/10 text-orange-100",
  solana: "border-emerald-300/25 bg-emerald-400/10 text-emerald-100"
};

export function getTokenIcon(symbol: string, network?: NetworkKey) {
  const normalizedSymbol = symbol.trim().toUpperCase();
  return (
    TOKEN_ICON_REGISTRY.find((item) => item.symbol === normalizedSymbol && item.network === network) ||
    TOKEN_ICON_REGISTRY.find((item) => item.symbol === normalizedSymbol && item.network === "all") ||
    TOKEN_ICON_REGISTRY.find((item) => item.symbol === normalizedSymbol)
  );
}

export function getNetworkIcon(network: NetworkKey) {
  return NETWORK_ICON_REGISTRY.find((item) => item.network === network);
}

export function getTokenFallback(symbol: string, color?: string): TokenIconFallback {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const label = normalizedSymbol.slice(0, 4) || "?";
  return fallbackBySymbol[normalizedSymbol] || { label, background: color || "#05c46b", foreground: "#061015" };
}

export function getNetworkBadgeClass(network?: NetworkKey) {
  return network ? NETWORK_BADGE_STYLES[network] : "border-white/10 bg-white/[0.045] text-slate-300";
}
