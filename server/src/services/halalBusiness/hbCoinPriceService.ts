export type HbCoinSymbol = "USDT" | "BTC" | "ETH" | "BNB" | "TRX" | "MATIC" | "HB9" | "PEPE" | "DOGE" | "SHIB" | "BTTC" | "ADA";

export const hbNonUsdtCoinSymbols: HbCoinSymbol[] = ["BTC", "ETH", "BNB", "TRX", "MATIC", "HB9", "PEPE", "DOGE", "SHIB", "BTTC", "ADA"];
export const hbCoinSymbols: HbCoinSymbol[] = ["USDT", ...hbNonUsdtCoinSymbols];

const mockPrices: Record<HbCoinSymbol, number> = {
  USDT: 1,
  BTC: 65000,
  ETH: 3200,
  BNB: 580,
  TRX: 0.12,
  MATIC: 0.75,
  HB9: 0.13,
  PEPE: 0.000012,
  DOGE: 0.16,
  SHIB: 0.000025,
  BTTC: 0.0000012,
  ADA: 0.45
};

export function normalizeHbCoinSymbol(value: string): HbCoinSymbol | null {
  const upper = value.trim().toUpperCase();
  if (upper === "BTCT") return "BTTC";
  if (upper === "SHIBA") return "SHIB";
  if (upper === "POLYGON") return "MATIC";
  return hbCoinSymbols.includes(upper as HbCoinSymbol) ? upper as HbCoinSymbol : null;
}

export function hbCoinName(symbol: HbCoinSymbol) {
  const names: Record<HbCoinSymbol, string> = {
    USDT: "USDT BEP20",
    BTC: "Bitcoin",
    ETH: "Ethereum",
    BNB: "Binance Coin",
    TRX: "TRON",
    MATIC: "Polygon",
    HB9: "HB9 Coin",
    PEPE: "Pepe",
    DOGE: "Dogecoin",
    SHIB: "SHIBA",
    BTTC: "BitTorrent Chain",
    ADA: "Cardano"
  };
  return names[symbol];
}

export async function getHbCoinPrices(): Promise<Record<HbCoinSymbol, number>> {
  return { ...mockPrices };
}

export async function getHbCoinPrice(symbol: HbCoinSymbol) {
  const prices = await getHbCoinPrices().catch(() => ({ ...mockPrices }));
  return Number(prices[symbol] || 0);
}
