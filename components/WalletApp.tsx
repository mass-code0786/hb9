"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Bell, CheckCircle2, ChevronDown, Copy, Lock, Settings, ShieldCheck, Trash2 } from "lucide-react";
import { AddCustomToken, ManageTokensPage, TokenDetails } from "@/features/tokens/TokenManagement";
import { DiscoverPage } from "@/features/discover/DiscoverPage";
import { HomeDashboard } from "@/features/home/HomeDashboard";
import { MarketsPage } from "@/features/markets/MarketsPage";
import { QrPayModule } from "@/features/qr-pay/QrPayModule";
import { RechargeModule } from "@/features/recharge/RechargeModule";
import { RewardsPage } from "@/features/rewards/RewardsPage";
import { SecurityCenter } from "@/features/security/SecurityCenter";
import { SettingsModule, StaticInfoPage } from "@/features/settings/SettingsModule";
import { ProviderSettings } from "@/features/settings/ProviderSettings";
import { TradePage } from "@/features/trade/TradePage";
import { TransactionHistory } from "@/features/transactions/TransactionHistory";
import { clearVault, getStoredVault, saveVault } from "@/lib/storage";
import { decryptMnemonic, encryptMnemonic } from "@/lib/crypto";
import { generateMnemonic, normalizeMnemonic, shortAddress, validateMnemonic, walletFromMnemonic } from "@/lib/wallet";
import { explorerTxUrl, getNetworkConfig, NETWORK_OPTIONS, type NetworkKey } from "@/lib/networks";
import { DEFAULT_TOKENS, type TokenConfig } from "@/lib/tokens";
import type { EncryptedVault } from "@/lib/types";
import type { WalletScreen, WalletToken } from "@/types/wallet";
import { useWalletStore, initialTx } from "@/store/walletStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useTokenStore } from "@/store/tokenStore";
import { useTransactionStore } from "@/store/transactionStore";
import { getMockTransactions } from "@/services/mockApi";
import { getNetworkBalances } from "@/services/balanceService";
import { estimateEvmTransfer, sendEvmTransfer } from "@/services/evmService";
import { estimateTronTransfer, isTronAddress, sendTronTransfer, tronAccountFromMnemonic } from "@/services/tronService";
import { WalletShell } from "@/components/ui/WalletShell";
import { ErrorText, Field, Panel, PrimaryButton, SecondaryButton, Select } from "@/components/ui/Primitives";
import { BrandLogo } from "@/components/BrandLogo";
import { trimAmount } from "@/utils/format";

