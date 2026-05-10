"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Bell, Lock, Settings, ShieldCheck } from "lucide-react";
import { AddCustomToken, TokenDetails } from "@/features/tokens/TokenManagement";
import { HomeDashboard } from "@/features/home/HomeDashboard";
import { QrPayModule } from "@/features/qr-pay/QrPayModule";
import { RechargeModule } from "@/features/recharge/RechargeModule";
import { SecurityCenter } from "@/features/security/SecurityCenter";
import { SettingsModule, StaticInfoPage } from "@/features/settings/SettingsModule";
import { TransactionHistory } from "@/features/transactions/TransactionHistory";
import { clearVault, getStoredVault, saveVault } from "@/lib/storage";
import { decryptMnemonic, encryptMnemonic } from "@/lib/crypto";
import { estimateBnbGas, estimateUsdtGas, getBalances, sendBnb, sendUsdt } from "@/lib/chain";
import { generateMnemonic, normalizeMnemonic, shortAddress, validateMnemonic, walletFromMnemonic } from "@/lib/wallet";
import type { EncryptedVault } from "@/lib/types";
import type { TokenSymbol, WalletScreen, WalletToken } from "@/types/wallet";
import { useWalletStore, initialTx } from "@/store/walletStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useTokenStore } from "@/store/tokenStore";
import { useTransactionStore } from "@/store/transactionStore";
import { getMockTransactions } from "@/services/mockApi";
import { WalletShell } from "@/components/ui/WalletShell";
import { ErrorText, Field, Panel, PrimaryButton, SecondaryButton } from "@/components/ui/Primitives";
import { trimAmount } from "@/utils/format";

