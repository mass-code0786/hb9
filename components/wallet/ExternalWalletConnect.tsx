"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, LogOut, QrCode, Wallet, Wifi, WifiOff, X } from "lucide-react";
import { useConnect, useConnectors } from "wagmi";
import { createPublicClient, encodeFunctionData, http, parseUnits, type Hash } from "viem";
import { bsc } from "viem/chains";
import type { Connector } from "wagmi";
import { HB_ACTIVE_WALLET_KEY, clearHbSessionStorageState, fetchHbMe, fetchHbMyProducts, fetchHbWallet, hbWalletScopedStorageKey, isHbDevDashboardBypassEnabled, normalizeHbWalletAddress, requestHbWalletChallenge, saveHbDevWallet, saveHbToken, verifyHbRegistrationFee, verifyHbWalletSignature, type HbRegistrationFee, type HbUser, type HbWalletAuthMode } from "@/services/halalBusinessService";
import { BSC_RPC_URL } from "@/lib/config";
import { walletConnectProjectId } from "@/lib/wagmiConfig";
import { initialTx, useWalletStore } from "@/store/walletStore";
import { useTransactionStore } from "@/store/transactionStore";
import { useTokenStore } from "@/store/tokenStore";
import { useRechargeStore } from "@/store/rechargeStore";

type EthereumProvider = {
  isMetaMask?: boolean;
  isTokenPocket?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  isOkxWallet?: boolean;
  isOKExWallet?: boolean;
  providers?: EthereumProvider[];
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

type WalletProviderInfo = {
  id: string;
  name: string;
  provider: EthereumProvider;
  injected: true;
};

type WalletWindow = Window & {
  ethereum?: EthereumProvider;
  tokenpocket?: { ethereum?: EthereumProvider };
  trustwallet?: EthereumProvider;
  okxwallet?: EthereumProvider & { ethereum?: EthereumProvider };
};

const BSC_CHAIN_ID = Number(process.env.NEXT_PUBLIC_HB_CHAIN_ID || process.env.NEXT_PUBLIC_BSC_CHAIN_ID || 56);
const BSC_HEX_CHAIN_ID = `0x${BSC_CHAIN_ID.toString(16)}`;
const BSC_LABEL = BSC_CHAIN_ID === 56 ? "BSC Mainnet" : "BSC";
const HB_DEV_DASHBOARD_BYPASS = isHbDevDashboardBypassEnabled();
const ADMIN_TOKEN_KEY = "hb9.admin.token";
const USDT_BEP20_ADDRESS = process.env.NEXT_PUBLIC_USDT_TOKEN_ADDRESS || process.env.NEXT_PUBLIC_USDT_BEP20_ADDRESS || process.env.NEXT_PUBLIC_USDT_CONTRACT || "0x55d398326f99059fF775485246999027B3197955";
const bscPublicClient = createPublicClient({ chain: bsc, transport: http(BSC_RPC_URL) });
const ERC20_TRANSFER_ABI = [{
  type: "function",
  name: "transfer",
  stateMutability: "nonpayable",
  inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
  outputs: [{ name: "", type: "bool" }]
}] as const;

const BSC_ADD_CHAIN_PARAMS = {
  chainId: BSC_HEX_CHAIN_ID,
  chainName: "BNB Smart Chain",
  nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
  rpcUrls: [process.env.NEXT_PUBLIC_BSC_RPC_URL || "https://bsc-dataseed.binance.org"],
  blockExplorerUrls: ["https://bscscan.com"]
};

let globalAuthPending = false;
let globalLastAuthClickAt = 0;

function providerMatches(provider: EthereumProvider, id: string) {
  if (id === "metamask") return Boolean(provider.isMetaMask);
  if (id === "tokenpocket") return Boolean(provider.isTokenPocket);
  if (id === "trust") return Boolean(provider.isTrust || provider.isTrustWallet);
  if (id === "okx") return Boolean(provider.isOkxWallet || provider.isOKExWallet);
  return false;
}

function uniqueProviders(items: WalletProviderInfo[]) {
  const seen = new Set<EthereumProvider>();
  return items.filter((item) => {
    if (seen.has(item.provider)) return false;
    seen.add(item.provider);
    return true;
  });
}

function detectInjectedWallets(): WalletProviderInfo[] {
  if (typeof window === "undefined") return [];
  const win = window as WalletWindow;
  const ethereumProviders = win.ethereum?.providers?.length ? win.ethereum.providers : win.ethereum ? [win.ethereum] : [];
  const candidates: WalletProviderInfo[] = [];

  for (const provider of ethereumProviders) {
    if (providerMatches(provider, "tokenpocket")) candidates.push({ id: "tokenpocket", name: "TokenPocket", provider, injected: true });
    if (providerMatches(provider, "trust")) candidates.push({ id: "trust", name: "Trust Wallet", provider, injected: true });
    if (providerMatches(provider, "okx")) candidates.push({ id: "okx", name: "OKX Wallet", provider, injected: true });
    if (providerMatches(provider, "metamask")) candidates.push({ id: "metamask", name: "MetaMask", provider, injected: true });
  }

  if (win.tokenpocket?.ethereum) candidates.push({ id: "tokenpocket", name: "TokenPocket", provider: win.tokenpocket.ethereum, injected: true });
  if (win.trustwallet) candidates.push({ id: "trust", name: "Trust Wallet", provider: win.trustwallet, injected: true });
  if (win.okxwallet?.ethereum) candidates.push({ id: "okx", name: "OKX Wallet", provider: win.okxwallet.ethereum, injected: true });
  if (win.okxwallet?.request) candidates.push({ id: "okx", name: "OKX Wallet", provider: win.okxwallet, injected: true });
  if (win.ethereum && candidates.every((item) => item.provider !== win.ethereum)) {
    candidates.push({ id: "injected", name: "Browser Wallet", provider: win.ethereum, injected: true });
  }

  return uniqueProviders(candidates);
}

function getPrimaryProvider() {
  return detectInjectedWallets()[0]?.provider || null;
}

function shortAddress(address: string) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
}

