"use client";

import { useEffect, useState } from "react";
import { LogOut, Wallet, Wifi, WifiOff } from "lucide-react";
import { isHbDevDashboardBypassEnabled, requestHbWalletChallenge, saveHbDevWallet, verifyHbWalletSignature, type HbUser } from "@/services/halalBusinessService";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

const BSC_CHAIN_ID = Number(process.env.NEXT_PUBLIC_HB_CHAIN_ID || process.env.NEXT_PUBLIC_BSC_CHAIN_ID || 56);
const BSC_LABEL = BSC_CHAIN_ID === 56 ? "BSC Mainnet" : "BSC";
const HB_DEV_DASHBOARD_BYPASS = isHbDevDashboardBypassEnabled();

function getEthereum() {
  if (typeof window === "undefined") return null;
  return (window as unknown as { ethereum?: EthereumProvider }).ethereum || null;
}

function shortAddress(address: string) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
}

function parseChainId(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return value.startsWith("0x") ? Number.parseInt(value, 16) : Number(value);
  return 0;
}

export function ExternalWalletConnect({ compact = false, minimal = false, hero = false, heroTone = "primary", authenticate = false, referralCode = "", buttonLabel = "Connect Wallet", onAuthenticated }: {
  compact?: boolean;
  minimal?: boolean;
  hero?: boolean;
  heroTone?: "primary" | "secondary";
  authenticate?: boolean;
  referralCode?: string;
  buttonLabel?: string;
  onAuthenticated?: (token: string, user: HbUser) => void;
}) {
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const connected = Boolean(address);
  const onBsc = connected && chainId === BSC_CHAIN_ID;
  const statusText = connected ? (onBsc ? BSC_LABEL : "Wrong network") : `${BSC_LABEL} ready`;

  async function refresh(provider = getEthereum()) {
    if (!provider) return;
    const [accounts, chain] = await Promise.all([
      provider.request({ method: "eth_accounts" }).catch(() => []),
      provider.request({ method: "eth_chainId" }).catch(() => "0x0")
    ]);
    setAddress(Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "");
    setChainId(parseChainId(chain));
  }

  useEffect(() => {
    const provider = getEthereum();
    if (!provider) return;
    refresh(provider);
    const accountsChanged = (accounts: unknown) => setAddress(Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "");
    const chainChanged = (nextChainId: unknown) => setChainId(parseChainId(nextChainId));
    provider.on?.("accountsChanged", accountsChanged);
    provider.on?.("chainChanged", chainChanged);
    return () => {
      provider.removeListener?.("accountsChanged", accountsChanged);
      provider.removeListener?.("chainChanged", chainChanged);
    };
  }, []);

  async function connect() {
    setBusy(true);
    setMessage("");
    try {
      const provider = getEthereum();
      if (!provider) {
        setMessage("External wallet not found. Open HB9 in a BSC wallet browser or install MetaMask.");
        return;
      }
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      const chain = await provider.request({ method: "eth_chainId" });
      const nextAddress = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
      const nextChainId = parseChainId(chain);
      setAddress(nextAddress);
      setChainId(nextChainId);
      if (!nextAddress) {
        setMessage("Wallet account was not returned.");
        return;
      }
      if (nextChainId !== BSC_CHAIN_ID) {
        setMessage(`Switch wallet to ${BSC_LABEL} to continue.`);
        return;
      }
      if (HB_DEV_DASHBOARD_BYPASS) {
        saveHbDevWallet(nextAddress);
        if (window.location.pathname !== "/halal-business") {
          window.location.assign("/halal-business");
        }
        return;
      }
      if (authenticate) {
        const challenge = await requestHbWalletChallenge({ walletAddress: nextAddress, chainId: nextChainId || BSC_CHAIN_ID, referralCode });
        const signature = await provider.request({ method: "personal_sign", params: [challenge.message, nextAddress] });
        if (typeof signature !== "string") {
          setMessage("Wallet signature was cancelled.");
          return;
        }
        const response = await verifyHbWalletSignature({ walletAddress: nextAddress, chainId: challenge.chainId, nonce: challenge.nonce, signature });
        onAuthenticated?.(response.token, response.user);
        setMessage("");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Wallet connection failed.");
    } finally {
      setBusy(false);
    }
  }

  function disconnect() {
    setAddress("");
    setChainId(0);
    setMessage("Wallet disconnected from this session. Reconnect from your external wallet when ready.");
  }

  const buttonClass = hero
    ? `tap-feedback inline-flex min-h-[52px] w-full min-w-0 flex-none items-center justify-center gap-2 rounded-2xl border px-5 text-sm font-semibold shadow-[0_0_30px_rgba(34,211,238,0.18)] backdrop-blur-xl transition ${
      connected
        ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-50 hover:bg-cyan-300/15"
        : heroTone === "secondary"
          ? "border-cyan-200/20 bg-white/[0.055] text-cyan-50 hover:border-cyan-200/35 hover:bg-white/[0.085]"
          : "border-cyan-200/35 bg-cyan-300/10 text-cyan-50 hover:border-cyan-100/50 hover:bg-cyan-300/15"
    }`
    : `tap-feedback inline-flex min-w-0 flex-1 items-center justify-center gap-2 border px-3 text-xs font-semibold shadow-[0_0_16px_rgba(56,189,248,0.08)] backdrop-blur-xl sm:flex-none ${minimal ? "min-h-12 rounded-xl py-3" : "min-h-10 rounded-2xl py-2"} ${
      connected
        ? "border-cyan-300/25 bg-cyan-300/10 text-cyan-50 hover:bg-cyan-300/15"
        : minimal ? "border-cyan-200/20 bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 text-[#04111f] hover:shadow-[0_0_28px_rgba(56,189,248,0.22)]" : "border-sky-200/15 bg-[#0b1728]/75 text-slate-100 hover:bg-[#0b1728]/90"
    }`;

  return (
    <div className={`min-w-0 ${compact ? "w-full sm:w-auto" : "w-full"}`}>
      <div className={`flex min-w-0 items-center gap-2 ${hero ? "w-full flex-nowrap" : "flex-wrap"}`}>
        <button
          className={buttonClass}
          onClick={connect}
          disabled={busy}
          type="button"
          aria-label={connected && !onBsc ? `Switch wallet to ${BSC_LABEL}` : "Connect external wallet"}
          title="External wallet connection for package purchases, USDT BEP20 approvals, contract interactions, wallet proof, and BscScan transaction proof."
        >
          <Wallet size={15} />
          <span className="truncate">{busy ? "Please wait" : buttonLabel}</span>
        </button>
        {!minimal ? (
          <span className={`status-pill shrink-0 ${onBsc ? "status-pill-success" : connected ? "status-pill-warning" : ""}`}>
            {onBsc ? <Wifi size={12} /> : <WifiOff size={12} />}
            {statusText}
          </span>
        ) : null}
        {connected && !minimal ? (
          <button className="tap-feedback inline-flex min-h-10 items-center justify-center rounded-2xl border border-sky-200/15 bg-[#0b1728]/75 px-3 text-sky-100/75" onClick={disconnect} type="button" aria-label="Disconnect wallet session">
            <LogOut size={14} />
          </button>
        ) : null}
      </div>
      {message ? <div className="mt-2 text-xs leading-5 text-yellow-100">{message}</div> : null}
    </div>
  );
}