export function WalletApp() {
  const {
    screen,
    activeTab,
    vault,
    sessionMnemonic,
    activeAddress,
    balances,
    loadingBalance,
    balanceVisible,
    network,
    tx,
    setScreen,
    setActiveTab,
    setVault,
    setSessionMnemonic,
    setActiveAddress,
    setBalances,
    setLoadingBalance,
    toggleBalanceVisible,
    setNetwork,
    setTx
  } = useWalletStore();
  const selectedToken = useTokenStore((state) => state.selectedToken);
  const setSelectedToken = useTokenStore((state) => state.setSelectedToken);
  const transactions = useTransactionStore((state) => state.transactions);
  const setTransactions = useTransactionStore((state) => state.setTransactions);
  const addTransaction = useTransactionStore((state) => state.addTransaction);
  const autoLockMinutes = useSettingsStore((state) => state.autoLockMinutes);

  const [pendingMnemonic, setPendingMnemonic] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [unlockPassword, setUnlockPassword] = useState("");
  const [importText, setImportText] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");
  const [sendTokenId, setSendTokenId] = useState("bsc:BNB");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [gasFee, setGasFee] = useState("");
  const [showSeedWarning, setShowSeedWarning] = useState(false);
  const [seedAcknowledged, setSeedAcknowledged] = useState(false);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [clipboardNotice, setClipboardNotice] = useState("");

  const mnemonicWords = useMemo(() => pendingMnemonic.split(" ").filter(Boolean), [pendingMnemonic]);
  const authenticated = Boolean(sessionMnemonic);

  const customTokens = useTokenStore((state) => state.customTokens);
  const customTokenConfigs = useMemo<TokenConfig[]>(
    () => customTokens.map((token) => ({
      id: token.id || `${token.network}:${token.address}`,
      network: token.network || "bsc",
      type: "erc20",
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals || 18,
      contractAddress: token.address,
      color: token.color,
      price: token.price,
      change24h: token.change24h
    })),
    [customTokens]
  );
  const networkConfig = getNetworkConfig(network);
  const sendTokens = useMemo(() => [...DEFAULT_TOKENS, ...customTokenConfigs].filter((token) => token.network === network && token.type !== "placeholder"), [customTokenConfigs, network]);
  const selectedSendToken = sendTokens.find((token) => token.id === sendTokenId) || sendTokens[0];
  const tronAddress = useMemo(() => {
    if (!sessionMnemonic) return "";
    try {
      return tronAccountFromMnemonic(sessionMnemonic).address;
    } catch {
      return "";
    }
  }, [sessionMnemonic]);
  const currentAddress = networkConfig.kind === "tron" ? tronAddress : activeAddress;

  const refreshBalances = useCallback(async () => {
    if (!currentAddress) return;
    setLoadingBalance(true);
    try {
      setBalances(await getNetworkBalances(network, currentAddress, customTokenConfigs));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load balances.");
    } finally {
      setLoadingBalance(false);
    }
  }, [currentAddress, customTokenConfigs, network, setBalances, setLoadingBalance]);

  useEffect(() => {
    const stored = getStoredVault();
    if (stored) {
      setVault(stored);
      setActiveAddress(stored.address);
      setScreen("unlock");
    }
    getMockTransactions().then(setTransactions);
  }, [setActiveAddress, setScreen, setTransactions, setVault]);

  useEffect(() => {
    if (sessionMnemonic) setActiveAddress(walletFromMnemonic(sessionMnemonic).address);
  }, [sessionMnemonic, setActiveAddress]);

  useEffect(() => {
    if (screen === "dashboard" && currentAddress) refreshBalances();
  }, [screen, currentAddress, refreshBalances]);

  useEffect(() => {
    const firstToken = sendTokens[0];
    if (firstToken && !sendTokens.some((token) => token.id === sendTokenId)) setSendTokenId(firstToken.id);
  }, [sendTokenId, sendTokens]);

  useEffect(() => {
    if (!sessionMnemonic) return;
    let timer: number | undefined;
    const resetTimer = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(lock, autoLockMinutes * 60 * 1000);
    };
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [autoLockMinutes, sessionMnemonic]);

  function resetForms() {
    setPassword("");
    setPasswordConfirm("");
    setUnlockPassword("");
    setConfirmText("");
    setImportText("");
    setError("");
    setGasFee("");
    setTx(initialTx);
  }

  function go(screenName: WalletScreen) {
    setError("");
    setScreen(screenName);
  }

  function startCreate() {
    resetForms();
    setPendingMnemonic("");
    setShowSeedWarning(true);
    setSeedAcknowledged(false);
    setScreen("create");
  }

  function revealSeedPhrase() {
    setPendingMnemonic(generateMnemonic());
    setShowSeedWarning(false);
  }

  function startImport() {
    resetForms();
    setPendingMnemonic("");
    setScreen("import");
  }

  function acceptImport() {
    const normalized = normalizeMnemonic(importText);
    if (!validateMnemonic(normalized)) {
      setError("Enter a valid 12-word recovery phrase.");
      return;
    }
    setError("");
    setPendingMnemonic(normalized);
    setScreen("password");
  }

  function acceptConfirm() {
    if (normalizeMnemonic(confirmText) !== pendingMnemonic) {
      setError("The phrase does not match. Check every word in order.");
      return;
    }
    setError("");
    setScreen("password");
  }

  async function createVault() {
    if (password.length < 8) {
      setError("Use at least 8 characters for the wallet password.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Passwords do not match.");
      return;
    }

    try {
      const wallet = walletFromMnemonic(pendingMnemonic);
      const encrypted = await encryptMnemonic(pendingMnemonic, password, wallet.address);
      saveVault(encrypted);
      setVault(encrypted);
      setSessionMnemonic(pendingMnemonic);
      setActiveAddress(wallet.address);
      setPendingMnemonic("");
      resetForms();
      setScreen("dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not encrypt wallet.");
    }
  }

  async function unlock() {
    if (!vault) return;
    try {
      const mnemonic = await decryptMnemonic(vault, unlockPassword);
      setSessionMnemonic(mnemonic);
      setActiveAddress(walletFromMnemonic(mnemonic).address);
      resetForms();
      setScreen("dashboard");
    } catch {
      setError("Incorrect password or damaged local vault.");
    }
  }

  function lock() {
    setSessionMnemonic("");
    resetForms();
    setScreen(vault ? "unlock" : "landing");
  }

  function removeWallet() {
    if (!deleteConfirming) {
      setDeleteConfirming(true);
      return;
    }
    clearVault();
    setVault(null);
    setSessionMnemonic("");
    setActiveAddress("");
    setPendingMnemonic("");
    resetForms();
    setDeleteConfirming(false);
    setScreen("landing");
  }

  async function copyAddress() {
    await navigator.clipboard.writeText(currentAddress);
    setClipboardNotice("Address copied. Confirm the first and last characters before sending funds.");
    window.setTimeout(() => setClipboardNotice(""), 3500);
  }

  async function estimateGas() {
    setError("");
    setGasFee("");
    setTx({ state: "estimating", message: "Estimating network fee..." });
    try {
      if (!amount || Number(amount) <= 0) throw new Error("Enter a valid amount.");
      if (!selectedSendToken) throw new Error("Select a token to send.");
      if (networkConfig.kind === "tron") {
        if (!isTronAddress(to)) throw new Error("Enter a valid TRON recipient address.");
        setGasFee(estimateTronTransfer(selectedSendToken));
      } else {
        if (!ethers.isAddress(to)) throw new Error("Enter a valid EVM recipient address.");
        if (networkConfig.kind !== "evm") throw new Error(`${networkConfig.name} sends are not implemented yet.`);
        const estimate = await estimateEvmTransfer(network, activeAddress, to, amount, selectedSendToken);
        setGasFee(estimate.fee);
      }
      setTx({ state: "idle", message: "Gas estimate ready." });
    } catch (err) {
      setTx({ state: "failed", message: "" });
      setError(err instanceof Error ? err.message : "Could not estimate gas.");
    }
  }

  async function submitTx() {
    setError("");
    setTx({ state: "signing", message: "Signing locally in this browser..." });
    try {
      // Sensitive boundary: sessionMnemonic remains in client memory and is used only for local signing.
      if (!sessionMnemonic) throw new Error("Unlock the wallet first.");
      if (!selectedSendToken) throw new Error("Select a token to send.");
      setTx({ state: "submitted", message: "Broadcasting transaction..." });
      const receipt = networkConfig.kind === "tron"
        ? await sendTronTransfer(sessionMnemonic, to, amount, selectedSendToken)
        : await sendEvmTransfer(sessionMnemonic, network, to, amount, selectedSendToken);
      if (!receipt?.hash) throw new Error("Transaction was submitted but no hash was returned yet.");
      setTx({ state: "confirmed", hash: receipt.hash, message: `Transaction confirmed on ${networkConfig.shortName}.` });
      addTransaction({
        id: receipt.hash,
        type: "send",
        title: `Sent ${selectedSendToken.symbol}`,
        asset: selectedSendToken.symbol,
        amount: `-${amount}`,
        status: "success",
        hash: receipt.hash,
        gasFee: gasFee || "Estimated before send",
        counterparty: to,
        createdAt: new Date().toISOString()
      });
      setAmount("");
      setTo("");
      setGasFee("");
      await refreshBalances();
    } catch (err) {
      setTx({ state: "failed", message: "" });
      setError(err instanceof Error ? err.message : "Transaction failed.");
    }
  }

  const header = (
    <header className="mb-4 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {authenticated && screen !== "dashboard" ? (
          <button className="rounded-2xl bg-white/10 p-3" onClick={() => go("dashboard")} type="button" aria-label="Back to dashboard">
            <ArrowLeft size={18} />
          </button>
        ) : null}
        <div className="min-w-0">
          <button className="flex min-w-0 items-center gap-2 text-left" onClick={() => (authenticated ? go("dashboard") : go(vault ? "unlock" : "landing"))} type="button">
            <BrandLogo size="md" />
            <span className="block truncate text-lg font-semibold leading-tight">BitzenX</span>
          </button>
          <div className="mt-1 flex min-w-0 items-center gap-2 pl-11 text-xs text-slate-400">
            <span className="min-w-0 truncate">{currentAddress ? shortAddress(currentAddress) : "Multi-network wallet"}</span>
            {authenticated ? <span className="text-slate-600">|</span> : null}
            {authenticated ? (
              <span className="relative inline-flex max-w-[9.5rem] items-center gap-1 rounded-xl border border-accent/25 bg-white/10 px-2 py-1 text-xs font-medium text-accent">
                <span className="truncate">{networkConfig.shortName}</span>
                <ChevronDown size={13} />
                <select
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  value={network}
                  onChange={(event) => setNetwork(event.target.value as NetworkKey)}
                  aria-label="Network selector"
                  data-testid="network-selector"
                >
                  {NETWORK_OPTIONS.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
                </select>
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {authenticated ? <button className="rounded-2xl bg-white/10 p-3" onClick={() => go("settings")} type="button" aria-label="Open settings"><Settings size={18} /></button> : null}
        {authenticated ? <button className="rounded-2xl bg-white/10 p-3" type="button"><Bell size={18} /></button> : null}
        {authenticated ? <button className="rounded-2xl border border-white/10 px-3 py-2 text-xs" onClick={lock} type="button"><Lock size={14} className="inline" /> Lock</button> : null}
      </div>
    </header>
  );

  if (!authenticated && ["landing", "create", "confirm", "import", "password", "unlock"].includes(screen)) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-5 safe-bottom">
        {header}
        {renderAuthScreens({
          screen,
          vault,
          mnemonicWords,
          showSeedWarning,
          seedAcknowledged,
          setSeedAcknowledged,
          confirmText,
          importText,
          password,
          passwordConfirm,
          unlockPassword,
          error,
          setConfirmText,
          setImportText,
          setPassword,
          setPasswordConfirm,
          setUnlockPassword,
          startCreate,
          revealSeedPhrase,
          startImport,
          acceptConfirm,
          acceptImport,
          createVault,
          unlock,
          removeWallet,
          deleteConfirming,
          go
        })}
      </main>
    );
  }

  return (
    <WalletShell
      activeTab={activeTab}
      onTabChange={(tab) => {
        setActiveTab(tab);
        setScreen("dashboard");
      }}
      header={header}
    >
      {activeTab === "markets" && screen === "dashboard" ? <MarketsPage /> : null}
      {activeTab === "trade" && screen === "dashboard" ? <TradePage network={network} onNetworkChange={setNetwork} /> : null}
      {activeTab === "rewards" && screen === "dashboard" ? <RewardsPage /> : null}
      {activeTab === "discover" && screen === "dashboard" ? <DiscoverPage /> : null}
      {activeTab === "home" && screen === "dashboard" ? (
        <HomeDashboard
          address={currentAddress}
          clipboardNotice={clipboardNotice}
          balances={balances}
          loading={loadingBalance}
          balanceVisible={balanceVisible}
          network={network}
          transactions={transactions}
          onRefresh={refreshBalances}
          onScreen={go}
          onCopyAddress={copyAddress}
          onToggleBalance={toggleBalanceVisible}
          onTokenDetails={(token) => {
            setSelectedToken(token);
            go("token-details");
          }}
        />
      ) : null}
      {screen === "receive" ? <ReceiveView address={currentAddress} network={network} clipboardNotice={clipboardNotice} onCopy={copyAddress} /> : null}
      {screen === "send" ? <SendView network={network} tokenId={selectedSendToken?.id || ""} tokens={sendTokens} setTokenId={setSendTokenId} to={to} setTo={setTo} amount={amount} setAmount={setAmount} gasFee={gasFee} tx={tx} error={error} estimateGas={estimateGas} submitTx={submitTx} /> : null}
      {screen === "recharge" ? <RechargeModule /> : null}
      {screen === "qr-pay" ? <QrPayModule /> : null}
      {screen === "transactions" ? <TransactionHistory transactions={transactions} /> : null}
      {screen === "security" ? <SecurityCenter address={activeAddress} /> : null}
      {screen === "settings" ? <SettingsModule onNavigate={go} /> : null}
      {screen === "provider-settings" ? <ProviderSettings /> : null}
      {screen === "token-details" ? <div className="space-y-4"><TokenDetails token={selectedToken} /><AddCustomToken defaultNetwork={network} /></div> : null}
      {screen === "manage-tokens" ? <ManageTokensPage network={network} /> : null}
      {screen === "about" ? <StaticInfoPage title="About" /> : null}
      {screen === "help" ? <StaticInfoPage title="Help Center" /> : null}
      {screen === "terms" ? <StaticInfoPage title="Terms" /> : null}
    </WalletShell>
  );
}