function parseChainId(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string") return value.startsWith("0x") ? Number.parseInt(value, 16) : Number(value);
  return 0;
}

function isUserRejected(err: unknown) {
  const code = typeof err === "object" && err && "code" in err ? Number((err as { code?: number }).code) : 0;
  const message = err instanceof Error ? err.message.toLowerCase() : "";
  return code === 4001 || message.includes("user rejected") || message.includes("user denied") || message.includes("cancel");
}

async function switchToBsc(provider: EthereumProvider) {
  const currentChain = parseChainId(await provider.request({ method: "eth_chainId" }).catch(() => "0x0"));
  if (currentChain === BSC_CHAIN_ID) return BSC_CHAIN_ID;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BSC_HEX_CHAIN_ID }] });
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? Number((err as { code?: number }).code) : 0;
    if (code !== 4902) throw err;
    await provider.request({ method: "wallet_addEthereumChain", params: [BSC_ADD_CHAIN_PARAMS] });
  }
  return parseChainId(await provider.request({ method: "eth_chainId" }));
}

async function sendUsdtTransferAndWait(provider: EthereumProvider, input: { from: string; to: string; amount: string | number; tokenAddress?: string; onSubmitted?: (txHash: string) => void }) {
  const txHash = await provider.request({
    method: "eth_sendTransaction",
    params: [{
      from: input.from,
      to: input.tokenAddress || USDT_BEP20_ADDRESS,
      value: "0x0",
      data: encodeFunctionData({
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [input.to as `0x${string}`, parseUnits(String(input.amount), 18)]
      })
    }]
  });
  if (typeof txHash !== "string") throw new Error("USDT transfer transaction was not returned by wallet.");
  input.onSubmitted?.(txHash);
  await bscPublicClient.waitForTransactionReceipt({ hash: txHash as Hash, confirmations: 3 });
  return txHash;
}

