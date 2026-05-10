"use client";

import { Eye, EyeOff, Plus, Star } from "lucide-react";
import { useState } from "react";
import { Field, Panel, PrimaryButton, Select } from "@/components/ui/Primitives";
import { NETWORK_OPTIONS, type NetworkKey } from "@/lib/networks";
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
            <button className="rounded-2xl bg-white/10 p-3" onClick={() => toggleFavorite(token.id || token.symbol)} type="button"><Star size={18} /></button>
            <button className="rounded-2xl bg-white/10 p-3" onClick={() => toggleHidden(token.id || token.symbol)} type="button"><EyeOff size={18} /></button>
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

export function AddCustomToken({ defaultNetwork = "bsc" }: { defaultNetwork?: NetworkKey }) {
  const addCustomToken = useTokenStore((state) => state.addCustomToken);
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState<NetworkKey>(defaultNetwork);
  const [decimals, setDecimals] = useState("18");
  return (
    <Panel>
      <div className="mb-4 flex items-center gap-2"><Plus size={20} /><h2 className="text-lg font-semibold">Add custom token</h2></div>
      <div className="grid gap-3">
        <Select value={network} onChange={(event) => setNetwork(event.target.value as NetworkKey)} aria-label="Custom token network">
          {NETWORK_OPTIONS.filter((item) => item.kind === "evm").map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
        </Select>
        <Field placeholder="Token contract address" value={address} onChange={(event) => setAddress(event.target.value)} />
        <Field placeholder="Symbol" value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} />
        <Field placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <Field placeholder="Decimals" inputMode="numeric" value={decimals} onChange={(event) => setDecimals(event.target.value)} />
      </div>
      <PrimaryButton className="mt-4 w-full" onClick={() => {
        if (!symbol || !name || !address) return;
        addCustomToken({ id: `${network}:${address.toLowerCase()}`, network, networkName: NETWORK_OPTIONS.find((item) => item.key === network)?.shortName, symbol, name, address, decimals: Number(decimals) || 18, balance: "0", price: 0, fiatValue: 0, change24h: 0, color: "#38bdf8" });
        setSymbol("");
        setName("");
        setAddress("");
        setDecimals("18");
      }} type="button">Add Token</PrimaryButton>
    </Panel>
  );
}

export function ManageTokensPage({ network }: { network: NetworkKey }) {
  const customTokens = useTokenStore((state) => state.customTokens);
  const hiddenSymbols = useTokenStore((state) => state.hiddenSymbols);
  const favorites = useTokenStore((state) => state.favorites);
  const toggleHidden = useTokenStore((state) => state.toggleHidden);
  const toggleFavorite = useTokenStore((state) => state.toggleFavorite);
  return (
    <div className="space-y-4" data-testid="manage-tokens-screen">
      <Panel>
        <h1 className="text-xl font-semibold">Manage Tokens</h1>
        <p className="mt-2 text-sm text-slate-400">Add EVM custom tokens, hide assets, and pin important tokens. Custom tokens are saved in local storage.</p>
      </Panel>
      <AddCustomToken defaultNetwork={network} />
      <Panel>
        <h2 className="mb-4 text-lg font-semibold">Custom tokens</h2>
        <div className="space-y-2">
          {customTokens.length === 0 ? <div className="rounded-2xl bg-white/[0.045] p-4 text-sm text-slate-400">No custom tokens yet.</div> : null}
          {customTokens.map((token) => {
            const key = token.id || token.symbol;
            return (
              <div key={key} className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.045] p-3">
                <div className="min-w-0">
                  <div className="font-semibold">{token.symbol}</div>
                  <div className="truncate text-xs text-slate-400">{token.name} | {token.networkName}</div>
                </div>
                <div className="flex gap-2">
                  <button className={`rounded-xl p-2 ${favorites.includes(key) ? "bg-accent text-black" : "bg-white/10"}`} onClick={() => toggleFavorite(key)} type="button" aria-label={`Pin ${token.symbol}`}><Star size={15} /></button>
                  <button className="rounded-xl bg-white/10 p-2" onClick={() => toggleHidden(key)} type="button" aria-label={`${hiddenSymbols.includes(key) ? "Show" : "Hide"} ${token.symbol}`}>
                    {hiddenSymbols.includes(key) ? <Eye size={15} /> : <EyeOff size={15} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
