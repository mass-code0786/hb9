"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Copy, Eye, EyeOff, PackageCheck, Send, Users, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { useSettingsStore } from "@/store/settingsStore";
import type { AppTab, WalletScreen } from "@/types/wallet";
import { formatCurrency, timeAgo } from "@/utils/format";
import { EmptyState, ErrorText, Field, Panel, PrimaryButton, SecondaryButton } from "@/components/ui/Primitives";
import { ExternalWalletConnect } from "@/components/wallet/ExternalWalletConnect";
import { CoinLogo } from "@/components/crypto/CoinLogo";
import type { WalletTransaction } from "@/types/wallet";
import { bindHbWalletAddress, fetchHbCoinHistory, fetchHbCoins, fetchHbMe, fetchHbPurchases, fetchHbWallet, fetchHbWalletAddress, getHbToken, type HbCoinBalance, type HbCoinLedgerEntry } from "@/services/halalBusinessService";

const DEV_BOUND_WALLET_KEY = "bitzenx.hb.usdtBep20Address";
const defaultCoins: HbCoinBalance[] = [
  { coin_symbol: "USDT", name: "USDT BEP20", symbol: "USDT", balance: "0", usd_price: "1" },
  { coin_symbol: "BTC", name: "Bitcoin", symbol: "BTC", balance: "0", usd_price: "0" },
  { coin_symbol: "BNB", name: "Binance Coin", symbol: "BNB", balance: "0", usd_price: "0" },
  { coin_symbol: "HB9", name: "HB9", symbol: "HB9 COIN", balance: "0", usd_price: "0" },
  { coin_symbol: "PEPE", name: "Pepe", symbol: "PEPE", balance: "0" },
  { coin_symbol: "DOGE", name: "Dogecoin", symbol: "DOGE", balance: "0" },
  { coin_symbol: "SHIB", name: "SHIBA", symbol: "SHIBA", balance: "0" },
  { coin_symbol: "BTTC", name: "BitTorrent Chain", symbol: "BTTC", balance: "0" },
  { coin_symbol: "ADA", name: "Cardano", symbol: "ADA", balance: "0" }
];

