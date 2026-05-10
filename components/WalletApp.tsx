"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { AnimatePresence, motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, Bell, CheckCircle2, ChevronDown, Copy, Eye, EyeOff, KeyRound, Loader2, Lock, Settings, ShieldCheck, Trash2 } from "lucide-react";
import { ManageTokensPage, TokenDetails } from "@/features/tokens/TokenManagement";
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
import { clearSecurityMetadata, createPinRecord, getBackupStatus, getStoredPin, isValidPin, saveBackupStatus, savePin, verifyPin, type BackupStatus, type PinRecord } from "@/lib/security";
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

function NetworkIcon({ network, size = 18, className = "" }: { network: NetworkKey; size?: number; className?: string }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 32 32",
    className,
    "aria-hidden": true,
    focusable: false
  };

  if (network === "bsc") {
    return (
      <svg {...common}>
        <circle cx="16" cy="16" r="16" fill="#F3BA2F" />
        <path fill="#111827" d="m16 7.2 3.8 3.8-2.2 2.2-1.6-1.6-1.6 1.6-2.2-2.2L16 7.2Zm-6.4 6.4 2.2 2.2-2.2 2.2-2.2-2.2 2.2-2.2Zm12.8 0 2.2 2.2-2.2 2.2-2.2-2.2 2.2-2.2ZM16 14l2 2-2 2-2-2 2-2Zm-1.6 4.8 1.6 1.6 1.6-1.6 2.2 2.2-3.8 3.8-3.8-3.8 2.2-2.2Z" />
      </svg>
    );
  }

  if (network === "ethereum") {
    return (
      <svg {...common}>
        <circle cx="16" cy="16" r="16" fill="#627EEA" />
        <path fill="#fff" fillOpacity=".86" d="M16 4.8 9 16.3l7 4.1 7-4.1L16 4.8Z" />
        <path fill="#fff" fillOpacity=".55" d="M16 4.8v15.6l7-4.1L16 4.8Z" />
        <path fill="#fff" fillOpacity=".86" d="m9 17.7 7 9.5 7-9.5-7 4.1-7-4.1Z" />
        <path fill="#fff" fillOpacity=".55" d="M16 21.8v5.4l7-9.5-7 4.1Z" />
      </svg>
    );
  }

  if (network === "polygon") {
    return (
      <svg {...common}>
        <circle cx="16" cy="16" r="16" fill="#8247E5" />
        <path fill="#fff" d="M20.8 10.8 25 13.2v5.1l-4.2 2.4-4.1-2.4v-2.7l-1.4-.8-1.5.8v2.7l-4.1 2.4-4.2-2.4v-5.1l4.2-2.4 4.1 2.4v2.7l1.5.8 1.4-.8v-2.7l4.1-2.4Zm0 2.7-1.8 1v2.4l1.8 1 1.9-1v-2.4l-1.9-1Zm-11.1 0-1.9 1v2.4l1.9 1 1.8-1v-2.4l-1.8-1Z" />
      </svg>
    );
  }

  if (network === "arbitrum") {
    return (
      <svg {...common}>
        <path fill="#213147" d="m16 2 12 7v14l-12 7-12-7V9L16 2Z" />
        <path fill="#28A0F0" d="m20.7 8.6 3.1 1.8-8.5 14.7-3.1-1.8 8.5-14.7Z" />
        <path fill="#fff" d="m14.3 7.2 2.9 1.7-7.4 12.8-2.9-1.7 7.4-12.8Z" />
        <path fill="none" stroke="#96BEDC" strokeWidth="1.5" d="m16 3.9 10.4 6.1v12L16 28.1 5.6 22V10L16 3.9Z" />
      </svg>
    );
  }

  if (network === "optimism") {
    return (
      <svg {...common}>
        <circle cx="16" cy="16" r="16" fill="#FF0420" />
        <path fill="#fff" d="M7.6 17.1c0-3.1 1.9-5.2 5-5.2 2.9 0 4.7 1.8 4.7 4.8 0 3.1-1.9 5.2-5 5.2-2.9 0-4.7-1.8-4.7-4.8Zm3.1 0c0 1.4.6 2.2 1.8 2.2 1.1 0 1.8-.9 1.8-2.5 0-1.4-.6-2.2-1.8-2.2-1.1 0-1.8.9-1.8 2.5Zm8-5h3.9c2.2 0 3.6 1.2 3.6 3.1 0 2-1.5 3.3-3.8 3.3h-.8v3.1h-2.9v-9.5Zm3.6 4.1c.7 0 1.1-.3 1.1-.9s-.4-.9-1.1-.9h-.7v1.8h.7Z" />
      </svg>
    );
  }

  if (network === "avalanche") {
    return (
      <svg {...common}>
        <circle cx="16" cy="16" r="16" fill="#E84142" />
        <path fill="#fff" d="M17.5 7.8c-.7-1.2-2.3-1.2-3 0L6.9 21.2c-.7 1.2.2 2.8 1.5 2.8h4.4c1.1 0 1.8-.8 2.3-1.6l1.9-3.4 1.9 3.4c.5.8 1.2 1.6 2.3 1.6h2.4c1.4 0 2.2-1.5 1.5-2.8L17.5 7.8Zm-4.8 12.8h-2.1L16 11l2.6 4.5-2.3 4-1.1-1.9-2.5 3Z" />
      </svg>
    );
  }

  if (network === "tron") {
    return (
      <svg {...common}>
        <circle cx="16" cy="16" r="16" fill="#FF060A" />
        <path fill="#fff" d="M6.7 7.3 25.9 11l-9.7 14.2L6.7 7.3Zm3.6 3.2 5.2 10 1.4-7.1-6.6-2.9Zm8.5 3.2-1.3 6.7 4.8-7-3.5.3Zm2.8-2.1-9.4-1.8 5.7 2.5 3.7-.7Z" />
      </svg>
    );
  }

  if (network === "bitcoin") {
    return (
      <svg {...common}>
        <circle cx="16" cy="16" r="16" fill="#F7931A" />
        <path fill="#fff" d="M20.4 14.1c.3-2.1-1.3-3.2-3.4-3.9l.7-2.8-1.7-.4-.7 2.7-1.4-.3.7-2.8-1.7-.4-.7 2.8-2.7-.7-.5 1.9s1.3.3 1.3.3c.7.2.8.6.8 1l-.8 3.2.2.1-.2-.1-1.1 4.5c-.1.2-.3.6-.8.5 0 0-1.3-.3-1.3-.3l-.9 2 2.7.7-.7 2.9 1.7.4.7-2.8 1.4.4-.7 2.8 1.7.4.7-2.9c2.9.5 5 .3 5.9-2.3.7-2.1 0-3.3-1.5-4.1 1.1-.2 1.9-1 2.1-2.5Zm-3.8 5.4c-.5 2.1-4.1 1-5.2.7l.9-3.8c1.2.3 4.8.9 4.3 3.1Zm.5-5.4c-.5 1.9-3.4.9-4.4.7l.9-3.4c1 .2 4 .8 3.5 2.7Z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="16" cy="16" r="16" fill="#111827" />
      <path fill="#14F195" d="M9.1 9.2h14.5l-2.7 3.1H6.4l2.7-3.1Z" />
      <path fill="#80ECFF" d="M11.1 14.4h14.5l-2.7 3.1H8.4l2.7-3.1Z" />
      <path fill="#9945FF" d="M9.1 19.7h14.5l-2.7 3.1H6.4l2.7-3.1Z" />
    </svg>
  );
}

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
  const [unlockPasswordVisible, setUnlockPasswordVisible] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
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
  const [importTokenOpen, setImportTokenOpen] = useState(false);
  const [pinRecord, setPinRecord] = useState<PinRecord | null>(null);
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinUnlock, setPinUnlock] = useState("");
  const [pinLockedMnemonic, setPinLockedMnemonic] = useState("");
  const [backupStatus, setBackupStatus] = useState<BackupStatus>("not-backed-up");
  const [backupVerifyText, setBackupVerifyText] = useState("");
  const [sendConfirmVisible, setSendConfirmVisible] = useState(false);
  const [networkMenuOpen, setNetworkMenuOpen] = useState(false);
  const networkMenuRef = useRef<HTMLSpanElement>(null);

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
      change24h: token.change24h,
      metadataVerified: token.metadataVerified
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
    setPinRecord(getStoredPin());
    setBackupStatus(getBackupStatus());
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
    if (autoLockMinutes <= 0) return;
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

  useEffect(() => {
    if (!networkMenuOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!networkMenuRef.current?.contains(event.target as Node)) setNetworkMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNetworkMenuOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [networkMenuOpen]);

  function resetForms() {
    setPassword("");
    setPasswordConfirm("");
    setUnlockPassword("");
    setConfirmText("");
    setImportText("");
    setError("");
    setGasFee("");
    setPin("");
    setPinConfirm("");
    setPinUnlock("");
    setBackupVerifyText("");
    setSendConfirmVisible(false);
    setTx(initialTx);
  }

  function go(screenName: WalletScreen) {
    setError("");
    if (screenName !== "manage-tokens") setImportTokenOpen(false);
    setScreen(screenName);
  }

  function openReceiveForToken(token: WalletToken) {
    if (token.network) setNetwork(token.network);
    go("receive");
  }

  function openSendForToken(token: WalletToken) {
    if (token.network) setNetwork(token.network);
    if (token.id) setSendTokenId(token.id);
    go("send");
  }

  function openTokenImport() {
    setImportTokenOpen(true);
    setScreen("manage-tokens");
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
      saveBackupStatus("not-backed-up");
      setBackupStatus("not-backed-up");
      setScreen("pin-setup");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not encrypt wallet.");
    }
  }

  async function unlock() {
    if (!vault) return;
    setUnlocking(true);
    try {
      const mnemonic = await decryptMnemonic(vault, unlockPassword);
      setSessionMnemonic(mnemonic);
      setActiveAddress(walletFromMnemonic(mnemonic).address);
      resetForms();
      setScreen("dashboard");
    } catch {
      setError("Incorrect password or damaged local vault.");
    } finally {
      setUnlocking(false);
    }
  }

  function lock() {
    if (pinRecord && sessionMnemonic) setPinLockedMnemonic(sessionMnemonic);
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
    clearSecurityMetadata();
    setPinRecord(null);
    setBackupStatus("not-backed-up");
    setPinLockedMnemonic("");
    setVault(null);
    setSessionMnemonic("");
    setActiveAddress("");
    setPendingMnemonic("");
    resetForms();
    setDeleteConfirming(false);
    setScreen("landing");
  }

  async function setupPin(skip = false) {
    setError("");
    if (skip) {
      setScreen("dashboard");
      return;
    }
    if (!isValidPin(pin)) {
      setError("Use a 4 to 6 digit PIN.");
      return;
    }
    if (pin !== pinConfirm) {
      setError("PIN entries do not match.");
      return;
    }
    const next = await createPinRecord(pin);
    savePin(next);
    setPinRecord(next);
    setPin("");
    setPinConfirm("");
    setScreen("dashboard");
  }

  async function unlockWithPin() {
    setError("");
    if (!pinRecord || !pinLockedMnemonic) {
      setError("PIN unlock is available after this browser session has been password-unlocked once.");
      return;
    }
    if (!(await verifyPin(pinUnlock, pinRecord))) {
      setError("Incorrect PIN.");
      return;
    }
    setSessionMnemonic(pinLockedMnemonic);
    setPinUnlock("");
    setScreen("dashboard");
  }

  function verifyBackupPhrase() {
    if (!sessionMnemonic) return;
    if (normalizeMnemonic(backupVerifyText) !== sessionMnemonic) {
      setError("The phrase does not match this wallet.");
      return;
    }
    saveBackupStatus("backed-up");
    setBackupStatus("backed-up");
    setBackupVerifyText("");
    setError("");
    setScreen("security");
  }

  async function revealSeedWithPassword(passwordValue: string) {
    if (!vault) throw new Error("No encrypted wallet is stored.");
    return decryptMnemonic(vault, passwordValue);
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
      if (selectedSendToken.network !== network) throw new Error("Selected token does not match the active network.");
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
    if (!sendConfirmVisible) {
      try {
        validateSendRequest(network, selectedSendToken, to, amount);
        setSendConfirmVisible(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Review send details before continuing.");
      }
      return;
    }
    setTx({ state: "signing", message: "Signing locally in this browser..." });
    try {
      // Sensitive boundary: sessionMnemonic remains in client memory and is used only for local signing.
      if (!sessionMnemonic) throw new Error("Unlock the wallet first.");
      if (!selectedSendToken) throw new Error("Select a token to send.");
      validateSendRequest(network, selectedSendToken, to, amount);
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
      setSendConfirmVisible(false);
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
              <span ref={networkMenuRef} className="relative inline-flex min-w-0 max-w-[10.5rem]">
                <button
                  className="group inline-flex min-w-0 items-center gap-1.5 rounded-xl border border-accent/25 bg-white/[0.09] px-2 py-1 text-xs font-semibold text-slate-100 shadow-[0_0_20px_rgba(243,186,47,0.08)] backdrop-blur transition hover:border-accent/50 hover:bg-white/[0.13]"
                  onClick={() => setNetworkMenuOpen((open) => !open)}
                  type="button"
                  aria-expanded={networkMenuOpen}
                  aria-haspopup="listbox"
                  aria-label="Choose network"
                >
                  <NetworkIcon network={network} size={15} className="shrink-0" />
                  <span className="min-w-0 truncate text-accent">{networkConfig.shortName}</span>
                  <ChevronDown size={13} className={`shrink-0 text-slate-300 transition ${networkMenuOpen ? "rotate-180" : ""}`} />
                </button>
                <select
                  className="sr-only"
                  value={network}
                  onChange={(event) => {
                    setNetwork(event.target.value as NetworkKey);
                    setNetworkMenuOpen(false);
                  }}
                  aria-label="Network selector"
                  data-testid="network-selector"
                >
                  {NETWORK_OPTIONS.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}
                </select>
                <AnimatePresence>
                  {networkMenuOpen ? (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.16, ease: "easeOut" }}
                      className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(14.5rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#0b1018]/95 p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.45),0_0_30px_rgba(243,186,47,0.08)] backdrop-blur-xl"
                      role="listbox"
                      aria-label="Networks"
                    >
                      {NETWORK_OPTIONS.map((item) => {
                        const active = item.key === network;
                        return (
                          <button
                            key={item.key}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                              active
                                ? "bg-accent/[0.12] text-white shadow-[inset_0_0_0_1px_rgba(243,186,47,0.28),0_0_18px_rgba(243,186,47,0.12)]"
                                : "text-slate-300 hover:bg-white/[0.07] hover:text-white"
                            }`}
                            onClick={() => {
                              setNetwork(item.key);
                              setNetworkMenuOpen(false);
                            }}
                            type="button"
                            role="option"
                            aria-selected={active}
                          >
                            <NetworkIcon network={item.key} size={18} className="shrink-0" />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${active ? "bg-accent/20 text-accent" : "bg-white/[0.06] text-slate-400"}`}>{item.shortName}</span>
                          </button>
                        );
                      })}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
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
          unlockPasswordVisible,
          unlocking,
          pinEnabled: Boolean(pinRecord),
          pinUnlock,
          pinUnlockAvailable: Boolean(pinLockedMnemonic),
          error,
          setConfirmText,
          setImportText,
          setPassword,
          setPasswordConfirm,
          setUnlockPassword,
          setUnlockPasswordVisible,
          setPinUnlock,
          startCreate,
          revealSeedPhrase,
          startImport,
          acceptConfirm,
          acceptImport,
          createVault,
          unlock,
          unlockWithPin,
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
          onImportToken={openTokenImport}
        />
      ) : null}
      {screen === "receive" ? <ReceiveView address={currentAddress} network={network} clipboardNotice={clipboardNotice} onCopy={copyAddress} /> : null}
      {backupStatus === "not-backed-up" && screen === "dashboard" && activeTab === "home" ? (
        <div className="mb-4 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-sm leading-6 text-yellow-100">
          Backup phrase not verified. Confirm your recovery phrase before adding significant funds.
          <button className="mt-3 block text-accent" onClick={() => go("backup-verify")} type="button">Verify backup phrase</button>
        </div>
      ) : null}
      {screen === "send" ? <SendView network={network} tokenId={selectedSendToken?.id || ""} tokens={sendTokens} setTokenId={(value) => { setSendTokenId(value); setSendConfirmVisible(false); }} to={to} setTo={(value) => { setTo(value); setSendConfirmVisible(false); }} amount={amount} setAmount={(value) => { setAmount(value); setSendConfirmVisible(false); }} gasFee={gasFee} tx={tx} error={error} estimateGas={estimateGas} submitTx={submitTx} confirmVisible={sendConfirmVisible} customTokens={customTokens} /> : null}
      {screen === "recharge" ? <RechargeModule /> : null}
      {screen === "qr-pay" ? <QrPayModule /> : null}
      {screen === "transactions" ? <TransactionHistory transactions={transactions} /> : null}
      {screen === "security" ? <SecurityCenter address={activeAddress} backupStatus={backupStatus} pinEnabled={Boolean(pinRecord)} deleteConfirming={deleteConfirming} onPinChanged={() => setPinRecord(getStoredPin())} onVerifyBackup={() => go("backup-verify")} onRevealSeed={revealSeedWithPassword} onDeleteLocalWallet={removeWallet} /> : null}
      {screen === "settings" ? <SettingsModule onNavigate={go} /> : null}
      {screen === "provider-settings" ? <ProviderSettings /> : null}
      {screen === "token-details" ? <TokenDetails token={selectedToken} onReceive={openReceiveForToken} onSend={openSendForToken} /> : null}
      {screen === "manage-tokens" ? <ManageTokensPage network={network} importOpen={importTokenOpen} onImportOpenChange={setImportTokenOpen} /> : null}
      {screen === "pin-setup" ? <PinSetupView pin={pin} pinConfirm={pinConfirm} error={error} setPin={setPin} setPinConfirm={setPinConfirm} onSave={() => setupPin(false)} onSkip={() => setupPin(true)} /> : null}
      {screen === "backup-verify" ? <BackupVerifyView value={backupVerifyText} error={error} onChange={setBackupVerifyText} onVerify={verifyBackupPhrase} /> : null}
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
  unlockPasswordVisible: boolean;
  unlocking: boolean;
  pinEnabled: boolean;
  pinUnlock: string;
  pinUnlockAvailable: boolean;
  error: string;
  setConfirmText: (value: string) => void;
  setImportText: (value: string) => void;
  setPassword: (value: string) => void;
  setPasswordConfirm: (value: string) => void;
  setUnlockPassword: (value: string) => void;
  setUnlockPasswordVisible: (value: boolean) => void;
  setPinUnlock: (value: string) => void;
  startCreate: () => void;
  revealSeedPhrase: () => void;
  startImport: () => void;
  acceptConfirm: () => void;
  acceptImport: () => void;
  createVault: () => void;
  unlock: () => void;
  unlockWithPin: () => void;
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
  return (
    <Panel className="min-h-[34rem] p-6">
      <div className="flex min-h-[31rem] flex-col">
        <div className="flex flex-1 flex-col items-center text-center">
          <BrandLogo size="lg" className="mb-6 mt-2 h-16 w-16 rounded-[1.35rem] shadow-[0_0_34px_rgba(49,208,170,0.26)]" />
          <h1 className="text-3xl font-semibold leading-tight">Unlock Wallet</h1>
          <p className="mt-2 text-sm text-slate-400">Enter your password to access your wallet</p>
          <div className="mt-3 rounded-full border border-white/10 bg-white/[0.055] px-3 py-1.5 font-mono text-xs text-slate-300">
            {p.vault?.address ? shortAddress(p.vault.address) : "Encrypted local wallet"}
          </div>

          <div className="mt-8 w-full text-left">
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Password</label>
            <div className="flex h-14 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus-within:border-accent/60 focus-within:shadow-[0_0_0_3px_rgba(243,186,47,0.12)]">
              <KeyRound size={18} className="shrink-0 text-accent" />
              <input
                className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-500"
                type={p.unlockPasswordVisible ? "text" : "password"}
                value={p.unlockPassword}
                onChange={(e) => p.setUnlockPassword(e.target.value)}
                placeholder="Enter password"
                onKeyDown={(e) => e.key === "Enter" && !p.unlocking && p.unlock()}
              />
              <button
                className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
                onClick={() => p.setUnlockPasswordVisible(!p.unlockPasswordVisible)}
                type="button"
                aria-label={p.unlockPasswordVisible ? "Hide password" : "Show password"}
              >
                {p.unlockPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <ErrorText error={p.error} />
          {p.pinEnabled ? (
            <div className="mt-4 w-full rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-left">
              <div className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">PIN unlock</div>
              <div className="flex gap-2">
                <input
                  className="field h-12 flex-1 text-center tracking-[0.35em]"
                  inputMode="numeric"
                  maxLength={6}
                  type="password"
                  value={p.pinUnlock}
                  onChange={(e) => p.setPinUnlock(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="PIN"
                  disabled={!p.pinUnlockAvailable}
                />
                <SecondaryButton className="h-12 px-4 py-0 text-sm" onClick={p.unlockWithPin} disabled={!p.pinUnlockAvailable} type="button">Use PIN</SecondaryButton>
              </div>
              {!p.pinUnlockAvailable ? <p className="mt-2 text-xs text-slate-500">PIN unlock resumes an active browser session after password unlock.</p> : null}
            </div>
          ) : null}
          <button
            className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#31d0aa] via-[#05c46b] to-[#f3ba2f] px-4 py-3.5 font-semibold text-black shadow-[0_14px_38px_rgba(5,196,107,0.18)] transition hover:brightness-110 disabled:opacity-60 disabled:hover:brightness-100"
            onClick={p.unlock}
            disabled={p.unlocking}
            type="button"
          >
            {p.unlocking ? <Loader2 className="animate-spin" size={18} /> : null}
            {p.unlocking ? "Unlocking" : "Unlock"}
          </button>

          <div className="mt-4 rounded-2xl border border-accent/20 bg-accent/10 px-4 py-3 text-xs leading-5 text-slate-300">
            Your seed phrase stays encrypted on this device.
          </div>
        </div>

        <button
          className={`mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-danger/30 px-4 py-3 text-sm font-medium text-danger transition hover:bg-danger/10 ${p.deleteConfirming ? "bg-danger/10" : "bg-danger/[0.03]"}`}
          onClick={p.removeWallet}
          type="button"
        >
          <Trash2 size={16} />
          {p.deleteConfirming ? "Tap again to delete local wallet" : "Remove local wallet"}
        </button>
      </div>
    </Panel>
  );
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
  confirmVisible: boolean;
  customTokens: WalletToken[];
}) {
  const config = getNetworkConfig(props.network);
  const selectedToken = props.tokens.find((token) => token.id === props.tokenId);
  const unsupported = !selectedToken || (config.kind !== "evm" && config.kind !== "tron");
  const txUrl = props.tx.hash ? explorerTxUrl(props.network, props.tx.hash) : "";
  const feeLabel = props.gasFee && Number.isFinite(Number(props.gasFee)) ? `${trimAmount(props.gasFee, 8)} ${config.nativeSymbol}` : props.gasFee;
  const networkMismatch = Boolean(selectedToken && selectedToken.network !== props.network);
  const suspiciousWarning = selectedToken ? getTokenRiskWarning(selectedToken, props.customTokens, props.tokens) : "";
  const totalCost = props.amount ? `${props.amount} ${selectedToken?.symbol || ""}${feeLabel ? ` + ${feeLabel}` : ""}` : "Enter amount";
  return (
    <Panel className="bg-[radial-gradient(circle_at_15%_0%,rgba(5,196,107,0.13),transparent_13rem),rgba(16,20,29,0.92)]">
      <Title title="Send" subtitle={unsupported ? `${config.name} sending is disabled until safely implemented.` : `Transactions are signed locally, then broadcast to ${config.name}.`} />
      <Select value={props.tokenId} onChange={(event) => props.setTokenId(event.target.value)} disabled={props.tokens.length === 0}>
        {props.tokens.map((token) => <option key={token.id} value={token.id}>{token.symbol} - {token.name}</option>)}
      </Select>
      {unsupported ? <div className="mt-4 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-sm text-yellow-100">{config.addressLabel || `${config.name} sends are unavailable in this wallet.`}</div> : null}
      {networkMismatch ? <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-red-100">Selected token network does not match the active wallet network. Switch network before sending.</div> : null}
      {suspiciousWarning ? <div className="mt-4 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-sm text-yellow-100">{suspiciousWarning}</div> : null}
      <Field className="mt-3" value={props.to} onChange={(e) => props.setTo(e.target.value)} placeholder={`Recipient ${config.shortName} address`} disabled={unsupported} />
      <Field className="mt-3" inputMode="decimal" value={props.amount} onChange={(e) => props.setAmount(e.target.value)} placeholder={`Amount in ${selectedToken?.symbol || config.nativeSymbol}`} disabled={unsupported} />
      <div className="mt-4 rounded-2xl border border-white/10 bg-ink/60 p-4 text-xs leading-5 text-slate-300">Estimated network fee: <span className="text-slate-100">{feeLabel || "Run estimate before sending"}</span></div>
      <ErrorText error={props.error} />
      {props.tx.message ? <p className="mt-3 text-sm text-mint">{props.tx.message}</p> : null}
      {props.tx.hash ? <p className="mt-2 break-all text-xs text-slate-400">Hash: {txUrl ? <a className="text-accent" href={txUrl} target="_blank" rel="noreferrer">{props.tx.hash}</a> : props.tx.hash}</p> : null}
      {props.confirmVisible && selectedToken ? (
        <div className="mt-4 rounded-2xl border border-accent/25 bg-accent/10 p-4 text-sm">
          <h3 className="font-semibold text-accent">Confirm transaction</h3>
          <ConfirmRow label="Token" value={selectedToken.symbol} />
          <ConfirmRow label="Amount" value={props.amount || "0"} />
          <ConfirmRow label="Recipient" value={props.to || "Missing"} mono />
          <ConfirmRow label="Network" value={config.name} />
          <ConfirmRow label="Estimated gas" value={feeLabel || "Not estimated"} />
          <ConfirmRow label="Total cost" value={totalCost} />
          <p className="mt-3 text-xs leading-5 text-yellow-100">Confirm the recipient and network. Blockchain transfers cannot be reversed.</p>
        </div>
      ) : null}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <SecondaryButton onClick={props.estimateGas} disabled={unsupported || props.tx.state === "estimating"}>{props.tx.state === "estimating" ? "Estimating" : "Estimate"}</SecondaryButton>
        <PrimaryButton onClick={props.submitTx} disabled={unsupported || networkMismatch || props.tx.state === "signing" || props.tx.state === "submitted"}>{props.tx.state === "signing" || props.tx.state === "submitted" ? "Sending" : props.confirmVisible ? "Confirm Send" : "Review Send"}</PrimaryButton>
      </div>
    </Panel>
  );
}

function validateSendRequest(network: NetworkKey, token: TokenConfig | undefined, to: string, amount: string) {
  const config = getNetworkConfig(network);
  if (!token) throw new Error("Select a token to send.");
  if (token.network !== network) throw new Error("Selected token does not match the active network.");
  if (!amount || Number(amount) <= 0) throw new Error("Enter a valid amount.");
  if (config.kind === "tron") {
    if (!isTronAddress(to)) throw new Error("Enter a valid TRON recipient address.");
    return;
  }
  if (config.kind === "evm") {
    if (!ethers.isAddress(to)) throw new Error("Enter a valid EVM recipient address.");
    return;
  }
  throw new Error(`${config.name} sends are not implemented yet.`);
}

function getTokenRiskWarning(token: TokenConfig, customTokens: WalletToken[], visibleTokens: TokenConfig[]) {
  const isCustom = customTokens.some((item) => item.id === token.id);
  if (!isCustom) return "";
  const duplicate = visibleTokens.filter((item) => item.network === token.network && item.symbol.toUpperCase() === token.symbol.toUpperCase()).length > 1;
  if (!token.metadataVerified || !token.name.trim() || !token.symbol.trim() || duplicate) {
    return "Suspicious custom token. Verify contract metadata and duplicate symbols before interacting.";
  }
  return "Custom tokens can be risky. Verify contract before interacting.";
}

function ConfirmRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="mt-2 flex justify-between gap-4 border-b border-white/10 pb-2 last:border-b-0"><span className="text-slate-400">{label}</span><span className={`max-w-[12rem] truncate text-right text-slate-100 ${mono ? "font-mono text-xs" : ""}`}>{value}</span></div>;
}

function PinSetupView({ pin, pinConfirm, error, setPin, setPinConfirm, onSave, onSkip }: { pin: string; pinConfirm: string; error: string; setPin: (value: string) => void; setPinConfirm: (value: string) => void; onSave: () => void; onSkip: () => void }) {
  return (
    <Panel>
      <Title title="Set PIN Lock" subtitle="Add an optional 4 to 6 digit PIN for quick session unlock on this device." />
      <Field inputMode="numeric" maxLength={6} type="password" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="PIN" />
      <Field className="mt-3" inputMode="numeric" maxLength={6} type="password" value={pinConfirm} onChange={(event) => setPinConfirm(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Confirm PIN" />
      <ErrorText error={error} />
      <PrimaryButton className="mt-4 w-full" onClick={onSave} type="button">Save PIN</PrimaryButton>
      <SecondaryButton className="mt-3 w-full" onClick={onSkip} type="button">Skip for now</SecondaryButton>
    </Panel>
  );
}

function BackupVerifyView({ value, error, onChange, onVerify }: { value: string; error: string; onChange: (value: string) => void; onVerify: () => void }) {
  return (
    <Panel>
      <Title title="Verify Backup Phrase" subtitle="Enter your 12-word recovery phrase to mark this wallet as backed up." />
      <Warning />
      <textarea className="field min-h-32" value={value} onChange={(event) => onChange(event.target.value)} placeholder="word one two..." />
      <ErrorText error={error} />
      <PrimaryButton className="mt-4 w-full" onClick={onVerify} type="button">Verify backup phrase</PrimaryButton>
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
