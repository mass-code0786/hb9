"use client";

import { Compass, Search } from "lucide-react";
import { Panel } from "@/components/ui/Primitives";

const dapps = ["PancakeSwap", "Uniswap", "OpenSea", "BscScan", "Polygonscan", "TronScan"];
const categories = ["DeFi", "NFT", "Recharge", "Payments"];

export function DiscoverPage() {
  return (
    <div className="space-y-4" data-testid="discover-screen">
      <Panel>
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3">
          <Search size={18} className="text-slate-400" />
          <input className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500" placeholder="Search or enter dApp URL" />
        </div>
      </Panel>
      <Panel>
        <div className="mb-4 flex items-center gap-2"><Compass className="text-accent" size={19} /><h1 className="text-xl font-semibold">Popular DApps</h1></div>
        <div className="grid grid-cols-2 gap-3">
          {dapps.map((name) => (
            <button key={name} className="rounded-2xl bg-white/[0.045] p-4 text-left font-semibold" type="button" data-testid="dapp-card">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-black">{name[0]}</span>
              {name}
            </button>
          ))}
        </div>
      </Panel>
      <Panel>
        <h2 className="mb-4 text-lg font-semibold">Categories</h2>
        <div className="grid grid-cols-2 gap-3">
          {categories.map((name) => <div key={name} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 font-semibold">{name}</div>)}
        </div>
      </Panel>
    </div>
  );
}
