"use client";

import { Search, TrendingUp } from "lucide-react";
import { Panel } from "@/components/ui/Primitives";
import { formatCurrency } from "@/utils/format";

const markets = [
  { symbol: "BTC", name: "Bitcoin", price: 64000, change: 1.2, marketCap: "$1.26T", color: "#f7931a" },
  { symbol: "ETH", name: "Ethereum", price: 3025.42, change: 2.15, marketCap: "$363B", color: "#8a92b2" },
  { symbol: "BNB", name: "BNB", price: 612.35, change: 1.84, marketCap: "$91B", color: "#f3ba2f" },
  { symbol: "MATIC", name: "Polygon", price: 0.72, change: -0.62, marketCap: "$7B", color: "#8247e5" },
  { symbol: "TRX", name: "Tron", price: 0.12, change: 0.88, marketCap: "$11B", color: "#ff060a" },
  { symbol: "SOL", name: "Solana", price: 142.7, change: 3.4, marketCap: "$64B", color: "#14f195" }
];

export function MarketsPage() {
  return (
    <div className="space-y-4" data-testid="markets-screen">
      <Panel>
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3">
          <Search size={18} className="text-slate-400" />
          <input className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500" placeholder="Search BTC, ETH, BNB" />
        </div>
      </Panel>
      <Panel>
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp size={19} className="text-accent" />
          <h1 className="text-xl font-semibold">Trending</h1>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {markets.slice(0, 3).map((coin) => (
            <div key={coin.symbol} className="rounded-2xl bg-white/[0.045] p-3">
              <div className="font-semibold">{coin.symbol}</div>
              <div className={coin.change >= 0 ? "text-sm text-mint" : "text-sm text-danger"}>{coin.change >= 0 ? "+" : ""}{coin.change}%</div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <h2 className="mb-4 text-lg font-semibold">Crypto Markets</h2>
        <div className="space-y-2">
          {markets.map((coin) => (
            <div key={coin.symbol} className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.045] p-3" data-testid="market-row">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-bold text-black" style={{ backgroundColor: coin.color }}>{coin.symbol[0]}</span>
                <span className="min-w-0">
                  <span className="block font-semibold">{coin.symbol}</span>
                  <span className="block truncate text-xs text-slate-400">{coin.name} | MCap {coin.marketCap}</span>
                </span>
              </div>
              <div className="text-right">
                <div className="font-semibold">{formatCurrency(coin.price)}</div>
                <div className={coin.change >= 0 ? "text-xs text-mint" : "text-xs text-danger"}>{coin.change >= 0 ? "+" : ""}{coin.change}%</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
