export type HbCoinSymbol = "USDT" | "BTC" | "BNB" | "HB9" | "PEPE" | "DOGE" | "SHIB" | "BTTC" | "ADA" | "TRX";

export const hbNonUsdtCoinSymbols: HbCoinSymbol[] = ["BTC", "BNB", "HB9", "PEPE", "DOGE", "SHIB", "BTTC", "ADA", "TRX"];
export const hbCoinSymbols: HbCoinSymbol[] = ["USDT", ...hbNonUsdtCoinSymbols];

const mockPrices: Record<HbCoinSymbol, number> = {
  USDT: 1,
  BTC: 65000,
  BNB: 580,
  HB9: 2.23,
  PEPE: 0.000012,
  DOGE: 0.16,
  SHIB: 0.000025,
  BTTC: 0.0000012,
  ADA: 0.45,
  TRX: 0.12
};

export function normalizeHbCoinSymbol(value: string): HbCoinSymbol | null {
  const upper = value.trim().toUpperCase();
  if (upper === "BTCT") return "BTTC";
  if (upper === "SHIBA") return "SHIB";
  return hbCoinSymbols.includes(upper as HbCoinSymbol) ? upper as HbCoinSymbol : null;
}

export function hbCoinName(symbol: HbCoinSymbol) {
  const names: Record<HbCoinSymbol, string> = {
    USDT: "USDT BEP20",
    BTC: "Bitcoin",
    BNB: "Binance Coin",
    HB9: "HB9 Coin",
    PEPE: "Pepe",
    DOGE: "Dogecoin",
    SHIB: "SHIBA",
    BTTC: "BitTorrent Chain",
    ADA: "Cardano",
    TRX: "TRON"
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