export function HomeDashboard({
  accountId,
  balanceVisible,
  transactions,
  onScreen,
  onTab,
  onToggleBalance
}: {
  accountId: string;
  balanceVisible: boolean;
  transactions: WalletTransaction[];
  onScreen: (screen: WalletScreen) => void;
  onTab: (tab: Extract<AppTab, "products" | "team">) => void;
  onToggleBalance: () => void;
}) {
  const currency = useSettingsStore((state) => state.currency);
  const [hbSummary, setHbSummary] = useState({
    mainWallet: "0",
    idStatus: "inactive",
    currentPackage: "None",
    boundAddress: ""
  });
  const total = Number(hbSummary.mainWallet || 0);
  const [bindOpen, setBindOpen] = useState(false);
  const [bindAddress, setBindAddress] = useState("");
  const [bindError, setBindError] = useState("");
  const [bindNotice, setBindNotice] = useState("");
  const [confirmChange, setConfirmChange] = useState(false);
  const [coins, setCoins] = useState<HbCoinBalance[]>(defaultCoins);
  const [coinHistoryOpen, setCoinHistoryOpen] = useState(false);
  const [coinHistory, setCoinHistory] = useState<HbCoinLedgerEntry[]>([]);
  const [coinFilter, setCoinFilter] = useState("");
  const [coinHistoryError, setCoinHistoryError] = useState("");

  useEffect(() => {
    const token = getHbToken();
    if (!token) {
      const devAddress = window.localStorage.getItem(DEV_BOUND_WALLET_KEY) || "";
      setHbSummary((current) => ({ ...current, boundAddress: devAddress }));
      return;
    }
    let active = true;
    Promise.all([fetchHbMe(token), fetchHbWallet(token), fetchHbPurchases(token), fetchHbWalletAddress(token), fetchHbCoins(token)])
      .then(([me, wallet, purchases, walletAddress, coinData]) => {
        if (!active) return;
        setHbSummary({
          mainWallet: wallet.balances.deposit,
          idStatus: me.user.status,
          currentPackage: purchases.items[0]?.package_name || "None",
          boundAddress: walletAddress.usdt_bep20_address || me.user.usdt_bep20_address || ""
        });
        setCoins(coinData.items.length ? coinData.items : defaultCoins);
      })
      .catch(() => {
        const devAddress = window.localStorage.getItem(DEV_BOUND_WALLET_KEY) || "";
        setHbSummary((current) => ({ ...current, boundAddress: devAddress }));
      });
    return () => {
      active = false;
    };
  }, []);

  function openBindModal() {
    setBindAddress(hbSummary.boundAddress);
    setBindError("");
    setBindNotice("");
    setConfirmChange(false);
    setBindOpen(true);
  }

  async function copyBoundAddress() {
    if (!hbSummary.boundAddress) return;
    await navigator.clipboard.writeText(hbSummary.boundAddress);
    setBindNotice("Wallet address copied.");
  }

  async function saveBoundAddress() {
    const nextAddress = bindAddress.trim();
    setBindError("");
    setBindNotice("");
    if (!/^0x[a-fA-F0-9]{40}$/.test(nextAddress)) {
      setBindError("Enter a valid USDT BEP20 wallet address.");
      return;
    }
    const changing = Boolean(hbSummary.boundAddress && hbSummary.boundAddress.toLowerCase() !== nextAddress.toLowerCase());
    if (changing && !confirmChange) {
      setConfirmChange(true);
      setBindError("Changing wallet address may affect withdrawals.");
      return;
    }
    const token = getHbToken();
    try {
      if (token) await bindHbWalletAddress(token, nextAddress, Boolean(hbSummary.boundAddress));
      else window.localStorage.setItem(DEV_BOUND_WALLET_KEY, nextAddress);
      setHbSummary((current) => ({ ...current, boundAddress: nextAddress }));
      setBindNotice("USDT BEP20 wallet address saved.");
      setBindOpen(false);
    } catch (err) {
      if (!token) {
        window.localStorage.setItem(DEV_BOUND_WALLET_KEY, nextAddress);
        setHbSummary((current) => ({ ...current, boundAddress: nextAddress }));
        setBindOpen(false);
        return;
      }
      setBindError(err instanceof Error ? err.message : "Wallet address could not be saved.");
    }
  }

  async function openCoinHistory(symbol = "") {
    setCoinFilter(symbol);
    setCoinHistoryError("");
    setCoinHistoryOpen(true);
    const token = getHbToken();
    if (!token) {
      setCoinHistory([]);
      return;
    }
    try {
      const history = await fetchHbCoinHistory(token, symbol || undefined);
      setCoinHistory(history.items);
    } catch (err) {
      setCoinHistoryError(err instanceof Error ? err.message : "Coin history could not be loaded.");
    }
  }

  async function changeCoinFilter(symbol: string) {
    setCoinFilter(symbol);
    const token = getHbToken();
    if (!token) return;
    try {
      const history = await fetchHbCoinHistory(token, symbol || undefined);
      setCoinHistory(history.items);
    } catch (err) {
      setCoinHistoryError(err instanceof Error ? err.message : "Coin history could not be loaded.");
    }
  }

  return (
    <div className="space-y-4 pb-4 md:grid md:grid-cols-[1fr_360px] md:gap-5 md:space-y-0" data-testid="home-screen">
      <div className="space-y-4">
        <motion.div
          className="overflow-hidden rounded-[1.75rem] border border-cyan-300/25 bg-[radial-gradient(circle_at_12%_0%,rgba(34,211,238,0.3),transparent_12rem),radial-gradient(circle_at_90%_18%,rgba(59,130,246,0.22),transparent_10rem),linear-gradient(135deg,rgba(11,23,40,0.9),rgba(6,17,31,0.72))] p-4 shadow-wallet backdrop-blur-xl ring-1 ring-cyan-300/[0.08]"
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-cyan-100/70">HB9 Wallet ID</div>
              <div className="mt-1 max-w-[13rem] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-sm text-sky-100">{accountId}</div>
            </div>
            <button className="rounded-2xl border border-cyan-300/20 bg-[#0b1728]/75 p-2.5 text-white shadow-[0_0_20px_rgba(34,211,238,0.16)] transition hover:border-cyan-300/40 hover:bg-cyan-400/[0.12]" onClick={onToggleBalance} type="button" aria-label={balanceVisible ? "Hide balance" : "Show balance"}>
              {balanceVisible ? <Eye size={19} /> : <EyeOff size={19} />}
            </button>
          </div>
          <div className="mt-2 text-4xl font-semibold leading-tight text-white">{balanceVisible ? formatCurrency(total, currency) : "******"}</div>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-cyan-300/20 bg-[#0b1728]/75 px-3 py-2.5 shadow-[0_0_18px_rgba(34,211,238,0.08),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-xl">
            <span className="min-w-0 truncate text-sm text-sky-100/90">Internal HB9 balance only</span>
            <button className="flex shrink-0 items-center gap-2 text-sm font-semibold text-sky-200 transition hover:text-white" onClick={() => navigator.clipboard.writeText(accountId)} type="button">
              <Copy size={16} /> Copy ID
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <CompactBalance label="Main Wallet" value={formatCurrency(Number(hbSummary.mainWallet || 0), currency)} />
            <CompactBalance label="ID Status" value={hbSummary.idStatus} />
            <CompactBalance label="Current Package" value={hbSummary.currentPackage} />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2.5">
            <Action icon={WalletCards} label="Deposit" onClick={() => onScreen("deposit")} />
            <Action icon={Send} label="Withdrawal" onClick={() => onScreen("withdrawal")} />
            <Action icon={PackageCheck} label="Products" onClick={() => onTab("products")} />
            <Action icon={Users} label="Team" onClick={() => onTab("team")} />
          </div>
        </motion.div>

        <section className="rounded-[1.45rem] border border-cyan-300/20 bg-cyan-300/[0.06] p-3 shadow-[0_0_32px_rgba(34,211,238,0.12)] backdrop-blur-2xl ring-1 ring-cyan-300/[0.08]">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <div>
              <h2 className="text-lg font-semibold">HB9 Portfolio</h2>
              <p className="mt-1 text-xs text-sky-100/65">Internal decentralized business wallet balances</p>
            </div>
            <button className="rounded-full border border-cyan-300/25 bg-[#0b1728]/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-200/50 hover:text-white" onClick={() => openCoinHistory()} type="button">History</button>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {coins.map((coin) => <CoinCard key={coin.coin_symbol} coin={coin} onHistory={() => openCoinHistory(coin.coin_symbol)} />)}
          </div>
        </section>

        <Panel data-testid="usdt-wallet-section">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">USDT BEP20 Wallet</h2>
              <p className="mt-1 text-sm text-slate-400">Bind the BSC address used for withdrawals.</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${hbSummary.boundAddress ? "border-mint/30 bg-mint/10 text-mint" : "border-yellow-400/30 bg-yellow-400/10 text-yellow-100"}`}>
              {hbSummary.boundAddress ? "Bound" : "Not Bound"}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <WalletInfoCard label="Wallet Address" value={hbSummary.boundAddress || "Not bound"} mono />
            <WalletInfoCard label="Network" value="BEP20 / BSC" />
            <WalletInfoCard label="Status" value={hbSummary.boundAddress ? "Bound" : "Not Bound"} />
            <WalletInfoCard label="Available" value={formatCurrency(Number(hbSummary.mainWallet || 0), currency)} />
          </div>
          {bindNotice ? <div className="mt-3 flex items-center gap-2 rounded-2xl border border-mint/30 bg-mint/10 p-3 text-sm text-mint"><CheckCircle2 size={16} /> {bindNotice}</div> : null}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <PrimaryButton onClick={openBindModal} type="button">{hbSummary.boundAddress ? "Change Wallet Address" : "Bind Wallet Address"}</PrimaryButton>
            <SecondaryButton onClick={copyBoundAddress} disabled={!hbSummary.boundAddress} type="button">Copy Address</SecondaryButton>
          </div>
        </Panel>
        <Panel>
          <div className="mb-4">
            <h2 className="text-lg font-semibold">External Wallet</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">Connect MetaMask, Trust Wallet, TokenPocket, or a WalletConnect-compatible BSC wallet for future USDT BEP20 approvals, contract interactions, wallet proof, and BscScan transaction proof.</p>
          </div>
          <ExternalWalletConnect />
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
              <div key={tx.id} className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-3 shadow-[0_0_18px_rgba(56,189,248,0.08)]">
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
            {transactions.length === 0 ? <EmptyState title="No activity yet" detail="Your deposits, withdrawals, and package activity will appear here." /> : null}
          </div>
        </Panel>
      </div>
      {bindOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-3 pb-3 backdrop-blur-sm sm:items-center sm:pb-0">
          <div className="w-full max-w-md rounded-[1.6rem] border border-sky-200/15 bg-[#071827]/90 p-4 shadow-wallet backdrop-blur-2xl">
            <h2 className="text-xl font-semibold">{hbSummary.boundAddress ? "Change Wallet Address" : "Bind Wallet Address"}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Enter your USDT BEP20 wallet address. Withdrawals will use this address by default.</p>
            {hbSummary.boundAddress ? <div className="mt-3 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-3 text-sm text-yellow-100">Changing wallet address may affect withdrawals.</div> : null}
            <Field className="mt-4" value={bindAddress} onChange={(event) => { setBindAddress(event.target.value); setConfirmChange(false); setBindError(""); }} placeholder="0x..." />
            <ErrorText error={bindError} />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <SecondaryButton onClick={() => setBindOpen(false)} type="button">Cancel</SecondaryButton>
              <PrimaryButton onClick={saveBoundAddress} type="button">{confirmChange ? "Confirm Change" : "Save Address"}</PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
      {coinHistoryOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-3 pb-3 backdrop-blur-sm sm:items-center sm:pb-0">
          <div className="max-h-[88dvh] w-full max-w-2xl overflow-hidden rounded-[1.6rem] border border-cyan-300/20 bg-[#071827]/92 p-4 shadow-wallet backdrop-blur-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Coin History</h2>
                <p className="mt-1 text-sm text-sky-100/60">Credits, debits, source references, and admin notes.</p>
              </div>
              <button className="rounded-xl border border-cyan-300/20 bg-[#0b1728]/75 px-3 py-2 text-sm text-sky-100" onClick={() => setCoinHistoryOpen(false)} type="button">Close</button>
            </div>
            <select className="field mb-3" value={coinFilter} onChange={(event) => changeCoinFilter(event.target.value)}>
              <option value="">All coins</option>
              {defaultCoins.map((coin) => <option key={coin.coin_symbol} value={coin.coin_symbol}>{displayCoinSymbol(coin.coin_symbol)}</option>)}
            </select>
            {coinHistoryError ? <ErrorText error={coinHistoryError} /> : null}
            <div className="max-h-[58dvh] space-y-2 overflow-y-auto pr-1">
              {coinHistory.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-cyan-300/15 bg-[#0b1728]/70 p-3 shadow-[0_0_18px_rgba(34,211,238,0.08)]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 font-semibold text-white"><CoinLogo symbol={entry.coin_symbol} size={24} /> {displayCoinSymbol(entry.coin_symbol)} {formatCoinAmount(entry.amount)}</div>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${entry.direction === "credit" ? "bg-mint/15 text-mint" : "bg-danger/15 text-red-100"}`}>{entry.direction}</span>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-sky-100/65 sm:grid-cols-2">
                    <span>Source: {entry.type}</span>
                    <span>Reference: {entry.reference || "-"}</span>
                    <span>Note: {entry.note || "-"}</span>
                    <span>Date: {formatDateTime(entry.created_at)}</span>
                  </div>
                </div>
              ))}
              {coinHistory.length === 0 ? <EmptyState title="No coin history" detail="Credits and debits will appear here after portfolio activity." /> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatCoinAmount(value: string | number) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return "0.0000";
  return amount.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 8 });
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function displayCoinSymbol(symbol: string) {
  const upper = symbol.toUpperCase();
  if (upper === "BTCT") return "BTTC";
  if (upper === "SHIB") return "SHIBA";
  return symbol;
}

