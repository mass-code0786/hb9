"use client";

import { ethers } from "ethers";
import { CheckCircle2, Eye, EyeOff, Loader2, Plus, Search, Star, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ErrorText, Field, Panel, PrimaryButton, Select } from "@/components/ui/Primitives";
import { getNetworkConfig, NETWORK_OPTIONS, type NetworkKey } from "@/lib/networks";
import { DEFAULT_TOKENS } from "@/lib/tokens";
import { getEvmTokenMetadata } from "@/services/evmService";
import { useTokenStore } from "@/store/tokenStore";
import type { WalletToken } from "@/types/wallet";
import { formatCurrency, trimAmount } from "@/utils/format";
import { TokenIcon } from "@/components/TokenIcon";

const TOKEN_COLORS = ["#38bdf8", "#05c46b", "#f3ba2f", "#a78bfa", "#fb7185", "#2dd4bf"];

function tokenKey(token: Pick<WalletToken, "id" | "network" | "symbol">) {
  return token.id || `${token.network || "token"}:${token.symbol}`;
}

function defaultWalletTokens(): WalletToken[] {
  return DEFAULT_TOKENS.map((token) => ({
    id: token.id,
    symbol: token.symbol,
    name: token.name,
    balance: "0",
    fiatValue: 0,
    price: token.price,
    change24h: token.change24h,
    address: token.contractAddress,
    decimals: token.decimals,
    network: token.network,
    networkName: getNetworkConfig(token.network).shortName,
    placeholder: token.placeholder,
    color: token.color
  }));
}

export function TokenDetails({ token, onReceive, onSend }: { token: WalletToken | null; onReceive: (token: WalletToken) => void; onSend: (token: WalletToken) => void }) {
  const toggleFavorite = useTokenStore((state) => state.toggleFavorite);
  const toggleHidden = useTokenStore((state) => state.toggleHidden);
  if (!token) return <Panel>Select a token from the home asset list.</Panel>;
  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <TokenIcon token={token} size="lg" />
            <div className="min-w-0">
              <h1 className="truncate text-3xl font-semibold">{token.symbol}</h1>
              <p className="truncate text-slate-400">{token.name}</p>
            </div>
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
        <div className="mt-4 grid grid-cols-2 gap-3">
          <PrimaryButton className="py-3 text-sm" onClick={() => onReceive(token)} type="button">Receive</PrimaryButton>
          <PrimaryButton className="py-3 text-sm" onClick={() => onSend(token)} type="button">Send</PrimaryButton>
        </div>
      </Panel>
    </div>
  );
}

