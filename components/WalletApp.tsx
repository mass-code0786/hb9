"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Bell, Copy, Settings } from "lucide-react";
import { HomeDashboard } from "@/features/home/HomeDashboard";
import { SettingsModule, StaticInfoPage } from "@/features/settings/SettingsModule";
import { TransactionHistory } from "@/features/transactions/TransactionHistory";
import { HbMainFlow } from "@/features/halal-business/HbMainFlow";
import { captureHbReferralFromUrl } from "@/lib/referral";
import type { AppTab, WalletScreen } from "@/types/wallet";
import { useWalletStore } from "@/store/walletStore";
import { useTransactionStore } from "@/store/transactionStore";
import { WalletShell } from "@/components/ui/WalletShell";
import { EmptyState, ErrorText, Field, Panel, PrimaryButton, SecondaryButton, Select } from "@/components/ui/Primitives";
import { BrandLogo } from "@/components/BrandLogo";
import { ExternalWalletConnect } from "@/components/wallet/ExternalWalletConnect";
import { HbLandingPage } from "@/components/halal-business/HbLandingPage";
import {
  clearHbToken,
  createHbWithdrawal,
  createNowPaymentsDeposit,
  fetchHbWallet,
  fetchHbWalletAddress,
  fetchHbMe,
  fetchHbSponsorPreview,
  fetchNowPaymentsDeposit,
  forgotHbPassword,
  getHbToken,
  loginHb,
  logoutHb,
  resetHbPassword,
  saveHbToken,
  type HbDeposit,
  type HbSponsorPreview,
  type HbWithdrawal
} from "@/services/halalBusinessService";

const DEV_BOUND_WALLET_KEY = "hb9.usdtBep20Address";
const HB_ACCOUNT_ID_KEY = "hb9.accountId";
const HB_WITHDRAWAL_MIN_USD = 9;
const HB_WITHDRAWAL_MIN_ERROR = "Minimum withdrawal amount is $9.";

function getOrCreateHbAccountId() {
  if (typeof window === "undefined") return "HB9-ACCOUNT";
  const existing = window.localStorage.getItem(HB_ACCOUNT_ID_KEY);
  if (existing && existing.startsWith("HB9-")) return existing;
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  const next = `HB9-${random}`;
  window.localStorage.setItem(HB_ACCOUNT_ID_KEY, next);
  return next;
}

