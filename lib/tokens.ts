import type { NetworkKey } from "@/lib/networks";

export type TokenType = "native" | "erc20" | "trc20" | "placeholder";

export type TokenConfig = {
  id: string;
  network: NetworkKey;
  type: TokenType;
  symbol: string;
  name: string;
  decimals: number;
  contractAddress?: string;
  color: string;
  price: number;
  change24h: number;
  important?: boolean;
  placeholder?: boolean;
  metadataVerified?: boolean;
};

export const DEFAULT_TOKENS: TokenConfig[] = [
  { id: "bsc:BNB", network: "bsc", type: "native", symbol: "BNB", name: "BNB", decimals: 18, color: "#f3ba2f", price: 612.35, change24h: 1.84, important: true },
  { id: "bsc:USDT", network: "bsc", type: "erc20", symbol: "USDT", name: "Tether USD BEP20", decimals: 18, contractAddress: "0x55d398326f99059fF775485246999027B3197955", color: "#31d0aa", price: 1, change24h: 0.01, important: true },
  { id: "bsc:USDC", network: "bsc", type: "erc20", symbol: "USDC", name: "USD Coin BEP20", decimals: 18, contractAddress: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", color: "#2775ca", price: 1, change24h: 0, important: true },
  { id: "ethereum:USDT", network: "ethereum", type: "erc20", symbol: "USDT", name: "Tether USD ERC20", decimals: 6, contractAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7", color: "#31d0aa", price: 1, change24h: 0.01, important: true },
  { id: "polygon:MATIC", network: "polygon", type: "native", symbol: "MATIC", name: "Polygon", decimals: 18, color: "#8247e5", price: 0.72, change24h: -0.62, important: true },
  { id: "polygon:USDT", network: "polygon", type: "erc20", symbol: "USDT", name: "Tether USD Polygon", decimals: 6, contractAddress: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", color: "#31d0aa", price: 1, change24h: 0.01, important: true },
  { id: "tron:TRX", network: "tron", type: "native", symbol: "TRX", name: "TRON", decimals: 6, color: "#ff060a", price: 0.12, change24h: 0.88, important: true },
  { id: "tron:USDT", network: "tron", type: "trc20", symbol: "USDT", name: "Tether USD TRC20", decimals: 6, contractAddress: "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj", color: "#31d0aa", price: 1, change24h: 0.01, important: true },
  { id: "bitcoin:BTC", network: "bitcoin", type: "placeholder", symbol: "BTC", name: "Bitcoin", decimals: 8, color: "#f7931a", price: 64000, change24h: 1.2, important: true, placeholder: true },
  { id: "avalanche:AVAX", network: "avalanche", type: "native", symbol: "AVAX", name: "Avalanche", decimals: 18, color: "#e84142", price: 34.2, change24h: 1.09 },
  { id: "solana:SOL", network: "solana", type: "placeholder", symbol: "SOL", name: "Solana", decimals: 9, color: "#14f195", price: 142.7, change24h: 3.4, placeholder: true }
];

export function getTokensForNetwork(network: NetworkKey) {
  return DEFAULT_TOKENS.filter((token) => token.network === network);
}