function CoinCard({ coin, onHistory }: { coin: HbCoinBalance; onHistory: () => void }) {
  const price = coin.usd_price === null || coin.usd_price === undefined ? null : Number(coin.usd_price);
  const balance = Number(coin.balance || 0);
  const usdValue = price !== null && Number.isFinite(price) ? `$${(balance * price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "USD value pending";
  const coinKey = String(coin.coin_symbol).toUpperCase();
  const title = coinKey === "HB9" ? "HB9" : coin.name;
  const symbol = coinKey === "HB9" ? "HB9 COIN" : displayCoinSymbol(coin.symbol || coin.coin_symbol);
  return (
    <button className="group min-w-0 rounded-2xl border border-cyan-300/20 bg-[#0b1728]/55 p-3 text-left shadow-[0_0_18px_rgba(34,211,238,0.1),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl transition hover:border-cyan-200/40 hover:bg-cyan-300/[0.08] hover:shadow-[0_0_28px_rgba(34,211,238,0.18)]" onClick={onHistory} type="button">
      <div className="flex items-center gap-2.5">
        <CoinLogo symbol={coin.coin_symbol} size={40} />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{title}</div>
          <div className="text-xs font-semibold text-cyan-100/70">{symbol}</div>
        </div>
      </div>
      <div className="mt-3 truncate text-base font-semibold text-sky-50">{formatCoinAmount(coin.balance)}</div>
      <div className="mt-1 truncate text-[11px] text-sky-100/55">{usdValue}</div>
    </button>
  );
}

function CompactBalance({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-cyan-300/20 bg-[#0b1728]/75 px-3 py-2 shadow-[0_0_14px_rgba(34,211,238,0.08),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl">
      <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-sky-200/75">{label}</div>
      <div className="mt-1 truncate text-xs font-semibold text-white">{value}</div>
    </div>
  );
}

function WalletInfoCard({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-2xl border border-cyan-300/20 bg-[#0b1728]/75 p-3 shadow-[0_0_18px_rgba(34,211,238,0.1)] backdrop-blur-xl">
      <div className="text-xs text-sky-200/75">{label}</div>
      <div className={`mt-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-white ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}

function Action({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <motion.button whileTap={{ scale: 0.95 }} whileHover={{ y: -1 }} className="flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border border-cyan-300/20 bg-[#0b1728]/75 px-1 text-[10px] leading-none text-white shadow-[0_0_18px_rgba(34,211,238,0.12),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-xl transition hover:border-cyan-300/40 hover:bg-cyan-400/[0.12] sm:text-[11px]" onPointerDown={(event) => event.stopPropagation()} onClick={onClick} type="button" data-testid={`action-${label.toLowerCase().replace(" ", "-")}`}>
      <Icon size={18} />
      <span className="truncate">{label}</span>
    </motion.button>
  );
}