export function WalletApp() {
  const { screen, activeTab, balanceVisible, setScreen, setActiveTab, toggleBalanceVisible } = useWalletStore();
  const transactions = useTransactionStore((state) => state.transactions);
  const setTransactions = useTransactionStore((state) => state.setTransactions);
  const [accountId, setAccountId] = useState("HB9-ACCOUNT");
  const [token, setToken] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [initialAuthMode, setInitialAuthMode] = useState<"login" | "register" | "forgot">("login");
  const [authSurface, setAuthSurface] = useState<"landing" | "auth">("landing");

  useEffect(() => {
    captureHbReferralFromUrl();
    const nextMode = window.location.pathname.includes("register") ? "register" : window.location.pathname.includes("forgot-password") ? "forgot" : "login";
    setInitialAuthMode(nextMode);
    setAuthSurface(nextMode === "login" ? "landing" : "auth");
    setAccountId(getOrCreateHbAccountId());
    setTransactions([]);
    const stored = getHbToken();
    if (!stored) {
      setAuthChecked(true);
      return;
    }
    fetchHbMe(stored)
      .then(() => {
        window.location.assign("/halal-business");
      })
      .catch(() => {
        clearHbToken();
        setToken("");
      })
      .finally(() => setAuthChecked(true));
  }, [setScreen, setTransactions]);

  useEffect(() => {
    const handleSessionCleared = () => {
      setToken("");
      setTransactions([]);
      setScreen("dashboard");
    };
    window.addEventListener("hb9:session-cleared", handleSessionCleared);
    return () => window.removeEventListener("hb9:session-cleared", handleSessionCleared);
  }, [setScreen, setTransactions]);

  async function handleLogout() {
    const activeToken = token || getHbToken();
    if (activeToken) await logoutHb(activeToken).catch(() => undefined);
    clearHbToken();
    setToken("");
    setScreen("dashboard");
  }

  const header = (
    <header className="mb-4 flex items-center justify-between gap-3 text-white">
      <div className="min-w-0">
        <BrandLogo size="md" showText />
        <div className="mt-2 flex items-center gap-2 text-xs text-sky-100/70">
          <span className="min-w-0 truncate">{accountId}</span>
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">Display ID</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {token ? <div className="hidden sm:block">
          <ExternalWalletConnect compact />
        </div> : null}
        <button className="rounded-2xl bg-[#0b1728]/75 p-3" onClick={() => setScreen("settings")} type="button" aria-label="Open settings">
          <Settings size={18} />
        </button>
        <button className="rounded-2xl bg-[#0b1728]/75 p-3" type="button" aria-label="Notifications">
          <Bell size={18} />
        </button>
        {token ? <button className="rounded-2xl border border-cyan-300/20 bg-[#0b1728]/75 px-3 py-2 text-xs font-semibold text-sky-100" onClick={handleLogout} type="button">Logout</button> : null}
      </div>
    </header>
  );

  if (!authChecked) {
    return <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-5 text-white">{header}<Panel><p className="text-sm text-slate-300">Checking session...</p></Panel></main>;
  }

  if (!token) {
    const referralCode = typeof window === "undefined" ? "" : window.localStorage.getItem("hb9.sourceReferral") || "";
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 py-5 text-white">
        {authSurface === "landing" ? (
          <HbLandingPage
            referralCode={referralCode}
            onAuthenticated={(nextToken) => {
              saveHbToken(nextToken);
              window.location.assign("/halal-business");
            }}
          />
        ) : (
          <>
            {header}
            <AuthPanel
              accountId={accountId}
              initialMode={initialAuthMode}
              onAuthenticated={(nextToken) => {
                saveHbToken(nextToken);
                window.location.assign("/halal-business");
              }}
            />
          </>
        )}
      </main>
    );
  }

  return (
    <WalletShell
      activeTab={activeTab}
      onTabChange={(tab: AppTab) => {
        setActiveTab(tab);
        setScreen("dashboard");
      }}
      header={header}
    >
      <div className="mb-4 sm:hidden">
        <ExternalWalletConnect />
      </div>
      {activeTab === "home" && screen === "dashboard" ? (
        <HomeDashboard
          accountId={accountId}
          transactions={transactions}
          balanceVisible={balanceVisible}
          onScreen={setScreen}
          onTab={(tab) => {
            setActiveTab(tab);
            setScreen("dashboard");
          }}
          onToggleBalance={toggleBalanceVisible}
        />
      ) : null}
      {activeTab === "products" && screen === "dashboard" ? <HbMainFlow tab="products" walletAddress={accountId} /> : null}
      {activeTab === "team" && screen === "dashboard" ? <HbMainFlow tab="team" walletAddress={accountId} /> : null}
      {activeTab === "income" && screen === "dashboard" ? <HbMainFlow tab="income" walletAddress={accountId} /> : null}
      {activeTab === "wallet" && screen === "dashboard" ? <HbMainFlow tab="wallet" walletAddress={accountId} /> : null}
      {screen === "deposit" ? <DepositView /> : null}
      {screen === "withdrawal" ? <WithdrawalView /> : null}
      {screen === "transactions" ? <TransactionHistory transactions={transactions} /> : null}
      {screen === "settings" ? <SettingsModule onNavigate={setScreen} /> : null}
      {screen === "about" ? <StaticInfoPage title="About" /> : null}
      {screen === "help" ? <StaticInfoPage title="Help Center" /> : null}
      {screen === "terms" ? <StaticInfoPage title="Terms" /> : null}
    </WalletShell>
  );
}