function renderAuthScreens(props: {
  screen: WalletScreen;
  vault: EncryptedVault | null;
  mnemonicWords: string[];
  showSeedWarning: boolean;
  seedAcknowledged: boolean;
  setSeedAcknowledged: (value: boolean) => void;
  confirmText: string;
  importText: string;
  password: string;
  passwordConfirm: string;
  unlockPassword: string;
  error: string;
  setConfirmText: (value: string) => void;
  setImportText: (value: string) => void;
  setPassword: (value: string) => void;
  setPasswordConfirm: (value: string) => void;
  setUnlockPassword: (value: string) => void;
  startCreate: () => void;
  revealSeedPhrase: () => void;
  startImport: () => void;
  acceptConfirm: () => void;
  acceptImport: () => void;
  createVault: () => void;
  unlock: () => void;
  removeWallet: () => void;
  deleteConfirming: boolean;
  go: (screen: WalletScreen) => void;
}) {
  const p = props;
  if (p.screen === "landing") {
    return (
      <Panel>
        <div className="mb-7">
          <BrandLogo size="lg" className="mb-5" />
          <div className="mb-4 inline-flex rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs text-accent">Local encrypted vault</div>
          <h1 className="text-4xl font-semibold leading-tight">Your BSC wallet, recharge, and payments hub.</h1>
          <p className="mt-4 text-sm leading-6 text-slate-300">Create or import a 12-word wallet. Your recovery phrase and private key are encrypted locally and are never sent to a backend.</p>
          <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/10 p-4 text-xs leading-5 text-yellow-100">
            Self-custody warning: BitzenX cannot reset your password, recover a lost recovery phrase, reverse transactions, or freeze funds.
          </div>
        </div>
        <div className="space-y-3">
          <PrimaryButton className="w-full" onClick={p.startCreate}>Create Wallet</PrimaryButton>
          <SecondaryButton className="w-full" onClick={p.startImport}>Import Wallet</SecondaryButton>
        </div>
      </Panel>
    );
  }
  if (p.screen === "create") {
    if (p.showSeedWarning || p.mnemonicWords.length === 0) {
      return (
        <Panel>
          <Title title="Seed Phrase Warning" subtitle="Your next screen shows the recovery phrase that controls this wallet." />
          <Warning />
          <div className="rounded-2xl bg-white/[0.045] p-4 text-sm leading-6 text-slate-300">
            Close other apps, avoid screenshots, and make sure nobody can see your screen. BitzenX will never send this phrase to a backend.
          </div>
          <label className="mt-4 flex items-start gap-3 rounded-2xl bg-white/[0.045] p-4 text-sm text-slate-300">
            <input className="mt-1 h-4 w-4 accent-[#05c46b]" type="checkbox" checked={p.seedAcknowledged} onChange={(event) => p.setSeedAcknowledged(event.target.checked)} />
            <span>I understand that anyone with this phrase can move my funds, and BitzenX cannot recover it for me.</span>
          </label>
          <PrimaryButton className="mt-5 w-full" onClick={p.revealSeedPhrase} disabled={!p.seedAcknowledged}>Show Recovery Phrase</PrimaryButton>
        </Panel>
      );
    }
    return <Panel><Title title="Backup Phrase" subtitle="Write these 12 words down offline and keep them in order." /><Warning /><WordGrid words={p.mnemonicWords} /><PrimaryButton className="mt-5 w-full" onClick={() => p.go("confirm")}>I Wrote It Down</PrimaryButton></Panel>;
  }
  if (p.screen === "confirm") {
    return <Panel><Title title="Confirm Backup" subtitle="Enter the phrase to prove you saved it before encrypting the wallet." /><textarea className="field min-h-32" value={p.confirmText} onChange={(e) => p.setConfirmText(e.target.value)} placeholder="word one two..." /><ErrorText error={p.error} /><PrimaryButton className="mt-4 w-full" onClick={p.acceptConfirm}>Continue</PrimaryButton></Panel>;
  }
  if (p.screen === "import") {
    return <Panel><Title title="Import Wallet" subtitle="Paste a 12-word BIP39 phrase. It stays in this browser only." /><Warning /><textarea className="field min-h-36" value={p.importText} onChange={(e) => p.setImportText(e.target.value)} placeholder="Enter 12 words separated by spaces" /><ErrorText error={p.error} /><PrimaryButton className="mt-4 w-full" onClick={p.acceptImport}>Import Phrase</PrimaryButton></Panel>;
  }
  if (p.screen === "password") {
    return <Panel><Title title="Set Password" subtitle="This password encrypts the local vault on this device." /><Field type="password" value={p.password} onChange={(e) => p.setPassword(e.target.value)} placeholder="Password" /><Field className="mt-3" type="password" value={p.passwordConfirm} onChange={(e) => p.setPasswordConfirm(e.target.value)} placeholder="Confirm password" /><p className="mt-4 text-xs leading-5 text-slate-400">The password cannot recover funds by itself. Losing the 12-word phrase means funds cannot be recovered.</p><ErrorText error={p.error} /><PrimaryButton className="mt-4 w-full" onClick={p.createVault}>Encrypt Wallet</PrimaryButton></Panel>;
  }
  return <Panel><Title title="Unlock Wallet" subtitle={p.vault?.address ? shortAddress(p.vault.address) : "Encrypted local wallet"} /><Field type="password" value={p.unlockPassword} onChange={(e) => p.setUnlockPassword(e.target.value)} placeholder="Password" onKeyDown={(e) => e.key === "Enter" && p.unlock()} /><ErrorText error={p.error} /><PrimaryButton className="mt-4 w-full" onClick={p.unlock}>Unlock</PrimaryButton><button className={`mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-danger/30 px-4 py-3 text-sm text-danger ${p.deleteConfirming ? "bg-danger/10" : ""}`} onClick={p.removeWallet}><Trash2 size={16} />{p.deleteConfirming ? "Tap again to delete local wallet" : "Remove local wallet"}</button></Panel>;
}

