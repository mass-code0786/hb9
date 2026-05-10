"use client";

import { motion } from "framer-motion";
import { Copy, Eye, EyeOff, QrCode, RefreshCcw, Search, Send, Smartphone, Star, WalletCards } from "lucide-react";
import { useWalletTokens } from "@/hooks/useWalletTokens";
import { explorerAddressUrl, getNetworkConfig, NETWORK_OPTIONS, type NetworkKey } from "@/lib/networks";
import { shortAddress } from "@/lib/wallet";
import { useSettingsStore } from "@/store/settingsStore";
import { useTokenStore } from "@/store/tokenStore";
import type { WalletToken } from "@/types/wallet";
import { formatCurrency, timeAgo, trimAmount } from "@/utils/format";
import { Panel, Skeleton } from "@/components/ui/Primitives";
import type { TokenBalance } from "@/lib/types";
import type { WalletTransaction } from "@/types/wallet";

export function HomeDashboard({
  address,
  balances,
  loading,
  balanceVisible,
  network,
  onNetworkChange,
  transactions,
  clipboardNotice,
  onRefresh,
  onScreen,
  onCopyAddress,
  onToggleBalance,
  onTokenDetails
}: {
  address: string;
  balances: TokenBalance;
  loading: boolean;
  balanceVisible: boolean;
  network: NetworkKey;
  onNetworkChange: (network: NetworkKey) => void;
  transactions: WalletTransaction[];
  clipboardNotice: string;
  onRefresh: () => void;
  onScreen: (screen: "send" | "receive" | "recharge" | "qr-pay" | "transactions" | "manage-tokens") => void;
  onCopyAddress: () => void;
  onToggleBalance: () => void;
  onTokenDetails: (token: WalletToken) => void;
}) {
  const currency = useSettingsStore((state) => state.currency);
  const setSearch = useTokenStore((state) => state.setSearch);
  const toggleFavorite = useTokenStore((state) => state.toggleFavorite);
  const toggleHidden = useTokenStore((state) => state.toggleHidden);
  const selectedNetwork = getNetworkConfig(network);
  const { tokens, isFetching } = useWalletTokens(balances, network);
  const total = tokens.reduce((sum, token) => sum + token.fiatValue, 0);
  const addressExplorer = explorerAddressUrl(network, address);

  return (
    <div className="space-y-4 md:grid md:grid-cols-[1fr_360px] md:gap-5 md:space-y-0" data-testid="home-screen">
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-[1.4rem] border border-white/10 bg-white/[0.055] px-4 py-3">
          <Search size={18} className="text-slate-400" />
          <input
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-500"
            placeholder="Search tokens, recharge, dApps"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <motion.div
          className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_10%_10%,rgba(5,196,107,0.25),transparent_12rem),linear-gradient(135deg,#1c2231,#0d111a)] p-5 shadow-wallet"
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 55) onRefresh();
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <select className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none">
              <option>Main Wallet</option>
              <option>Trading Wallet</option>
            </select>
            <select
              className="min-w-0 shrink-0 rounded-2xl border border-accent/30 bg-black/40 px-3 py-2 text-xs text-accent outline-none"
              value={network}
              onChange={(event) => onNetworkChange(event.target.value as NetworkKey)}
              aria-label="Network selector"
              data-testid="network-selector"
            >
              {NETWORK_OPTIONS.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
            </select>
          </div>
          <div className="mt-6 text-center text-sm text-slate-300">Total Balance</div>
          <div className="mt-1 flex items-center justify-center gap-3">
            <div className="text-center text-4xl font-semibold">{balanceVisible ? formatCurrency(total, currency) : "******"}</div>
            <button className="rounded-2xl bg-white/10 p-3" onClick={onToggleBalance} type="button">
              {balanceVisible ? <Eye size={19} /> : <EyeOff size={19} />}
            </button>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-black/20 px-3 py-3">
            <span className="min-w-0 truncate text-sm text-slate-300">{selectedNetwork.addressLabel}: {selectedNetwork.placeholder ? selectedNetwork.addressLabel : shortAddress(address)}</span>
            <button className="flex shrink-0 items-center gap-2 text-sm text-accent" onClick={onCopyAddress} type="button" disabled={selectedNetwork.placeholder}>
              <Copy size={16} /> Copy
            </button>
          </div>
          {addressExplorer ? <a className="mt-3 block text-center text-xs text-accent" href={addressExplorer} target="_blank" rel="noreferrer">Open {selectedNetwork.shortName} explorer</a> : null}
          {clipboardNotice ? <div className="mt-3 rounded-2xl border border-mint/30 bg-mint/10 p-3 text-xs leading-5 text-mint">{clipboardNotice}</div> : null}
          <div className="mt-5 grid grid-cols-5 gap-2">
            <Action icon={Send} label="Send" onClick={() => onScreen("send")} />
            <Action icon={WalletCards} label="Receive" onClick={() => onScreen("receive")} />
            <Action icon={RefreshCcw} label="Swap" onClick={() => onScreen("send")} />
            <Action icon={Smartphone} label="Recharge" onClick={() => onScreen("recharge")} />
            <Action icon={QrCode} label="QR Pay" onClick={() => onScreen("qr-pay")} />
          </div>
        </motion.div>

        <Panel>
          <div className="mb-4 grid grid-cols-3 rounded-2xl bg-white/[0.045] p-1 text-sm">
            {["Crypto", "Recharge", "NFTs"].map((tab) => (
              <button key={tab} className={`rounded-xl py-2 ${tab === "Crypto" ? "bg-accent text-black" : "text-slate-400"}`} type="button">
                {tab}
              </button>
            ))}
          </div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Assets</h2>
            <div className="flex gap-3">
              <button className="text-sm text-accent" onClick={() => onScreen("manage-tokens")} type="button">Manage</button>
              <button className="text-sm text-accent" onClick={onRefresh} type="button">Refresh</button>
            </div>
          </div>
          <div className="space-y-2">
            {(loading || isFetching) && <Skeleton className="h-16" />}
            {tokens.length === 0 && !(loading || isFetching) ? <div className="rounded-2xl bg-white/[0.045] p-4 text-sm text-slate-400">No tokens match your search.</div> : null}
            {tokens.map((token) => (
              <div key={token.id || token.symbol} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white/[0.045] p-3 text-left" data-testid="asset-row">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-bold text-black" style={{ backgroundColor: token.color }}>{token.symbol.slice(0, 1)}</span>
                  <button className="min-w-0 text-left" onClick={() => onTokenDetails(token)} type="button">
                    <span className="block truncate font-semibold">{token.symbol}</span>
                    <span className="block truncate text-xs text-slate-400">{token.name}</span>
                    <span className="mt-1 inline-flex rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-300">{token.networkName}</span>
                  </button>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-right">
                    <span className="block max-w-24 truncate font-semibold">{balanceVisible ? trimAmount(token.balance) : "****"}</span>
                    <span className="block text-xs text-slate-400">{formatCurrency(token.fiatValue, currency)}</span>
                  </span>
                  <button className={`rounded-xl p-2 ${token.favorite ? "bg-accent text-black" : "bg-white/10 text-slate-300"}`} onClick={() => toggleFavorite(token.id || token.symbol)} type="button" aria-label={`Pin ${token.symbol}`}><Star size={15} /></button>
                  <button className="rounded-xl bg-white/10 p-2 text-slate-300" onClick={() => toggleHidden(token.id || token.symbol)} type="button" aria-label={`Hide ${token.symbol}`}><EyeOff size={15} /></button>
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent</h2>
            <button className="text-sm text-accent" onClick={() => onScreen("transactions")} type="button">View all</button>
          </div>
          <div className="space-y-2">
            {transactions.slice(0, 4).map((tx) => (
              <div key={tx.id} className="rounded-2xl bg-white/[0.045] p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{tx.title}</span>
                  <span className={tx.status === "success" ? "text-mint" : tx.status === "failed" ? "text-danger" : "text-accent"}>{tx.status}</span>
                </div>
                <div className="mt-1 flex justify-between text-xs text-slate-400">
                  <span>{tx.amount} {tx.asset}</span>
                  <span>{timeAgo(tx.createdAt)}</span>
                </div>
              </div>
            ))}
            {transactions.length === 0 ? <div className="rounded-2xl bg-white/[0.045] p-4 text-sm text-slate-400">No recent activity yet.</div> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Action({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button className="flex h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl bg-white/10 px-1 text-[10px] leading-none sm:text-[11px]" onClick={onClick} type="button" data-testid={`action-${label.toLowerCase().replace(" ", "-")}`}>
      <Icon size={18} />
      <span className="truncate">{label}</span>
    </button>
  );
}