function AuthPanel({ accountId, initialMode, onAuthenticated }: { accountId: string; initialMode: "login" | "register" | "forgot"; onAuthenticated: (token: string) => void }) {
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">(initialMode);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [sponsorPreview, setSponsorPreview] = useState<HbSponsorPreview>(null);
  const referralCode = typeof window === "undefined" ? "" : window.localStorage.getItem("hb9.sourceReferral") || "";

  useEffect(() => {
    if (!referralCode) return;
    fetchHbSponsorPreview(referralCode)
      .then((result) => setSponsorPreview(result.sponsor))
      .catch(() => setSponsorPreview(null));
  }, [referralCode]);

  async function submit() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "login") {
        const result = await loginHb({ identifier, password });
        onAuthenticated(result.token);
        return;
      }
      if (mode === "register") return;
      if (mode === "forgot") {
        const result = await forgotHbPassword({ identifier });
        setNotice(result.resetToken ? `Reset token: ${result.resetToken}` : "If the account exists, reset instructions will be sent.");
        setMode("reset");
        return;
      }
      await resetHbPassword({ token: resetToken, password });
      setNotice("Password reset complete. Login with the new password.");
      setPassword("");
      setResetToken("");
      setMode("login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <div className="mb-5">
        <BrandLogo className="mb-4" size="lg" showText />
        <div className="text-xs uppercase tracking-[0.16em] text-accent">{mode === "register" ? "Wallet-first account creation" : "Decentralized identity login"}</div>
        <h1 className="mt-2 text-2xl font-semibold">{mode === "register" ? "Create your decentralized HB9 account with your wallet." : "Connect your wallet to access HB9"}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">{mode === "register" ? "No mobile number, email, or password required for wallet signup." : "No seed phrase. No private key storage."}</p>
      </div>
      <ExternalWalletConnect authenticate referralCode={referralCode} buttonLabel={mode === "register" ? "Sign Up" : "Connect Wallet"} onAuthenticated={(token) => onAuthenticated(token)} />
      {referralCode ? <div className="mt-3 rounded-2xl border border-accent/25 bg-accent/10 p-3 text-sm text-accent"><div className="text-xs uppercase tracking-[0.16em]">Auto Sponsor Bind</div><div className="mt-1 font-semibold">{sponsorPreview?.displayName || "Sponsor preview pending"}</div><div className="mt-1 break-all font-mono text-xs text-sky-100/80">{sponsorPreview?.referralCode || referralCode}</div></div> : null}
      <button className="mt-4 w-full rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 px-3 py-2 text-sm font-semibold text-slate-200" onClick={() => {
        if (mode === "register") setMode("login");
        setShowPasswordLogin((current) => mode === "register" ? true : !current);
      }} type="button">
        Use mobile/password instead
      </button>
      {mode !== "register" && showPasswordLogin ? <div className="mt-4 border-t border-sky-200/10 pt-4">
      <div className="mb-3 text-sm font-semibold text-slate-200">{mode === "forgot" ? "Forgot password" : mode === "reset" ? "Reset password" : "Mobile/password login"}</div>
      {mode === "login" || mode === "forgot" ? <Field className="mb-3" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Mobile number or email" /> : null}
      {mode === "reset" ? <Field className="mb-3" value={resetToken} onChange={(event) => setResetToken(event.target.value)} placeholder="Reset token" /> : null}
      {mode !== "forgot" ? <Field className="mb-3" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "reset" ? "New password" : "Password"} /> : null}
      <div className="mb-4 rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-3 font-mono text-xs text-slate-300">HB9 Wallet ID: {accountId}</div>
      {notice ? <div className="mb-3 rounded-2xl border border-mint/30 bg-mint/10 p-3 text-sm text-mint">{notice}</div> : null}
      <ErrorText error={error} />
      <PrimaryButton className="w-full" onClick={submit} disabled={busy} type="button">{busy ? "Please wait" : mode === "forgot" ? "Request Reset" : mode === "reset" ? "Reset Password" : "Login"}</PrimaryButton>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <button className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 px-3 py-2 text-slate-200" onClick={() => { setError(""); setMode("register"); setShowPasswordLogin(false); }} type="button">Wallet signup</button>
        <button className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 px-3 py-2 text-slate-200" onClick={() => { setError(""); setMode(mode === "forgot" ? "login" : "forgot"); }} type="button">{mode === "forgot" ? "Back" : "Forgot password"}</button>
      </div>
      </div> : null}
    </Panel>
  );
}