export function ExternalWalletConnect({ compact = false, minimal = false, hero = false, heroTone = "primary", authenticate = false, authMode = "login", referralCode = "", buttonLabel = "Connect Wallet", showConnectedAddress = true, onAuthenticated }: {
  compact?: boolean;
  minimal?: boolean;
  hero?: boolean;
  heroTone?: "primary" | "secondary";
  authenticate?: boolean;
  authMode?: HbWalletAuthMode;
  referralCode?: string;
  buttonLabel?: string;
  showConnectedAddress?: boolean;
  onAuthenticated?: (token: string, user: HbUser) => void;
}) {
  const queryClient = useQueryClient();
  const connectors = useConnectors();
  const { connectAsync } = useConnect();
  const [wallets, setWallets] = useState<WalletProviderInfo[]>([]);
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [registrationFee, setRegistrationFee] = useState<HbRegistrationFee | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const autoCheckedRef = useRef(false);
  const authPendingRef = useRef(false);
  const lastAuthClickAtRef = useRef(0);
  const previousWalletRef = useRef("");

  const walletConnectConnector = useMemo(() => connectors.find((connector) => connector.id === "walletConnect"), [connectors]);
  const walletBrowserDetected = wallets.length > 0;
  const connected = Boolean(address);
  const onBsc = connected && chainId === BSC_CHAIN_ID;
  const statusText = connected ? (onBsc ? BSC_LABEL : "Wrong network") : walletBrowserDetected ? `${wallets[0].name} detected` : `${BSC_LABEL} ready`;

  function clearAuthUiState() {
    setMessage("");
    setRegistrationFee(null);
    if (typeof window === "undefined") return;
    [
      "hb9.authError",
      "hb9.auth.error",
      "hb9.walletAuthError",
      "hb9.registrationFee",
      "hb9.registrationFeeRequired",
      "hb9.activationFee",
      "hb9.activationFeeRequired"
    ].forEach((key) => {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    });
  }

  function resetInMemoryStores() {
    useWalletStore.setState({
      screen: "landing",
      activeTab: "home",
      vault: null,
      sessionMnemonic: "",
      activeAddress: "",
      balances: { bnb: "0", usdt: "0" },
      loadingBalance: false,
      balanceVisible: true,
      network: "bsc",
      tx: initialTx
    });
    useTransactionStore.setState({ transactions: [] });
    useTokenStore.setState({
      search: "",
      selectedToken: null,
      customTokens: [],
      hiddenSymbols: [],
      favorites: ["bsc:BNB", "bsc:USDT", "bsc:USDC", "ethereum:ETH", "ethereum:USDT", "polygon:MATIC", "polygon:USDT", "tron:TRX", "tron:USDT", "bitcoin:BTC"]
    });
    useRechargeStore.setState({
      country: "IN",
      operatorId: "in-airtel",
      operator: "Airtel",
      mobile: "",
      productId: "in-airtel-199",
      cryptoAsset: "USDT",
      history: []
    });
  }

  function clearHbWalletSessionState(nextWallet = "") {
    clearHbSessionStorageState();
    queryClient.clear();
    resetInMemoryStores();
    if (nextWallet) {
      window.localStorage.setItem(HB_ACTIVE_WALLET_KEY, normalizeHbWalletAddress(nextWallet));
      window.localStorage.removeItem(hbWalletScopedStorageKey(nextWallet));
    }
    window.dispatchEvent(new CustomEvent("hb9:session-cleared", { detail: { walletAddress: nextWallet } }));
  }

  function handleWalletAddressChanged(nextAddress: string) {
    const normalizedNext = normalizeHbWalletAddress(nextAddress);
    const previous = previousWalletRef.current || normalizeHbWalletAddress(window.localStorage.getItem(HB_ACTIVE_WALLET_KEY));
    if (previous && previous !== normalizedNext) {
      clearHbWalletSessionState(normalizedNext);
    }
    previousWalletRef.current = normalizedNext;
  }

  async function refresh(provider = getPrimaryProvider()) {
    if (!provider) return;
    const [accounts, chain] = await Promise.all([
      provider.request({ method: "eth_accounts" }).catch(() => []),
      provider.request({ method: "eth_chainId" }).catch(() => "0x0")
    ]);
    const nextAddress = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
    if (nextAddress) handleWalletAddressChanged(nextAddress);
    setAddress(nextAddress);
    setChainId(parseChainId(chain));
  }

  async function syncProviderAccounts(provider = getPrimaryProvider()) {
    if (!provider) return;
    await refresh(provider);
  }

  async function finishAuthentication(provider: EthereumProvider, nextAddress: string, nextChainId: number) {
    if (HB_DEV_DASHBOARD_BYPASS) {
      saveHbDevWallet(nextAddress);
      if (window.location.pathname !== "/halal-business") window.location.assign("/halal-business");
      return;
    }
    if (!authenticate) return;
    const challenge = await requestHbWalletChallenge({ walletAddress: nextAddress, chainId: nextChainId || BSC_CHAIN_ID, referralCode, authMode });
    const signature = await provider.request({ method: "personal_sign", params: [challenge.message, nextAddress] });
    if (typeof signature !== "string") {
      setMessage("Wallet signature was cancelled.");
      return;
    }
    const response = await verifyHbWalletSignature({ walletAddress: nextAddress, chainId: challenge.chainId, nonce: challenge.nonce, signature, authMode });
    if (response.adminToken) {
      window.localStorage.setItem(ADMIN_TOKEN_KEY, response.adminToken);
      clearAuthUiState();
      window.location.assign(response.adminRedirect || "/admin");
      return;
    }
    if (!response.token || !response.user) {
      setMessage("Wallet authentication failed.");
      return;
    }
    saveHbToken(response.token, nextAddress);
    await Promise.all([
      fetchHbMe(response.token),
      fetchHbWallet(response.token),
      fetchHbMyProducts(response.token)
    ]).catch(() => undefined);
    if (authMode === "login") {
      onAuthenticated?.(response.token, response.user);
      clearAuthUiState();
      return;
    }
    if (response.registrationFeeRequired && response.registrationFee) {
      setRegistrationFee(response.registrationFee);
      setMessage("pending_wallet_signature");
      const amount = response.registrationFee.amountUSDT || response.registrationFee.amountUSD;
      const txHash = await sendUsdtTransferAndWait(provider, {
        from: nextAddress,
        to: response.registrationFee.treasuryWallet,
        amount,
        tokenAddress: response.registrationFee.tokenAddress,
        onSubmitted: () => setMessage("pending_blockchain_confirmation")
      });
      setMessage("confirmed");
      const activated = await verifyHbRegistrationFee(response.token, { txHash });
      saveHbToken(response.token, nextAddress);
      await Promise.all([
        fetchHbMe(response.token),
        fetchHbWallet(response.token),
        fetchHbMyProducts(response.token)
      ]).catch(() => undefined);
      onAuthenticated?.(response.token, activated.user);
      setRegistrationFee(null);
      setMessage("");
      return;
    }
    onAuthenticated?.(response.token, response.user);
    setMessage("");
  }

  async function connectInjected(wallet = wallets[0]) {
    const now = Date.now();
    if (authPendingRef.current || globalAuthPending || now - lastAuthClickAtRef.current < 3000 || now - globalLastAuthClickAt < 3000) {
      setMessage("Please wait a few seconds and try again.");
      return;
    }
    authPendingRef.current = true;
    globalAuthPending = true;
    lastAuthClickAtRef.current = now;
    globalLastAuthClickAt = now;
    setBusy(true);
    clearAuthUiState();
    try {
      if (!wallet?.provider) {
        setModalOpen(true);
        return;
      }
      const accounts = await wallet.provider.request({ method: "eth_requestAccounts" });
      const nextAddress = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
      if (!nextAddress) {
        setMessage("Wallet account was not returned.");
        return;
      }
      handleWalletAddressChanged(nextAddress);
      const nextChainId = await switchToBsc(wallet.provider);
      setAddress(nextAddress);
      setChainId(nextChainId);
      setModalOpen(false);
      await finishAuthentication(wallet.provider, nextAddress, nextChainId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "";
      setMessage(isUserRejected(err) ? "Wallet connection was cancelled." : errorMessage.toLowerCase().includes("too many requests") || errorMessage.toLowerCase().includes("rate limit") ? "Please wait a few seconds and try again." : errorMessage || "Wallet connection failed.");
    } finally {
      window.setTimeout(() => {
        authPendingRef.current = false;
        globalAuthPending = false;
      }, 3000);
      setBusy(false);
    }
  }

  async function connectWalletConnect() {
    const now = Date.now();
    if (authPendingRef.current || globalAuthPending || now - lastAuthClickAtRef.current < 3000 || now - globalLastAuthClickAt < 3000) {
      setMessage("Please wait a few seconds and try again.");
      return;
    }
    authPendingRef.current = true;
    globalAuthPending = true;
    lastAuthClickAtRef.current = now;
    globalLastAuthClickAt = now;
    setBusy(true);
    clearAuthUiState();
    try {
      if (!walletConnectProjectId || !walletConnectConnector) {
        setMessage("WalletConnect is not configured. Add NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to enable QR fallback.");
        return;
      }
      const result = await connectAsync({ connector: walletConnectConnector as Connector, chainId: BSC_CHAIN_ID });
      const nextAddress = result.accounts[0];
      if (!nextAddress) {
        setMessage("Wallet account was not returned.");
        return;
      }
      handleWalletAddressChanged(nextAddress);
      const provider = await walletConnectConnector.getProvider() as EthereumProvider;
      const nextChainId = await switchToBsc(provider).catch(() => result.chainId || BSC_CHAIN_ID);
      setAddress(nextAddress);
      setChainId(nextChainId);
      setModalOpen(false);
      await finishAuthentication(provider, nextAddress, nextChainId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "";
      setMessage(isUserRejected(err) ? "Wallet connection was cancelled." : errorMessage.toLowerCase().includes("too many requests") || errorMessage.toLowerCase().includes("rate limit") ? "Please wait a few seconds and try again." : errorMessage || "WalletConnect connection failed.");
    } finally {
      window.setTimeout(() => {
        authPendingRef.current = false;
        globalAuthPending = false;
      }, 3000);
      setBusy(false);
    }
  }

  async function connect() {
    if (busy || authPendingRef.current || globalAuthPending) {
      setMessage("Please wait a few seconds and try again.");
      return;
    }
    if (walletBrowserDetected) {
      await connectInjected(wallets[0]);
      return;
    }
    setMessage("");
    setModalOpen(true);
  }

  useEffect(() => {
    const detected = detectInjectedWallets();
    setWallets(detected);
    const provider = detected[0]?.provider;
    if (!provider) return;
    refresh(provider);
    const accountsChanged = (accounts: unknown) => {
      const nextAddress = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
      if (!nextAddress) {
        clearHbWalletSessionState("");
        previousWalletRef.current = "";
        setAddress("");
        setChainId(0);
        setMessage("Wallet disconnected. HB9 session cleared.");
        return;
      }
      handleWalletAddressChanged(nextAddress);
      setAddress(nextAddress);
    };
    const chainChanged = (nextChainId: unknown) => setChainId(parseChainId(nextChainId));
    provider.on?.("accountsChanged", accountsChanged);
    provider.on?.("chainChanged", chainChanged);
    const focusHandler = () => syncProviderAccounts(provider).catch(() => undefined);
    const visibilityHandler = () => {
      if (document.visibilityState === "visible") syncProviderAccounts(provider).catch(() => undefined);
    };
    window.addEventListener("focus", focusHandler);
    document.addEventListener("visibilitychange", visibilityHandler);
    return () => {
      provider.removeListener?.("accountsChanged", accountsChanged);
      provider.removeListener?.("chainChanged", chainChanged);
      window.removeEventListener("focus", focusHandler);
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, []);

  useEffect(() => {
    if (autoCheckedRef.current || !walletBrowserDetected) return;
    autoCheckedRef.current = true;
    const provider = wallets[0].provider;
    provider.request({ method: "eth_accounts" })
      .then(async (accounts) => {
        const nextAddress = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
        if (!nextAddress) return;
        handleWalletAddressChanged(nextAddress);
        const nextChainId = await switchToBsc(provider).catch(() => BSC_CHAIN_ID);
        setAddress(nextAddress);
        setChainId(nextChainId);
      })
      .catch(() => undefined);
  }, [walletBrowserDetected, wallets]);

  function disconnect() {
    clearHbWalletSessionState("");
    previousWalletRef.current = "";
    setAddress("");
    setChainId(0);
    setMessage("Wallet disconnected. HB9 session cleared.");
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
          aria-label={connected && !onBsc ? `Switch wallet to ${BSC_LABEL}` : walletBrowserDetected ? `Connect ${wallets[0].name}` : "Choose wallet"}
          title="External wallet connection for package purchases, USDT BEP20 approvals, contract interactions, wallet proof, and BscScan transaction proof."
        >
          <Wallet size={15} />
          <span className="truncate">{busy ? "Please wait" : connected && showConnectedAddress ? shortAddress(address) : buttonLabel}</span>
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
      {registrationFee ? (
        <div className="mt-2 rounded-xl border border-yellow-200/20 bg-yellow-300/10 p-3 text-xs leading-5 text-yellow-100">
          <div className="font-black">One-time activation fee: ${registrationFee.amountUSD} USDT BEP20</div>
          <div>Paid directly to Treasury Wallet</div>
          <div className="mt-1 break-all font-mono text-[10px] text-yellow-50/75">{registrationFee.treasuryWallet}</div>
        </div>
      ) : message ? <div className="mt-2 text-xs leading-5 text-yellow-100">{message}</div> : null}
      {modalOpen && !walletBrowserDetected ? (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/70 px-3 pb-3 backdrop-blur-sm sm:place-items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Choose wallet">
          <div className="w-full max-w-md rounded-2xl border border-sky-200/15 bg-[#07111f] p-4 text-slate-100 shadow-[0_0_40px_rgba(34,211,238,0.16)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-base font-semibold">Connect wallet</div>
                <div className="mt-1 text-xs text-slate-400">Use a wallet browser or WalletConnect QR.</div>
              </div>
              <button className="grid h-9 w-9 place-items-center rounded-xl border border-sky-200/15 text-slate-300" onClick={() => setModalOpen(false)} type="button" aria-label="Close wallet selection">
                <X size={16} />
              </button>
            </div>
            <div className="grid gap-2">
              {wallets.map((wallet) => (
              <button key={wallet.id} className="flex min-h-12 items-center justify-between rounded-xl border border-sky-200/15 bg-white/[0.04] px-3 text-left text-sm font-semibold text-slate-100 disabled:opacity-50" onClick={() => connectInjected(wallet)} disabled={busy} type="button">
                  <span>{wallet.name}</span>
                  <Check size={15} className="text-cyan-200" />
                </button>
              ))}
              <button className="flex min-h-12 items-center justify-between rounded-xl border border-cyan-200/20 bg-cyan-300/10 px-3 text-left text-sm font-semibold text-cyan-50 disabled:opacity-50" onClick={connectWalletConnect} disabled={busy} type="button">
                <span>WalletConnect QR</span>
                <QrCode size={16} />
              </button>
            </div>
            {!walletConnectProjectId ? <div className="mt-3 rounded-xl border border-yellow-200/20 bg-yellow-300/10 p-3 text-xs leading-5 text-yellow-100">WalletConnect requires `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