export function AddCustomToken({ defaultNetwork = "bsc" }: { defaultNetwork?: NetworkKey }) {
  const addCustomToken = useTokenStore((state) => state.addCustomToken);
  const customTokens = useTokenStore((state) => state.customTokens);
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState<NetworkKey>(defaultNetwork);
  const [decimals, setDecimals] = useState("18");
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState("");
  const selectedNetwork = getNetworkConfig(network);
  const normalizedAddress = address.trim().toLowerCase();
  const duplicate = useMemo(() => {
    if (!normalizedAddress) return false;
    const defaultDuplicate = DEFAULT_TOKENS.some((token) => token.network === network && token.contractAddress?.toLowerCase() === normalizedAddress);
    const customDuplicate = customTokens.some((token) => token.network === network && token.address?.toLowerCase() === normalizedAddress);
    return defaultDuplicate || customDuplicate;
  }, [customTokens, network, normalizedAddress]);

  useEffect(() => {
    setError("");
    setFetched(false);
    if (!address.trim()) return;
    if (selectedNetwork.kind !== "evm") {
      setError(`${selectedNetwork.shortName} token import is coming soon.`);
      return;
    }
    if (!ethers.isAddress(address.trim())) {
      setError("Enter a valid EVM contract address.");
      return;
    }
    if (duplicate) {
      setError("This token is already imported or already available.");
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const metadata = await getEvmTokenMetadata(network, address.trim());
        if (cancelled) return;
        setName(metadata.name);
        setSymbol(metadata.symbol.toUpperCase());
        setDecimals(String(metadata.decimals));
        setFetched(true);
      } catch {
        if (!cancelled) setError("Could not read token metadata from this contract.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [address, duplicate, network, selectedNetwork.kind, selectedNetwork.shortName]);

  function submit() {
    setError("");
    if (selectedNetwork.kind !== "evm") {
      setError(`${selectedNetwork.shortName} token import is coming soon.`);
      return;
    }
    if (!ethers.isAddress(address.trim())) {
      setError("Enter a valid EVM contract address.");
      return;
    }
    if (duplicate) {
      setError("This token is already imported or already available.");
      return;
    }
    if (!symbol.trim() || !name.trim()) {
      setError("Token symbol and name are required.");
      return;
    }
    const parsedDecimals = Number(decimals);
    if (!Number.isInteger(parsedDecimals) || parsedDecimals < 0 || parsedDecimals > 36) {
      setError("Enter token decimals between 0 and 36.");
      return;
    }
    const id = `${network}:${address.trim().toLowerCase()}`;
    addCustomToken({
      id,
      network,
      networkName: selectedNetwork.shortName,
      symbol: symbol.trim().toUpperCase(),
      name: name.trim(),
      address: address.trim(),
      decimals: parsedDecimals,
      balance: "0",
      price: 0,
      fiatValue: 0,
      change24h: 0,
      color: TOKEN_COLORS[Math.abs(id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)) % TOKEN_COLORS.length]
    });
    setSymbol("");
    setName("");
    setAddress("");
    setDecimals("18");
    setFetched(false);
  }

  return (
    <Panel className="bg-[radial-gradient(circle_at_15%_0%,rgba(5,196,107,0.12),transparent_12rem),rgba(16,20,29,0.92)]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Plus size={20} /><h2 className="text-lg font-semibold">Import Token</h2></div>
        {loading ? <Loader2 className="animate-spin text-accent" size={18} /> : fetched ? <CheckCircle2 className="text-mint" size={18} /> : null}
      </div>
      <div className="grid gap-3">
        <Select value={network} onChange={(event) => setNetwork(event.target.value as NetworkKey)} aria-label="Custom token network">
          {NETWORK_OPTIONS.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
        </Select>
        <Field placeholder="Token contract address" value={address} onChange={(event) => setAddress(event.target.value)} disabled={selectedNetwork.kind !== "evm"} />
        <div className="grid grid-cols-2 gap-3">
          <Field placeholder="Token symbol" value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} disabled={loading || selectedNetwork.kind !== "evm"} />
          <Field placeholder="Token decimals" inputMode="numeric" value={decimals} onChange={(event) => setDecimals(event.target.value)} disabled={loading || selectedNetwork.kind !== "evm"} />
        </div>
        <Field placeholder="Token name" value={name} onChange={(event) => setName(event.target.value)} disabled={loading || selectedNetwork.kind !== "evm"} />
      </div>
      {selectedNetwork.kind !== "evm" ? <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-sm text-slate-300">{selectedNetwork.addressLabel}</div> : null}
      <ErrorText error={error} />
      <PrimaryButton className="mt-4 w-full" onClick={submit} disabled={loading || selectedNetwork.kind !== "evm"} type="button">
        {loading ? "Fetching Token" : "Import Token"}
      </PrimaryButton>
    </Panel>
  );
}

export function ManageTokensPage({ network, importOpen = false, onImportOpenChange }: { network: NetworkKey; importOpen?: boolean; onImportOpenChange?: (open: boolean) => void }) {
  const customTokens = useTokenStore((state) => state.customTokens);
  const hiddenSymbols = useTokenStore((state) => state.hiddenSymbols);
  const favorites = useTokenStore((state) => state.favorites);
  const toggleHidden = useTokenStore((state) => state.toggleHidden);
  const toggleFavorite = useTokenStore((state) => state.toggleFavorite);
  const [query, setQuery] = useState("");
  const [showImport, setShowImport] = useState(false);
  const allTokens = useMemo(() => [...defaultWalletTokens(), ...customTokens], [customTokens]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredImported = customTokens.filter((token) => matchesToken(token, normalizedQuery));
  const hiddenTokens = allTokens.filter((token) => hiddenSymbols.includes(tokenKey(token)) && matchesToken(token, normalizedQuery));
  const importVisible = onImportOpenChange ? importOpen : showImport;
  const setImportVisible = onImportOpenChange || setShowImport;

  return (
    <div className="space-y-4" data-testid="manage-tokens-screen">
      <Panel>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Manage Tokens</h1>
          </div>
          <PrimaryButton className="shrink-0 px-3 py-2 text-sm" onClick={() => setImportVisible(true)} type="button">+ Import Token</PrimaryButton>
        </div>
        <label className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
          <Search size={17} className="text-slate-400" />
          <input className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search token name, symbol, or network" />
        </label>
      </Panel>

      {importVisible ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 px-3 pb-3 pt-12 backdrop-blur-sm sm:items-center sm:justify-center">
          <div className="w-full max-w-md">
            <div className="mb-3 flex justify-end">
              <button className="rounded-2xl bg-white/10 p-3" onClick={() => setImportVisible(false)} type="button" aria-label="Close import token"><X size={18} /></button>
            </div>
            <AddCustomToken defaultNetwork={network} />
          </div>
        </div>
      ) : null}

      <Panel>
        <h2 className="mb-4 text-lg font-semibold">Imported tokens</h2>
        <div className="space-y-2">
          {filteredImported.length === 0 ? <div className="rounded-2xl bg-white/[0.045] p-4 text-sm text-slate-400">No imported tokens match your search.</div> : null}
          {filteredImported.map((token) => <ManageTokenRow key={tokenKey(token)} token={token} favorites={favorites} hiddenSymbols={hiddenSymbols} onFavorite={toggleFavorite} onHidden={toggleHidden} />)}
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-4 text-lg font-semibold">Hidden tokens</h2>
        <div className="space-y-2">
          {hiddenTokens.length === 0 ? <div className="rounded-2xl bg-white/[0.045] p-4 text-sm text-slate-400">No hidden tokens match your search.</div> : null}
          {hiddenTokens.map((token) => <ManageTokenRow key={tokenKey(token)} token={token} favorites={favorites} hiddenSymbols={hiddenSymbols} onFavorite={toggleFavorite} onHidden={toggleHidden} />)}
        </div>
      </Panel>
    </div>
  );
}

function matchesToken(token: WalletToken, query: string) {
  if (!query) return true;
  return token.symbol.toLowerCase().includes(query) || token.name.toLowerCase().includes(query) || (token.networkName || "").toLowerCase().includes(query);
}

function ManageTokenRow({
  token,
  favorites,
  hiddenSymbols,
  onFavorite,
  onHidden
}: {
  token: WalletToken;
  favorites: string[];
  hiddenSymbols: string[];
  onFavorite: (key: string) => void;
  onHidden: (key: string) => void;
}) {
  const key = tokenKey(token);
  const hidden = hiddenSymbols.includes(key);
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.045] p-3">
      <div className="flex min-w-0 items-center gap-3">
        <TokenIcon token={token} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{token.symbol}</span>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-300">{token.networkName}</span>
          </div>
          <div className="truncate text-xs text-slate-400">{token.name}</div>
          <div className="mt-1 text-xs text-slate-500">{trimAmount(token.balance || "0")} | {formatCurrency(token.fiatValue || 0)}</div>
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <button className={`rounded-xl p-2 ${favorites.includes(key) ? "bg-accent text-black" : "bg-white/10"}`} onClick={() => onFavorite(key)} type="button" aria-label={`Pin ${token.symbol}`}><Star size={15} /></button>
        <button className="rounded-xl bg-white/10 p-2" onClick={() => onHidden(key)} type="button" aria-label={`${hidden ? "Show" : "Hide"} ${token.symbol}`}>
          {hidden ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
      </div>
    </div>
  );
}