function DepositView() {
  const [amountUsd, setAmountUsd] = useState("");
  const payCurrency = "usdtbsc";
  const [deposit, setDeposit] = useState<HbDeposit | null>(null);
  const [depositAddress, setDepositAddress] = useState("");
  const [payment, setPayment] = useState<Record<string, unknown> | null>(null);
  const [deposits, setDeposits] = useState<HbDeposit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const token = getHbToken();

  async function refresh() {
    if (!token) return;
    const wallet = await fetchHbWallet(token);
    setDepositAddress(wallet.depositAddress || "");
    setDeposits(wallet.deposits);
    if (deposit?.payment_id) {
      const next = await fetchNowPaymentsDeposit(token, deposit.payment_id);
      setDeposit(next.deposit);
      setPayment(next.payment);
    }
  }

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  async function createPayment() {
    if (!token) {
      setError("Log in to HB9 before creating a deposit.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (Number(amountUsd) + Number.EPSILON < 4) {
        setError("Minimum deposit is $4");
        return;
      }
      const result = await createNowPaymentsDeposit(token, { amountUsd: Number(amountUsd), payCurrency });
      setPayment(result.payment);
      const wallet = await fetchHbWallet(token);
      const created = wallet.deposits.find((item) => item.id === result.depositId) || null;
      setDeposit(created);
      setDeposits(wallet.deposits);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit payment could not be created.");
    } finally {
      setBusy(false);
    }
  }

  const payAddress = String(payment?.pay_address || deposit?.pay_address || "");
  const payAmount = String(payment?.pay_amount || deposit?.pay_amount || "");
  const paymentId = String(payment?.payment_id || deposit?.payment_id || "");
  const status = String(payment?.payment_status || deposit?.payment_status || deposit?.status || "pending");
  const currency = String(payment?.pay_currency || deposit?.pay_currency || payCurrency).toUpperCase();

  return (
    <div className="space-y-4" data-testid="deposit-screen">
      <Panel>
        <Title title="Deposit USDT BEP20 on BSC Mainnet" subtitle="Minimum deposit $4. Your HB9 USDT balance credits only after BSC Mainnet confirmation." />
        <div className="mb-4 rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4">
          <div className="grid gap-2 text-sm text-slate-300">
            <DetailRow label="Token" value="USDT BEP20" />
            <DetailRow label="Network" value="BSC Mainnet" />
            <DetailRow label="Minimum" value="$4.00" />
            <DetailRow label="Deposit address" value={depositAddress || "Loading"} mono />
          </div>
          <SecondaryButton className="mt-3 flex w-full items-center justify-center gap-2" onClick={() => depositAddress && navigator.clipboard?.writeText(depositAddress)} disabled={!depositAddress} type="button">
            <Copy className="h-4 w-4" /> Copy Deposit Address
          </SecondaryButton>
        </div>
        <Field inputMode="decimal" value={amountUsd} onChange={(event) => setAmountUsd(event.target.value)} placeholder="Amount in USD / USDT" />
        <Select className="mt-3" value={payCurrency} disabled>
          <option value="usdtbsc">USDT BEP20</option>
        </Select>
        <ErrorText error={error} />
        <PrimaryButton className="mt-4 w-full" onClick={createPayment} disabled={busy || Number(amountUsd) < 4} type="button">
          {busy ? "Creating" : "Create Deposit"}
        </PrimaryButton>
      </Panel>
      {payment || deposit ? (
        <Panel>
          <h2 className="mb-4 text-lg font-semibold">Payment Details</h2>
          {(payAddress || depositAddress) ? <div className="mx-auto mb-4 flex aspect-square w-full max-w-[13rem] items-center justify-center rounded-[1.5rem] bg-white p-4"><QRCodeSVG value={payAddress || depositAddress} size={180} /></div> : null}
          <DetailRow label="Payment ID" value={paymentId || "Pending"} />
          <DetailRow label="Status" value={status} />
          <DetailRow label="Pay amount" value={payAmount ? `${payAmount} ${currency}` : "Pending"} />
          <DetailRow label="Pay address" value={payAddress || depositAddress || "Pending"} mono />
          <SecondaryButton className="mt-4 w-full" onClick={() => refresh().catch((err) => setError(err instanceof Error ? err.message : "Could not refresh payment."))} type="button">Refresh Status</SecondaryButton>
        </Panel>
      ) : null}
      <Panel>
        <h2 className="mb-4 text-lg font-semibold">Recent Deposits</h2>
        {deposits.length === 0 ? <EmptyState title="No deposits yet." /> : deposits.slice(0, 8).map((item) => (
          <div key={item.id} className="mb-2 rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-3 shadow-[0_0_18px_rgba(56,189,248,0.08)]">
            <div className="flex justify-between gap-3"><span className="font-semibold">${Number(item.usd_amount).toFixed(2)}</span><span className="capitalize text-accent">{item.payment_status || item.status}</span></div>
            <div className="mt-1 truncate text-xs text-slate-400">{item.payment_id || item.tx_hash || item.provider || "manual"}</div>
          </div>
        ))}
      </Panel>
    </div>
  );
}