type Asset = Extract<TokenSymbol, "BNB" | "USDT">;

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
  const [asset, setAsset] = useState<Asset>("BNB");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [gasFee, setGasFee] = useState("");
  const [showSeedWarning, setShowSeedWarning] = useState(false);

  const mnemonicWords = useMemo(() => pendingMnemonic.split(" ").filter(Boolean), [pendingMnemonic]);
  const authenticated = Boolean(sessionMnemonic);

  const refreshBalances = useCallback(async () => {
    if (!activeAddress) return;
    setLoadingBalance(true);
    try {
      setBalances(await getBalances(activeAddress));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load balances.");
    } finally {
      setLoadingBalance(false);
    }
  }, [activeAddress, setBalances, setLoadingBalance]);

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
    if (screen === "dashboard" && activeAddress) refreshBalances();
  }, [screen, activeAddress, refreshBalances]);

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
    clearVault();
    setVault(null);
    setSessionMnemonic("");
    setActiveAddress("");
    setPendingMnemonic("");
    resetForms();
    setScreen("landing");
  }

  async function estimateGas() {
    setError("");
    setGasFee("");
    setTx({ state: "estimating", message: "Estimating network fee..." });
    try {
      if (!ethers.isAddress(to)) throw new Error("Enter a valid recipient address.");
      if (!amount || Number(amount) <= 0) throw new Error("Enter a valid amount.");
      const estimate = asset === "BNB" ? await estimateBnbGas(activeAddress, to, amount) : await estimateUsdtGas(activeAddress, to, amount);
      setGasFee(estimate.fee);
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
      if (!sessionMnemonic) throw new Error("Unlock the wallet first.");
      if (!ethers.isAddress(to)) throw new Error("Enter a valid recipient address.");
      setTx({ state: "submitted", message: "Broadcasting transaction..." });
      const receipt = asset === "BNB" ? await sendBnb(sessionMnemonic, to, amount) : await sendUsdt(sessionMnemonic, to, amount);
      if (!receipt) throw new Error("Transaction was submitted but no receipt was returned yet.");
      setTx({ state: "confirmed", hash: receipt.hash, message: "Transaction confirmed on BSC." });
      addTransaction({
        id: receipt.hash,
        type: "send",
        title: `Sent ${asset}`,
        asset,
        amount: `-${amount}`,
        status: "success",
        hash: receipt.hash,
        gasFee: gasFee ? `${gasFee} BNB` : "Estimated before send",
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
    <header className="mb-4 flex items-center justify-between">
      <button className="flex items-center gap-3 text-left" onClick={() => (authenticated ? go("dashboard") : go(vault ? "unlock" : "landing"))} type="button">
        {authenticated && screen !== "dashboard" ? <ArrowLeft size={18} /> : null}
        <span>
          <span className="block text-lg font-semibold">BitzenX</span>
          <span className="block text-xs text-slate-400">{activeAddress ? shortAddress(activeAddress) : "BSC Super Wallet"}</span>
        </span>
      </button>
      <div className="flex items-center gap-2">
        {authenticated ? <button className="rounded-2xl bg-white/10 p-3" onClick={() => go("settings")} type="button"><Settings size={18} /></button> : null}
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
      {activeTab !== "home" && screen === "dashboard" ? <ComingSoon tab={activeTab} /> : null}
      {activeTab === "home" && screen === "dashboard" ? (
        <HomeDashboard
          address={activeAddress}
          balances={balances}
          loading={loadingBalance}
          balanceVisible={balanceVisible}
          network={network}
          transactions={transactions}
          onRefresh={refreshBalances}
          onScreen={go}
          onToggleBalance={toggleBalanceVisible}
          onTokenDetails={(token) => {
            setSelectedToken(token);
            go("token-details");
          }}
        />
      ) : null}
      {screen === "receive" ? <ReceiveView address={activeAddress} /> : null}
      {screen === "send" ? <SendView asset={asset} setAsset={setAsset} to={to} setTo={setTo} amount={amount} setAmount={setAmount} gasFee={gasFee} tx={tx} error={error} estimateGas={estimateGas} submitTx={submitTx} /> : null}
      {screen === "recharge" ? <RechargeModule /> : null}
      {screen === "qr-pay" ? <QrPayModule /> : null}
      {screen === "transactions" ? <TransactionHistory transactions={transactions} /> : null}
      {screen === "security" ? <SecurityCenter address={activeAddress} /> : null}
      {screen === "settings" ? <SettingsModule onNavigate={go} /> : null}
      {screen === "token-details" ? <div className="space-y-4"><TokenDetails token={selectedToken} /><AddCustomToken /></div> : null}
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
  go: (screen: WalletScreen) => void;
}) {
  const p = props;
  if (p.screen === "landing") {
    return (
      <Panel>
        <div className="mb-7">
          <div className="mb-4 inline-flex rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs text-accent">Local encrypted vault</div>
          <h1 className="text-4xl font-semibold leading-tight">Your BSC wallet, recharge, and payments hub.</h1>
          <p className="mt-4 text-sm leading-6 text-slate-300">Create or import a 12-word wallet. Your recovery phrase and private key are encrypted locally and are never sent to a backend.</p>
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
          <PrimaryButton className="mt-5 w-full" onClick={p.revealSeedPhrase}>Show Recovery Phrase</PrimaryButton>
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
  return <Panel><Title title="Unlock Wallet" subtitle={p.vault?.address ? shortAddress(p.vault.address) : "Encrypted local wallet"} /><Field type="password" value={p.unlockPassword} onChange={(e) => p.setUnlockPassword(e.target.value)} placeholder="Password" onKeyDown={(e) => e.key === "Enter" && p.unlock()} /><ErrorText error={p.error} /><PrimaryButton className="mt-4 w-full" onClick={p.unlock}>Unlock</PrimaryButton><button className="mt-5 w-full text-sm text-danger" onClick={p.removeWallet}>Remove local wallet</button></Panel>;
}

function ReceiveView({ address }: { address: string }) {
  return (
    <Panel>
      <Title title="Receive" subtitle="Use this BSC address for BNB and BEP20 tokens." />
      <div className="mx-auto my-6 flex h-56 w-56 items-center justify-center rounded-3xl bg-white p-4"><QRCodeSVG value={address} size={192} /></div>
      <div className="break-all rounded-2xl border border-white/10 bg-ink/60 p-4 text-center text-sm">{address}</div>
      <PrimaryButton className="mt-4 w-full" onClick={() => navigator.clipboard.writeText(address)}>Copy Address</PrimaryButton>
    </Panel>
  );
}

function SendView(props: {
  asset: Asset;
  setAsset: (asset: Asset) => void;
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
  return (
    <Panel>
      <Title title="Send" subtitle="Transactions are signed locally, then broadcast to BSC." />
      <div className="mb-4 grid grid-cols-2 rounded-2xl border border-white/10 bg-ink p-1">
        {(["BNB", "USDT"] as Asset[]).map((item) => (
          <button key={item} className={`rounded-xl py-3 text-sm ${props.asset === item ? "bg-accent text-black" : "text-slate-300"}`} onClick={() => props.setAsset(item)} type="button">{item}</button>
        ))}
      </div>
      <Field value={props.to} onChange={(e) => props.setTo(e.target.value)} placeholder="Recipient BSC address" />
      <Field className="mt-3" inputMode="decimal" value={props.amount} onChange={(e) => props.setAmount(e.target.value)} placeholder={`Amount in ${props.asset}`} />
      <div className="mt-4 rounded-2xl border border-white/10 bg-ink/60 p-4 text-xs text-slate-300">Estimated gas: <span className="text-slate-100">{props.gasFee ? `${trimAmount(props.gasFee, 8)} BNB` : "Not estimated"}</span></div>
      <ErrorText error={props.error} />
      {props.tx.message ? <p className="mt-3 text-sm text-mint">{props.tx.message}</p> : null}
      {props.tx.hash ? <p className="mt-2 break-all text-xs text-slate-400">Hash: {props.tx.hash}</p> : null}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <SecondaryButton onClick={props.estimateGas} disabled={props.tx.state === "estimating"}>Estimate</SecondaryButton>
        <PrimaryButton onClick={props.submitTx} disabled={props.tx.state === "signing" || props.tx.state === "submitted"}>Send</PrimaryButton>
      </div>
    </Panel>
  );
}

function ComingSoon({ tab }: { tab: string }) {
  return <Panel><h1 className="text-2xl font-semibold capitalize">{tab}</h1><p className="mt-3 text-sm text-slate-400">Market, trade, rewards, and discovery modules are wired into the shell and ready for live APIs.</p></Panel>;
}

function Title({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="mb-5"><h2 className="text-2xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{subtitle}</p></div>;
}

function Warning() {
  return <div className="mb-5 rounded-2xl border border-accent/30 bg-accent/10 p-4 text-xs leading-5 text-yellow-100"><ShieldCheck className="mb-2" size={18} /> Anyone with the 12-word phrase can move your funds. If you lose it, nobody can recover the wallet for you.</div>;
}

function WordGrid({ words }: { words: string[] }) {
  return <div className="grid grid-cols-2 gap-2">{words.map((word, index) => <div key={`${word}-${index}`} className="rounded-2xl border border-white/10 bg-ink/70 px-3 py-3 text-sm"><span className="mr-2 text-slate-500">{index + 1}.</span><span>{word}</span></div>)}</div>;
}
