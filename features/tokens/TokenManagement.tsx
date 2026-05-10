"use client";

import { Star, EyeOff, Plus } from "lucide-react";
import { useState } from "react";
import { Panel, PrimaryButton, Field } from "@/components/ui/Primitives";
import { useTokenStore } from "@/store/tokenStore";
import type { WalletToken } from "@/types/wallet";
import { formatCurrency, trimAmount } from "@/utils/format";

export function TokenDetails({ token }: { token: WalletToken | null }) {
  const toggleFavorite = useTokenStore((state) => state.toggleFavorite);
  const toggleHidden = useTokenStore((state) => state.toggleHidden);
  if (!token) return <Panel>Select a token from the home asset list.</Panel>;
  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold">{token.symbol}</h1>
            <p className="text-slate-400">{token.name}</p>
          </div>
          <div className="flex gap-2">
            <button className="rounded-2xl bg-white/10 p-3" onClick={() => toggleFavorite(token.symbol)} type="button"><Star size={18} /></button>
            <button className="rounded-2xl bg-white/10 p-3" onClick={() => toggleHidden(token.symbol)} type="button"><EyeOff size={18} /></button>
          </div>
        </div>
        <div className="mt-6 text-4xl font-semibold">{trimAmount(token.balance)}</div>
        <div className="mt-2 text-slate-400">{formatCurrency(token.fiatValue)} | {token.change24h}% 24h</div>
      </Panel>
      <Panel>
        <h2 className="mb-4 text-lg font-semibold">Price chart</h2>
        <div className="flex h-44 items-end gap-2 rounded-2xl bg-white/[0.045] p-4">
          {[40, 56, 46, 80, 72, 92, 68, 76, 88, 95, 84, 98].map((height, index) => (
            <div key={index} className="flex-1 rounded-t-xl bg-mint/70" style={{ height: `${height}%` }} />
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function AddCustomToken() {
  const addCustomToken = useTokenStore((state) => state.addCustomToken);
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  return (
    <Panel>
      <div className="mb-4 flex items-center gap-2"><Plus size={20} /><h2 className="text-lg font-semibold">Add custom token</h2></div>
      <div className="grid gap-3">
        <Field placeholder="Symbol" value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} />
        <Field placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <Field placeholder="Contract address" value={address} onChange={(event) => setAddress(event.target.value)} />
      </div>
      <PrimaryButton className="mt-4 w-full" onClick={() => {
        if (!symbol || !name) return;
        addCustomToken({ symbol, name, address, balance: "0", price: 0, fiatValue: 0, change24h: 0, color: "#8b5cf6" });
        setSymbol("");
        setName("");
        setAddress("");
      }} type="button">Add Token</PrimaryButton>
    </Panel>
  );
}