function WithdrawalView() {
  const [balance, setBalance] = useState("0");
  const [withdrawals, setWithdrawals] = useState<HbWithdrawal[]>([]);
  const [settings, setSettings] = useState({ withdrawalMinUsd: HB_WITHDRAWAL_MIN_USD, withdrawalFeePercent: 10, withdrawalDailyLimitUsd: 500, withdrawalCooldownMinutes: 10 });
  const [amountUsd, setAmountUsd] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [boundAddress, setBoundAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const token = getHbToken();

  async function refresh() {
    if (!token) return;
    const wallet = await fetchHbWallet(token);
    const address = await fetchHbWalletAddress(token).catch(() => null);
    setBalance(wallet.availableBalance);
    setWithdrawals(wallet.withdrawals);
    if (wallet.withdrawalSettings) setSettings({ ...wallet.withdrawalSettings, withdrawalMinUsd: HB_WITHDRAWAL_MIN_USD });
    const nextBoundAddress = address?.usdt_bep20_address || window.localStorage.getItem(DEV_BOUND_WALLET_KEY) || "";
    setBoundAddress(nextBoundAddress);
    setWalletAddress((current) => current || nextBoundAddress);
  }

  useEffect(() => {
    if (!token) {
      const devAddress = window.localStorage.getItem(DEV_BOUND_WALLET_KEY) || "";
      setBoundAddress(devAddress);
      setWalletAddress(devAddress);
      return;
    }
    refresh().catch(() => undefined);
  }, []);

  async function submit() {
    if (!token) {
      setError("Log in to HB9 before requesting a withdrawal.");
      return;
    }
    if (Number(amountUsd) + Number.EPSILON < HB_WITHDRAWAL_MIN_USD) {
      setError(HB_WITHDRAWAL_MIN_ERROR);
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await createHbWithdrawal(token, { amountUsd: Number(amountUsd), walletAddress, currency: "USDT", network: "bsc", chainId: 56, idempotencyKey: `hb-withdrawal-ui-${Date.now()}-${crypto.randomUUID()}` });
      setAmountUsd("");
      setWalletAddress("");
      setNotice("Withdrawal request submitted. Balance is reserved until admin review.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdrawal request failed.");
    } finally {
      setBusy(false);
    }
  }

  const feeUsd = Number(amountUsd || 0) * settings.withdrawalFeePercent / 100;
  const payoutUsd = Math.max(0, Number(amountUsd || 0) - feeUsd);
  const walletValid = /^0x[a-fA-F0-9]{40}$/.test(walletAddress.trim());

  return (
    <div className="space-y-4" data-testid="withdrawal-screen">
      <Panel>
        <Title title="Withdraw USDT BEP20" subtitle="Minimum withdrawal $9. 10% withdrawal charge. BNB is used only by the network for gas." />
        {!boundAddress ? <div className="mb-4 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-3 text-sm text-yellow-100">Please bind your USDT BEP20 wallet address before withdrawal.</div> : null}
        <div className="mb-4 rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4 shadow-[0_0_18px_rgba(56,189,248,0.08)] backdrop-blur-xl">
          <div className="text-xs text-slate-400">Available Internal Balance</div>
          <div className="mt-1 text-2xl font-semibold">${Number(balance || 0).toFixed(2)}</div>
        </div>
        <div className="mb-4 grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-3"><div className="text-slate-400">Minimum</div><div className="font-semibold">${HB_WITHDRAWAL_MIN_USD.toFixed(2)}</div></div>
          <div className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-3"><div className="text-slate-400">Fee</div><div className="font-semibold">{settings.withdrawalFeePercent}%</div></div>
          <div className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-3"><div className="text-slate-400">Daily Limit</div><div className="font-semibold">${settings.withdrawalDailyLimitUsd.toFixed(2)}</div></div>
        </div>
        <Field inputMode="decimal" value={amountUsd} onChange={(event) => setAmountUsd(event.target.value)} placeholder="Amount in USD" />
        <Field className="mt-3" value={walletAddress} onChange={(event) => setWalletAddress(event.target.value)} placeholder="USDT BEP20 withdrawal address" />
        {walletAddress && !walletValid ? <div className="mt-2 text-sm font-semibold text-red-200">Enter a valid BSC wallet address.</div> : null}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Select value="USDT" disabled><option value="USDT">USDT</option></Select>
          <Select value="bsc" disabled><option value="bsc">BEP20</option></Select>
        </div>
        {notice ? <div className="mt-3 rounded-2xl border border-mint/30 bg-mint/10 p-3 text-sm text-mint">{notice}</div> : null}
        {Number(amountUsd) > 0 ? (
          <div className="mt-3 rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-3 text-sm text-slate-200">
            Fee: ${feeUsd.toFixed(2)} · Receivable: ${payoutUsd.toFixed(2)}
          </div>
        ) : null}
        {Number(amountUsd) > 0 && Number(amountUsd) < HB_WITHDRAWAL_MIN_USD ? <div className="mt-2 text-sm font-semibold text-red-200">{HB_WITHDRAWAL_MIN_ERROR}</div> : null}
        <ErrorText error={error} />
        <PrimaryButton className="mt-4 w-full" onClick={submit} disabled={busy || Number(amountUsd) < HB_WITHDRAWAL_MIN_USD || !walletValid || !boundAddress} type="button">
          {busy ? "Submitting" : "Submit Withdrawal"}
        </PrimaryButton>
      </Panel>
      <Panel>
        <h2 className="mb-4 text-lg font-semibold">Withdrawal History</h2>
        {withdrawals.length === 0 ? <EmptyState title="No withdrawals yet." /> : withdrawals.map((item) => (
          <div key={item.id} className="mb-2 rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-3 shadow-[0_0_18px_rgba(56,189,248,0.08)]">
            <div className="flex justify-between gap-3"><span className="font-semibold">${Number(item.amount_usd).toFixed(2)} {item.currency}</span><span className="capitalize text-accent">{item.status}</span></div>
            <div className="mt-1 text-xs text-slate-400">Fee ${Number(item.fee_usd || 0).toFixed(2)} · Receivable ${Number(item.payout_amount_usd || item.amount_usd).toFixed(2)}</div>
            <div className="mt-1 break-all text-xs text-slate-400">{item.tx_hash || item.wallet_address}</div>
          </div>
        ))}
      </Panel>
    </div>
  );
}

function Title({ title, subtitle }: { title: string; subtitle: string }) {
  return <div className="mb-5"><BrandLogo size="sm" className="mb-3" /><h2 className="text-2xl font-semibold text-white">{title}</h2><p className="mt-2 text-sm leading-6 text-sky-100/75">{subtitle}</p></div>;
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="flex items-center justify-between gap-4 border-b border-white/10 py-2 text-sm last:border-b-0"><span className="shrink-0 text-slate-400">{label}</span><span className={`min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-right text-slate-100 ${mono ? "font-mono text-xs" : ""}`}>{value}</span></div>;
}
