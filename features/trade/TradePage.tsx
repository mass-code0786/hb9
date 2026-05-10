"use client";

import { Repeat2, Settings2, ShieldAlert } from "lucide-react";
import { Field, Panel, PrimaryButton, Select } from "@/components/ui/Primitives";
import { NETWORK_OPTIONS, type NetworkKey } from "@/lib/networks";

export function TradePage({ network, onNetworkChange }: { network: NetworkKey; onNetworkChange: (network: NetworkKey) => void }) {
  return (
    <Panel className="space-y-4" data-testid="trade-screen">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Swap</h1>
        <button className="rounded-2xl bg-white/10 p-3" type="button" aria-label="Swap settings"><Settings2 size={18} /></button>
      </div>
      <Select value={network} onChange={(event) => onNetworkChange(event.target.value as NetworkKey)} aria-label="Swap network">
        {NETWORK_OPTIONS.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
      </Select>
      <div className="rounded-2xl bg-white/[0.045] p-4">
        <div className="mb-2 text-xs text-slate-400">From token</div>
        <Field inputMode="decimal" placeholder="0.00" />
        <Select className="mt-3" defaultValue="BNB"><option>BNB</option><option>ETH</option><option>USDT</option><option>MATIC</option></Select>
      </div>
      <div className="flex justify-center"><span className="rounded-2xl bg-accent p-3 text-black"><Repeat2 size={18} /></span></div>
      <div className="rounded-2xl bg-white/[0.045] p-4">
        <div className="mb-2 text-xs text-slate-400">To token</div>
        <Field inputMode="decimal" placeholder="0.00" readOnly />
        <Select className="mt-3" defaultValue="USDT"><option>USDT</option><option>USDC</option><option>ETH</option><option>BNB</option></Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field defaultValue="0.5" aria-label="Slippage percent" />
        <div className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm text-slate-300">Best route</div>
      </div>
      <div className="flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-4 text-sm leading-5 text-yellow-100">
        <ShieldAlert className="mt-0.5 shrink-0" size={18} />
        Swaps are paused until quotes can be checked safely before signing.
      </div>
      <PrimaryButton disabled className="w-full">Swaps Paused</PrimaryButton>
    </Panel>
  );
}