function ReceiveView({ address, network, clipboardNotice, onCopy }: { address: string; network: NetworkKey; clipboardNotice: string; onCopy: () => void }) {
  const config = getNetworkConfig(network);
  const receiveValue = config.placeholder ? config.addressLabel : address;
  return (
    <Panel className="text-center" data-testid="receive-screen">
      <div className="mb-5">
        <BrandLogo size="sm" className="mx-auto mb-3" />
        <div className="mx-auto mb-3 inline-flex rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">{config.name}</div>
        <h2 className="text-2xl font-semibold">Receive</h2>
        <p className="mt-2 text-sm leading-6 text-slate-400">Verify the selected network before sending funds.</p>
      </div>
      <div className="mx-auto my-6 flex aspect-square w-full max-w-[15rem] items-center justify-center rounded-[2rem] bg-white p-5 shadow-wallet"><QRCodeSVG value={receiveValue} size={200} /></div>
      <div className="break-all rounded-2xl border border-white/10 bg-ink/60 p-4 text-center text-sm leading-6">{receiveValue}</div>
      {clipboardNotice ? <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-mint/30 bg-mint/10 p-3 text-sm text-mint"><CheckCircle2 size={16} /> {clipboardNotice}</div> : null}
      <PrimaryButton className="mt-4 flex w-full items-center justify-center gap-2" onClick={onCopy} disabled={config.placeholder}><Copy size={17} />Copy Address</PrimaryButton>
    </Panel>
  );
}

function SendView(props: {
  network: NetworkKey;
  tokenId: string;
  tokens: TokenConfig[];
  setTokenId: (tokenId: string) => void;
  to: string;
  setTo: (value: string) => void;
  amount: string;
  setAmount: (value: string) => void;
  gasFee: string;
  tx: { state: string; message: string; hash?: string };
  error: string;
  estimateGas: () => void;
  submitTx: () => void;
}) {
  const config = getNetworkConfig(props.network);
  const selectedToken = props.tokens.find((token) => token.id === props.tokenId);
  const unsupported = !selectedToken || (config.kind !== "evm" && config.kind !== "tron");
  const txUrl = props.tx.hash ? explorerTxUrl(props.network, props.tx.hash) : "";
  const feeLabel = props.gasFee && Number.isFinite(Number(props.gasFee)) ? `${trimAmount(props.gasFee, 8)} ${config.nativeSymbol}` : props.gasFee;
  return (
    <Panel className="bg-[radial-gradient(circle_at_15%_0%,rgba(5,196,107,0.13),transparent_13rem),rgba(16,20,29,0.92)]">
      <Title title="Send" subtitle={unsupported ? `${config.name} sending is disabled until safely implemented.` : `Transactions are signed locally, then broadcast to ${config.name}.`} />
      <Select value={props.tokenId} onChange={(event) => props.setTokenId(event.target.value)} disabled={props.tokens.length === 0}>
        {props.tokens.map((token) => <option key={token.id} value={token.id}>{token.symbol} - {token.name}</option>)}
      </Select>
      {unsupported ? <div className="mt-4 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-sm text-yellow-100">{config.addressLabel}. No fake successful sends are shown for unsupported networks.</div> : null}
      <Field className="mt-3" value={props.to} onChange={(e) => props.setTo(e.target.value)} placeholder={`Recipient ${config.shortName} address`} disabled={unsupported} />
      <Field className="mt-3" inputMode="decimal" value={props.amount} onChange={(e) => props.setAmount(e.target.value)} placeholder={`Amount in ${selectedToken?.symbol || config.nativeSymbol}`} disabled={unsupported} />
      <div className="mt-4 rounded-2xl border border-white/10 bg-ink/60 p-4 text-xs leading-5 text-slate-300">Estimated network fee: <span className="text-slate-100">{feeLabel || "Run estimate before sending"}</span></div>
      <ErrorText error={props.error} />
      {props.tx.message ? <p className="mt-3 text-sm text-mint">{props.tx.message}</p> : null}
      {props.tx.hash ? <p className="mt-2 break-all text-xs text-slate-400">Hash: {txUrl ? <a className="text-accent" href={txUrl} target="_blank" rel="noreferrer">{props.tx.hash}</a> : props.tx.hash}</p> : null}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <SecondaryButton onClick={props.estimateGas} disabled={unsupported || props.tx.state === "estimating"}>{props.tx.state === "estimating" ? "Estimating" : "Estimate"}</SecondaryButton>
        <PrimaryButton onClick={props.submitTx} disabled={unsupported || props.tx.state === "signing" || props.tx.state === "submitted"}>{props.tx.state === "signing" || props.tx.state === "submitted" ? "Sending" : "Send"}</PrimaryButton>
      </div>
    </Panel>
  );
}

function Title({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="mb-5"><BrandLogo size="sm" className="mb-3" /><h2 className="text-2xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{subtitle}</p></div>;
}

function Warning() {
  return <div className="mb-5 rounded-2xl border border-accent/30 bg-accent/10 p-4 text-xs leading-5 text-yellow-100"><ShieldCheck className="mb-2" size={18} /> Anyone with the 12-word phrase can move your funds. If you lose it, nobody can recover the wallet for you.</div>;
}

function WordGrid({ words }: { words: string[] }) {
  return <div className="grid grid-cols-2 gap-2">{words.map((word, index) => <div key={`${word}-${index}`} className="rounded-2xl border border-white/10 bg-ink/70 px-3 py-3 text-sm"><span className="mr-2 text-slate-500">{index + 1}.</span><span data-testid="seed-word">{word}</span></div>)}</div>;
}
