"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Banknote,
  ClipboardList,
  CreditCard,
  FileSearch,
  Gauge,
  Image as ImageIcon,
  LogOut,
  RefreshCcw,
  Settings,
  Shield,
  Siren,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  TreePine,
  Upload,
  Users,
  WalletCards
} from "lucide-react";
import { HalalBusinessLogo } from "@/components/brand/HalalBusinessLogo";
import { ExplorerButton } from "@/components/ExplorerButton";
import { CoinLogo } from "@/components/crypto/CoinLogo";

type AdminPage = "dashboard" | "recharge" | "payments" | "users" | "providers" | "fees" | "audit" | "settings" | "hb-dashboard" | "hb-production" | "hb-funds" | "hb-users" | "hb-deposits" | "hb-withdrawals" | "hb-purchases" | "hb-income" | "hb-referrals" | "hb-packages" | "hb-products" | "hb-product" | "hb-coins" | "hb-single-leg" | "hb-followers" | "hb-custom-software" | "hb-reports" | "hb-transparency" | "hb-treasury" | "hb-governance" | "hb-risk" | "hb-onchain" | "hb-contracts";

type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  message: string;
  error: string | null;
};

type AdminSummary = {
  totalRechargeOrders: number;
  successfulRechargeOrders: number;
  failedRechargeOrders: number;
  refundPending: number;
  totalPaymentOrders: number;
  totalVolume: number;
  providerStatus: string;
  recentAuditLogs: AuditLogRow[];
};

type RechargeOrderRow = Record<string, unknown> & {
  id?: string;
  user_wallet_address?: string;
  country_code?: string;
  operator_name?: string;
  phone_number?: string;
  local_currency?: string;
  local_amount?: string | number;
  crypto_symbol?: string;
  crypto_amount?: string | number;
  network?: string;
  tx_hash?: string;
  provider?: string;
  status?: string;
  refund_status?: string;
  created_at?: string;
};

type PaymentOrderRow = Record<string, unknown> & {
  id?: string;
  wallet_address?: string;
  merchant_name?: string;
  category?: string;
  amount?: string | number;
  asset?: string;
  tx_hash?: string;
  status?: string;
  created_at?: string;
};

type UserRow = Record<string, unknown> & {
  wallet_address?: string;
  first_seen?: string;
  last_activity?: string;
  recharge_count?: number;
  payment_count?: number;
  total_volume?: string | number;
  local_wallet_only?: boolean;
};

type AuditLogRow = Record<string, unknown> & {
  action?: string;
  actor_wallet_address?: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: unknown;
  created_at?: string;
};

type ProviderSettingsData = {
  activeProvider: string;
  webhookUrl: string;
  providers: Array<{ provider: string; status: string; maskedApiKey: string; configured: boolean }>;
};

type FeesData = {
  recharge_platform_fee_percent?: string | number;
  rechargePlatformFeePercent?: string | number;
  fixed_fee?: string | number;
  fixedFee?: string | number;
  minimum_fee?: string | number;
  minimumFee?: string | number;
  qr_pay_fee_percent?: string | number;
  qrPayFeePercent?: string | number;
  refund_fee?: string | number;
  refundFee?: string | number;
  supported_crypto_symbols?: string[];
  supportedCryptoSymbols?: string[];
};

const ADMIN_TOKEN_KEY = "hb9.admin.token";

const nav = [
  { href: "/admin", label: "Overview", page: "dashboard", icon: Gauge },
  { href: "/admin/hb", label: "HB9 Dashboard", page: "hb-dashboard", icon: ShoppingBag },
  { href: "/admin/hb/production", label: "HB9 Production", page: "hb-production", icon: Siren },
  { href: "/admin/hb/funds", label: "HB9 Funds", page: "hb-funds", icon: WalletCards },
  { href: "/admin/hb/users", label: "HB9 Users", page: "hb-users", icon: Users },
  { href: "/admin/hb/deposits", label: "HB9 Deposits", page: "hb-deposits", icon: WalletCards },
  { href: "/admin/hb/withdrawals", label: "HB9 Withdrawals", page: "hb-withdrawals", icon: Banknote },
  { href: "/admin/hb/purchases", label: "HB9 Purchases", page: "hb-purchases", icon: ClipboardList },
  { href: "/admin/hb/income-ledger", label: "HB9 Income", page: "hb-income", icon: Banknote },
  { href: "/admin/hb/referral-tree", label: "HB9 Tree", page: "hb-referrals", icon: TreePine },
  { href: "/admin/hb/packages", label: "HB9 Packages", page: "hb-packages", icon: ShoppingBag },
  { href: "/admin/hb/products", label: "HB9 Products", page: "hb-products", icon: ShoppingBag },
  { href: "/admin/hb/product-allocations", label: "HB9 Product", page: "hb-product", icon: ClipboardList },
  { href: "/admin/hb/coins", label: "HB9 Coins", page: "hb-coins", icon: WalletCards },
  { href: "/admin/hb/single-leg-reserve", label: "HB9 Single Leg", page: "hb-single-leg", icon: Activity },
  { href: "/admin/hb/followers-requests", label: "Followers Requests", page: "hb-followers", icon: ClipboardList },
  { href: "/admin/hb/custom-software-requests", label: "Custom Software", page: "hb-custom-software", icon: SlidersHorizontal },
  { href: "/admin/hb/reports", label: "HB9 Reports", page: "hb-reports", icon: FileSearch },
  { href: "/admin/hb/transparency", label: "HB9 Proofs", page: "hb-transparency", icon: FileSearch },
  { href: "/admin/hb/treasury", label: "HB9 Treasury", page: "hb-treasury", icon: Shield },
  { href: "/admin/hb/governance", label: "HB9 Governance", page: "hb-governance", icon: Shield },
  { href: "/admin/hb/risk", label: "HB9 Risk", page: "hb-risk", icon: Activity },
  { href: "/admin/hb/onchain-purchases", label: "HB9 On-chain", page: "hb-onchain", icon: Activity },
  { href: "/admin/hb/contracts", label: "HB9 Contracts", page: "hb-contracts", icon: Settings },
  { href: "/admin/recharge-orders", label: "Recharge", page: "recharge", icon: ClipboardList },
  { href: "/admin/payment-orders", label: "Payments", page: "payments", icon: CreditCard },
  { href: "/admin/users", label: "Users", page: "users", icon: Users },
  { href: "/admin/provider-settings", label: "Providers", page: "providers", icon: SlidersHorizontal },
  { href: "/admin/fees", label: "Fees", page: "fees", icon: Banknote },
  { href: "/admin/audit-logs", label: "Audit", page: "audit", icon: FileSearch },
  { href: "/admin/settings", label: "Settings", page: "settings", icon: Settings }
] as const;

function apiUrl(path: string) {
  const configured = (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
  const localDefault = process.env.NODE_ENV === "development" ? "http://localhost:4000" : "";
  return `${configured || localDefault}/api${path}`;
}

async function adminRequest<T>(path: string, token?: string, init: RequestInit = {}) {
  const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers
    }
  });
  const envelope = await response.json().catch(() => null) as ApiEnvelope<T> | null;
  if (!response.ok || !envelope?.success) {
    throw new Error(envelope?.error || envelope?.message || "Admin API request failed.");
  }
  return envelope.data as T;
}

function formatDate(value: unknown) {
  if (!value) return "-";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function compact(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function money(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? `$${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "$0";
}

export function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!email || password.length < 8) {
      setError("Enter admin email and password.");
      return;
    }
    setLoading(true);
    try {
      const data = await adminRequest<{ token: string }>("/admin/login", undefined, {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
      router.push("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8">
      <form onSubmit={login} className="w-full max-w-sm rounded-[1.6rem] border border-sky-200/15 bg-[#0b1728]/75 p-5 shadow-wallet backdrop-blur-2xl">
        <div className="mb-5 flex items-center gap-3">
          <div>
            <HalalBusinessLogo size="md" showText />
            <p className="text-sm text-slate-400">Secure operations dashboard</p>
          </div>
        </div>
        <input className="field mb-3" type="email" placeholder="Admin email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <input className="field mb-3" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
        {error ? <p className="mb-3 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-red-100">{error}</p> : null}
        <button className="w-full rounded-2xl bg-accent px-4 py-3 font-semibold text-black disabled:opacity-60" type="submit" disabled={loading}>{loading ? "Logging in" : "Login"}</button>
      </form>
    </main>
  );
}

export function AdminApp({ page }: { page: AdminPage }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [token, setToken] = useState("");
  const [adminRole, setAdminRole] = useState("admin");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [rechargeRows, setRechargeRows] = useState<RechargeOrderRow[]>([]);
  const [paymentRows, setPaymentRows] = useState<PaymentOrderRow[]>([]);
  const [userRows, setUserRows] = useState<UserRow[]>([]);
  const [auditRows, setAuditRows] = useState<AuditLogRow[]>([]);
  const [providerSettings, setProviderSettings] = useState<ProviderSettingsData | null>(null);
  const [fees, setFees] = useState<FeesData | null>(null);
  const [hbData, setHbData] = useState<Record<string, unknown>>({});
  const title = nav.find((item) => item.page === page)?.label || "Admin";

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!stored) {
      router.replace("/admin/login");
      return;
    }
    setToken(stored);
    adminRequest<{ admin: { role?: string } }>("/admin/me", stored)
      .then((data) => setAdminRole(data.admin.role || "admin"))
      .catch(() => {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        router.replace("/admin/login");
      });
  }, [router]);

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    setError("");

    async function load() {
      if (page === "dashboard") {
        const data = await adminRequest<AdminSummary>("/admin/summary", token);
        if (!active) return;
        setSummary(data);
        setAuditRows(data.recentAuditLogs || []);
        return;
      }
      if (page === "recharge") {
        const suffix = query.trim() ? `?search=${encodeURIComponent(query.trim())}` : "";
        const data = await adminRequest<{ items: RechargeOrderRow[] }>(`/admin/recharge-orders${suffix}`, token);
        if (active) setRechargeRows(data.items || []);
        return;
      }
      if (page === "payments") {
        const suffix = query.trim() ? `?search=${encodeURIComponent(query.trim())}` : "";
        const data = await adminRequest<{ items: PaymentOrderRow[] }>(`/admin/payment-orders${suffix}`, token);
        if (active) setPaymentRows(data.items || []);
        return;
      }
      if (page === "users") {
        const data = await adminRequest<{ items: UserRow[] }>("/admin/users", token);
        if (active) setUserRows(data.items || []);
        return;
      }
      if (page === "providers") {
        const data = await adminRequest<ProviderSettingsData>("/admin/provider-settings", token);
        if (active) setProviderSettings(data);
        return;
      }
      if (page === "fees") {
        const data = await adminRequest<FeesData>("/admin/fees", token);
        if (active) setFees(data);
        return;
      }
      if (page === "audit") {
        const data = await adminRequest<{ items: AuditLogRow[] }>("/admin/audit-logs", token);
        if (active) setAuditRows(data.items || []);
        return;
      }
      if (page.startsWith("hb-")) {
        const pathByPage: Record<string, string> = {
          "hb-dashboard": "/admin/hb/summary",
          "hb-production": "/admin/hb/production-health",
          "hb-funds": "/admin/hb/funds/history",
          "hb-users": "/admin/hb/users",
          "hb-deposits": "/admin/hb/deposits",
          "hb-withdrawals": `/admin/hb/withdrawals${searchParams.get("status") ? `?status=${encodeURIComponent(searchParams.get("status") || "")}` : ""}`,
          "hb-purchases": "/admin/hb/purchases",
          "hb-income": "/admin/hb/income-ledger",
          "hb-referrals": "/admin/hb/users",
          "hb-packages": "/admin/hb/packages",
          "hb-products": "/admin/hb/products",
          "hb-product": "/admin/hb/product-allocations",
          "hb-coins": `/admin/hb/coins/users${searchParams.get("q") || query ? `?search=${encodeURIComponent(searchParams.get("q") || query)}` : ""}`,
          "hb-single-leg": "/admin/hb/single-leg-reserve",
          "hb-followers": "/admin/hb/followers-requests",
          "hb-custom-software": "/admin/hb/custom-software-requests",
          "hb-reports": "/admin/hb/reports",
          "hb-transparency": "/admin/hb/transparency",
          "hb-treasury": "/admin/hb/treasury-settings",
          "hb-governance": "/admin/hb/governance",
          "hb-risk": "/admin/hb/risk",
          "hb-onchain": "/admin/hb/onchain-purchases",
          "hb-contracts": "/admin/hb/onchain-contracts"
        };
        const data = await adminRequest<Record<string, unknown>>(pathByPage[page], token);
        if (active) setHbData(data || {});
      }
    }

    load()
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load admin data.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [page, query, searchParams, token]);

  async function logout() {
    try {
      if (token) await adminRequest("/admin/logout", token, { method: "POST" });
    } catch {
      // Local logout still clears a stale token if the API session is already invalid.
    }
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    router.push("/admin/login");
  }

  const content = useMemo(() => {
    if (loading) return <AdminLoadingState />;
    if (error) return <Panel title="Error"><p className="text-sm text-red-100">{error}</p></Panel>;
    if (page === "recharge") return <RechargeOrders rows={rechargeRows} />;
    if (page === "payments") return <PaymentOrders rows={paymentRows} />;
    if (page === "users") return <UsersPage rows={userRows} />;
    if (page === "providers") return <ProviderSettings data={providerSettings} token={token} />;
    if (page === "fees") return <FeesPage data={fees} token={token} />;
    if (page === "audit") return <AuditLogs rows={auditRows} query={query} />;
    if (page === "settings") return <SettingsPage />;
    if (page.startsWith("hb-")) return <HbAdminPage page={page} data={hbData} token={token} query={query} />;
    return <Overview summary={summary} auditRows={auditRows} />;
  }, [auditRows, error, fees, hbData, loading, page, paymentRows, providerSettings, query, rechargeRows, summary, token, userRows]);

  return (
    <main className="min-h-dvh text-slate-50">
      <div className="mx-auto grid min-h-dvh max-w-7xl grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="sticky top-0 z-30 border-b border-sky-200/10 bg-[#0b1728]/82 p-3 shadow-[0_0_28px_rgba(56,189,248,0.08)] backdrop-blur-2xl md:h-dvh md:overflow-y-auto md:border-b-0 md:border-r md:p-4">
          <div className="mb-6 flex items-center gap-3">
            <div>
              <HalalBusinessLogo size="sm" showText />
              <div className="text-xs text-slate-500">{adminRole} ready</div>
            </div>
          </div>
          <nav className="grid max-h-[44dvh] grid-cols-2 gap-2 overflow-y-auto pr-1 md:max-h-none md:grid-cols-1 md:overflow-visible md:pr-0">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className={`tap-feedback flex min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-sm ${active ? "bg-accent text-black" : "text-slate-300 hover:bg-[#0b1728]/75 hover:text-white"}`}>
                  <Icon className="shrink-0" size={16} /> <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
        <section className="min-w-0 p-3 sm:p-4 md:p-6">
          <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{title}</h1>
              <p className="text-sm text-slate-400">No wallet secrets or private keys are available here.</p>
            </div>
            <div className="flex min-w-0 gap-2">
              <input className="field h-11 md:w-72" placeholder="Search or filter" value={query} onChange={(event) => setQuery(event.target.value)} />
              <button className="tap-feedback rounded-xl border border-white/10 bg-[#0b1728]/70 px-3" onClick={logout} type="button" aria-label="Logout"><LogOut size={18} /></button>
            </div>
          </header>
          {content}
        </section>
      </div>
    </main>
  );
}

function Overview({ summary, auditRows }: { summary: AdminSummary | null; auditRows: AuditLogRow[] }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Total recharge orders" value={compact(summary?.totalRechargeOrders || 0)} />
        <Metric title="Successful recharge orders" value={compact(summary?.successfulRechargeOrders || 0)} tone="mint" />
        <Metric title="Failed recharge orders" value={compact(summary?.failedRechargeOrders || 0)} tone="danger" />
        <Metric title="Refund pending" value={compact(summary?.refundPending || 0)} tone="accent" />
        <Metric title="Total payment orders" value={compact(summary?.totalPaymentOrders || 0)} />
        <Metric title="Total volume" value={money(summary?.totalVolume)} />
        <Metric title="Provider status" value={compact(summary?.providerStatus || "unknown")} tone="mint" />
      </div>
      <Panel title="Recent audit logs"><AuditLogs rows={auditRows} query="" compact /></Panel>
    </div>
  );
}

function HbAdminPage({ page, data, token, query }: { page: AdminPage; data: Record<string, unknown>; token: string; query: string }) {
  const items = Array.isArray(data.items) ? data.items as Array<Record<string, unknown>> : [];
  const filtered = items.filter((row) => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));

  async function patch(path: string, body: Record<string, unknown>) {
    const dangerous = path.includes("/mark-paid") || path.includes("/treasury-settings") || path.includes("/onchain-contracts") || path.includes("/batch");
    const confirmedBody = dangerous
      ? window.confirm("Mainnet safe mode requires explicit confirmation for this operation.")
        ? { ...body, safetyConfirmation: "CONFIRM_MAINNET_SAFE_ACTION" }
        : null
      : body;
    if (!confirmedBody) return;
    await adminRequest(path, token, { method: "PATCH", body: JSON.stringify(confirmedBody) });
    window.location.reload();
  }

  if (page === "hb-dashboard") {
    return (
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Total HB9 users" value={compact(data.total_users || 0)} />
          <Metric title="Active users" value={compact(data.active_users || 0)} tone="mint" />
          <Metric title="Inactive users" value={compact(data.inactive_users || 0)} tone="accent" />
          <Metric title="Total deposits" value={money(data.total_deposits)} />
          <Metric title="Verified deposits" value={compact(data.verified_deposits || 0)} tone="mint" />
          <Metric title="Pending deposits" value={compact(data.pending_deposits || 0)} tone="accent" />
          <Metric title="Pending withdrawals" value={compact(data.pending_withdrawals || 0)} tone="accent" />
          <Metric title="Paid withdrawals" value={compact(data.paid_withdrawals || 0)} tone="mint" />
          <Metric title="Withdrawal volume" value={money(data.total_withdrawal_volume)} />
          <Metric title="Withdrawal fees" value={money(data.withdrawal_fee_earnings)} tone="mint" />
          <Metric title="Package sales" value={money(data.total_package_sales)} />
          <Metric title="Direct income" value={money(data.total_direct_income)} />
          <Metric title="Level income" value={money(data.total_level_income)} />
          <Metric title="Treasury hold" value={money(data.total_treasury_hold)} />
        </div>
        <TreasuryHealthPanel health={(data.treasuryHealth && typeof data.treasuryHealth === "object" ? data.treasuryHealth : {}) as Record<string, unknown>} />
        <RiskPanel data={{ highRiskAccounts: data.highRiskAccounts }} />
      </div>
    );
  }

  if (page === "hb-production") {
    return <HbProductionDashboard data={data} token={token} />;
  }

  if (page === "hb-funds") {
    return <HbFundsManagement data={data} token={token} query={query} />;
  }

  if (page === "hb-users") {
    return (
      <Panel title="HB9 users">
        <AdminTable headers={["User ID", "Name", "Email", "Wallet", "Sponsor", "Status", "Current package", "Deposits", "Purchases", "Income", "Joined", "Actions"]}>
          {filtered.map((row) => (
            <tr key={compact(row.id)}>
              <Td>{compact(row.id)}</Td><Td>{compact(row.display_name)}</Td><Td>{compact(row.email)}</Td><Td>{compact(row.wallet_address)}</Td><Td>{compact(row.sponsor_name || row.sponsor_email)}</Td><Td><Badge value={compact(row.status)} /></Td><Td>{compact(row.current_package)}</Td><Td>{money(row.total_deposits)}</Td><Td>{money(row.total_purchases)}</Td><Td>{money(row.total_income)}</Td><Td>{formatDate(row.created_at)}</Td>
              <Td><ActionButtons actions={["View"]} /><button className="mt-1 rounded-lg bg-[#0b1728]/75 px-2 py-1 text-xs" onClick={() => patch(`/admin/hb/users/${row.id}/status`, { status: row.status === "suspended" ? "active" : "suspended", adminRemark: "Status changed from admin panel" })} type="button">{row.status === "suspended" ? "Unsuspend" : "Suspend"}</button></Td>
            </tr>
          ))}
        </AdminTable>
      </Panel>
    );
  }

  if (page === "hb-deposits") {
    return (
      <Panel title="HB9 deposits">
        <AdminTable headers={["Deposit", "User", "Wallet", "Tx hash", "Amount", "Network", "Status", "Created", "Actions"]}>
          {filtered.map((row) => (
            <tr key={compact(row.id)}>
              <Td>{compact(row.id)}</Td><Td>{compact(row.email || row.display_name)}</Td><Td>{compact(row.wallet_address)}</Td><Td>{compact(row.tx_hash)}</Td><Td>{money(row.usd_amount)} {compact(row.asset)}</Td><Td>{compact(row.network)}</Td><Td><Badge value={compact(row.status)} /></Td><Td>{formatDate(row.created_at)}</Td>
              <Td>
                <ExplorerButton type="tx" value={String(row.tx_hash || "")} compact />
                {row.status !== "verified" ? <button className="rounded-lg bg-danger/20 px-2 py-1 text-xs text-red-100" onClick={() => patch(`/admin/hb/deposits/${row.id}`, { status: "rejected", failureReason: "Rejected by admin review", adminRemark: "Rejected from admin panel" })} type="button">Reject</button> : null}
              </Td>
            </tr>
          ))}
        </AdminTable>
      </Panel>
    );
  }

  if (page === "hb-withdrawals") {
    const queue = (data.queue && typeof data.queue === "object" ? data.queue : {}) as Record<string, unknown>;
    return (
      <div className="grid gap-4">
      <Panel title="Withdrawal queue protection">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric title="Pending queue" value={compact(queue.pending_count || 0)} tone="accent" />
          <Metric title="Approved queue" value={compact(queue.approved_count || 0)} />
          <Metric title="Processing queue" value={compact(queue.processing_count || 0)} />
          <Metric title="Oldest pending" value={`${Number(queue.oldest_pending_minutes || 0).toFixed(0)}m`} />
          <Metric title="Stuck payouts" value={compact(queue.stuck_payout_count || 0)} tone={Number(queue.stuck_payout_count || 0) > 0 ? "danger" : "mint"} />
        </div>
      </Panel>
      <Panel title="HB9 withdrawals">
        <div className="mb-4 grid gap-2 text-xs sm:grid-cols-5">
          {["pending", "under_review", "approved", "processing", "paid"].map((status) => (
            <Link key={status} className="rounded-xl border border-sky-200/10 bg-[#0b1728]/70 px-3 py-2 text-center capitalize text-slate-200" href={`/admin/hb/withdrawals?status=${status}`}>{status.replace("_", " ")}</Link>
          ))}
        </div>
        <AdminTable headers={["ID", "User", "Status", "Risk", "Package", "Amount", "Fee", "Payout", "Address", "Tx", "Approval aging", "Payout aging", "Created", "Actions"]}>
          {filtered.map((row) => (
            <tr key={compact(row.id)}>
              <Td>{compact(row.id)}</Td>
              <Td>{compact(row.email || row.mobile_number || row.display_name)}</Td>
              <Td><Badge value={compact(row.status)} /></Td>
              <Td><Badge value={compact(row.risk_flag || "normal")} /></Td>
              <Td>{compact(row.current_package)}</Td>
              <Td>{money(row.amount_usd)}</Td>
              <Td>{money(row.fee_usd)}</Td>
              <Td>{money(row.payout_amount_usd)}</Td>
              <Td>{compact(row.wallet_address)}</Td>
              <Td>{compact(row.tx_hash)}</Td>
              <Td>{row.approved_at ? `${Math.max(0, Math.round((Date.now() - new Date(String(row.approved_at)).getTime()) / 60000))}m` : "-"}</Td>
              <Td>{row.processing_at ? `${Math.max(0, Math.round((Date.now() - new Date(String(row.processing_at)).getTime()) / 60000))}m` : "-"}</Td>
              <Td>{formatDate(row.requested_at)}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {row.status === "pending" ? <button className="rounded-lg bg-[#0b1728]/75 px-2 py-1 text-xs" onClick={() => patch(`/admin/hb/withdrawals/${row.id}/under-review`, { adminNote: "Moved under review" })} type="button">Review</button> : null}
                  {row.status === "pending" || row.status === "under_review" ? <button className="rounded-lg bg-mint/20 px-2 py-1 text-xs text-mint" onClick={() => patch(`/admin/hb/withdrawals/${row.id}/approve`, { adminNote: "Approved from admin panel" })} type="button">Approve</button> : null}
                  {row.status === "approved" ? <button className="rounded-lg bg-accent/20 px-2 py-1 text-xs text-accent" onClick={() => patch(`/admin/hb/withdrawals/${row.id}/processing`, { adminNote: "Processing payout" })} type="button">Processing</button> : null}
                  {row.status === "approved" || row.status === "processing" ? <button className="rounded-lg bg-mint/20 px-2 py-1 text-xs text-mint" onClick={() => {
                    const txHash = window.prompt("Enter payout tx hash");
                    if (txHash) patch(`/admin/hb/withdrawals/${row.id}/mark-paid`, { txHash, adminNote: "Marked paid from admin panel" });
                  }} type="button">Paid</button> : null}
                  {["pending", "under_review", "approved", "processing"].includes(String(row.status)) ? <button className="rounded-lg bg-danger/20 px-2 py-1 text-xs text-red-100" onClick={() => {
                    const reason = window.prompt("Reject reason") || "Rejected by admin review";
                    patch(`/admin/hb/withdrawals/${row.id}/reject`, { reason, adminNote: "Rejected from admin panel" });
                  }} type="button">Reject</button> : null}
                </div>
              </Td>
            </tr>
          ))}
        </AdminTable>
      </Panel>
      </div>
    );
  }

  if (page === "hb-purchases") {
    return <HbTable title="HB9 purchases" rows={filtered} headers={["Purchase", "Buyer", "Package", "Amount", "Purchase status", "Activation", "Distribution", "Created"]} fields={["id", "email", "package_name", "amount_usd", "status", "activation_status", "distribution_status", "created_at"]} moneyFields={["amount_usd"]} dateFields={["created_at"]} />;
  }

  if (page === "hb-income") {
    const salaryRows = Array.isArray(data.salaryIncome) ? data.salaryIncome as Array<Record<string, unknown>> : [];
    const capRows = Array.isArray(data.incomeCaps) ? data.incomeCaps as Array<Record<string, unknown>> : [];
    async function recalculateSalary(userId: unknown) {
      await adminRequest(`/admin/hb/salary-income/${userId}/recalculate`, token, { method: "POST", body: JSON.stringify({}) });
      window.location.reload();
    }
    return (
      <div className="grid gap-4">
        <Panel title="HB9 salary income">
          <AdminTable headers={["User", "Status", "Salary", "Self $100", "Direct $100", "Team $100", "Unlocked", "Paid", "Proof", "Actions"]}>
            {salaryRows.map((row) => (
              <tr key={compact(row.user_id)}>
                <Td>{compact(row.email || row.display_name || row.user_id)}</Td>
                <Td><Badge value={compact(row.status)} /></Td>
                <Td>{money(row.salary_amount)}</Td>
                <Td>{row.self_package_ok ? "completed" : "pending"}</Td>
                <Td>{compact(row.direct_100_count)} / 5</Td>
                <Td>{compact(row.team_100_count)} / 5</Td>
                <Td>{formatDate(row.unlocked_at)}</Td>
                <Td>{formatDate(row.paid_at)}</Td>
                <Td>{compact(row.proof_reference)}</Td>
                <Td><button className="rounded-lg bg-[#0b1728]/75 px-2 py-1 text-xs" onClick={() => recalculateSalary(row.user_id)} type="button">Recalculate</button></Td>
              </tr>
            ))}
          </AdminTable>
        </Panel>
        <Panel title="Daily income caps">
          <AdminTable headers={["User", "Date", "Package", "Daily cap", "Credited", "Capped", "Updated"]}>
            {capRows.map((row) => (
              <tr key={`${compact(row.user_id)}-${compact(row.cap_date)}`}>
                <Td>{compact(row.email || row.display_name || row.user_id)}</Td>
                <Td>{compact(row.cap_date)}</Td>
                <Td>{money(row.package_amount)}</Td>
                <Td>{money(row.daily_cap_amount)}</Td>
                <Td>{money(row.credited_amount)}</Td>
                <Td>{money(row.capped_amount)}</Td>
                <Td>{formatDate(row.updated_at)}</Td>
              </tr>
            ))}
          </AdminTable>
        </Panel>
        <HbTable title="HB9 income ledger" rows={filtered} headers={["Buyer", "Receiver", "Type", "Amount", "Credited", "Capped", "Cap status", "Status", "Level", "Created"]} fields={["buyer_email", "earner_email", "income_type", "amount_usd", "credited_amount", "capped_amount", "cap_status", "status", "level_depth", "created_at"]} moneyFields={["amount_usd", "credited_amount", "capped_amount"]} dateFields={["created_at"]} />
      </div>
    );
  }

  if (page === "hb-referrals") {
    return (
      <Panel title="HB9 referral tree">
        <p className="mb-4 text-sm text-slate-400">Search a user above, then open their tree from API route <span className="font-mono text-slate-200">/api/admin/hb/referral-tree/:userId</span>.</p>
        <AdminTable headers={["User", "Email", "Code", "Status", "Sponsor", "Joined"]}>
          {filtered.map((row) => <tr key={compact(row.id)}><Td>{compact(row.display_name)}</Td><Td>{compact(row.email)}</Td><Td>{compact(row.referral_code)}</Td><Td><Badge value={compact(row.status)} /></Td><Td>{compact(row.sponsor_name || row.sponsor_email)}</Td><Td>{formatDate(row.created_at)}</Td></tr>)}
        </AdminTable>
      </Panel>
    );
  }

  if (page === "hb-packages") {
    return (
      <Panel title="HB9 packages">
        <AdminTable headers={["Package", "Amount", "Description", "Image", "Status", "Updated", "Actions"]}>
          {filtered.map((row) => (
            <tr key={compact(row.id)}>
              <Td>{compact(row.name)}</Td><Td>{money(row.amount_usd)}</Td><Td>{compact(row.description)}</Td><Td>{compact(row.image_url)}</Td><Td><Badge value={compact(row.status)} /></Td><Td>{formatDate(row.updated_at)}</Td>
              <Td><button className="rounded-lg bg-[#0b1728]/75 px-2 py-1 text-xs" onClick={() => patch(`/admin/hb/packages/${row.id}`, { status: row.status === "available" ? "disabled" : "available", adminRemark: "Package status changed from admin panel" })} type="button">{row.status === "available" ? "Disable" : "Enable"}</button></Td>
            </tr>
          ))}
        </AdminTable>
      </Panel>
    );
  }

  if (page === "hb-products") {
    return <HbProductsAdmin rows={filtered} token={token} onToggleActive={(row) => patch(`/admin/hb/products/${row.id}`, { active: !row.active })} />;
  }

  if (page === "hb-product") {
    return <HbTable title="HB9 product allocations" rows={filtered} headers={["ID", "User", "Package", "Amount", "Status", "Created"]} fields={["id", "email", "package_name", "amount_usd", "status", "created_at"]} moneyFields={["amount_usd"]} dateFields={["created_at"]} />;
  }

  if (page === "hb-coins") {
    return <HbCoins data={data} token={token} query={query} />;
  }

  if (page === "hb-single-leg") {
    const positions = Array.isArray(data.positions) ? data.positions as Array<Record<string, unknown>> : [];
    const rewards = Array.isArray(data.rewards) ? data.rewards as Array<Record<string, unknown>> : [];
    async function recalculate(userId?: unknown) {
      await adminRequest("/admin/hb/single-leg/recalculate", token, { method: "POST", body: JSON.stringify(userId ? { userId } : {}) });
      window.location.reload();
    }
    return (
      <div className="grid gap-4">
        <Panel title="Global single-leg positions">
          <div className="mb-4 flex justify-end">
            <button className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-black" onClick={() => recalculate()} type="button">Recalculate all</button>
          </div>
          <AdminTable headers={["Position", "User", "Sponsor", "Package", "Below count", "Activated", "Actions"]}>
            {positions.map((row) => (
              <tr key={compact(row.user_id)}>
                <Td>{compact(row.position_number)}</Td>
                <Td>{compact(row.email || row.display_name || row.user_id)}</Td>
                <Td>{compact(row.sponsor_email || row.sponsor_user_id)}</Td>
                <Td>{money(row.package_amount)}</Td>
                <Td>{compact(row.single_leg_count)}</Td>
                <Td>{formatDate(row.activated_at)}</Td>
                <Td><button className="rounded-lg bg-[#0b1728]/75 px-2 py-1 text-xs" onClick={() => recalculate(row.user_id)} type="button">Recalculate</button></Td>
              </tr>
            ))}
          </AdminTable>
        </Panel>
        <Panel title="Single-leg reward slabs">
          <AdminTable headers={["User", "Slab", "Target", "Reward", "Direct req", "Actual members", "Actual direct", "Status", "Paid", "Proof"]}>
            {rewards.map((row) => (
              <tr key={compact(row.id)}>
                <Td>{compact(row.email || row.display_name || row.user_id)}</Td>
                <Td>{compact(row.slab_number)}</Td>
                <Td>{compact(row.target_members)}</Td>
                <Td>{money(row.reward_amount)}</Td>
                <Td>{compact(row.required_direct_referrals)}</Td>
                <Td>{compact(row.actual_single_leg_members)}</Td>
                <Td>{compact(row.actual_direct_referrals)}</Td>
                <Td><Badge value={compact(row.status)} /></Td>
                <Td>{formatDate(row.paid_at)}</Td>
                <Td>{compact(row.proof_reference)}</Td>
              </tr>
            ))}
          </AdminTable>
        </Panel>
        <HbTable title="HB9 single-leg reserve" rows={filtered} headers={["ID", "Buyer", "Package", "Amount", "Status", "Algorithm", "Created"]} fields={["id", "email", "package_name", "amount_usd", "status", "algorithm_version", "created_at"]} moneyFields={["amount_usd"]} dateFields={["created_at"]} />
      </div>
    );
  }

  if (page === "hb-followers") {
    const summary = Array.isArray(data.summary) ? data.summary as Array<Record<string, unknown>> : [];
    const pending = summary.find((row) => row.status === "pending")?.count || 0;
    return (
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3"><Metric title="Pending followers" value={compact(pending)} tone="accent" /><Metric title="Total requests" value={compact(items.length)} /><Metric title="Visible rows" value={compact(filtered.length)} /></div>
        <Panel title="HB9 followers requests">
          <AdminTable headers={["User", "Wallet", "Package", "Platform", "Link", "Followers", "Status", "Date", "Note", "Actions"]}>
            {filtered.map((row) => (
              <tr key={compact(row.id)}>
                <Td>{compact(row.email || row.display_name)}</Td><Td>{compact(row.wallet_address)}</Td><Td>{compact(row.package_name)} {money(row.package_price)}</Td><Td>{compact(row.platform)}</Td><Td><a className="text-accent underline" href={String(row.submitted_link || "#")} target="_blank" rel="noreferrer">Open</a></Td><Td>{compact(row.followers_count)}</Td><Td><Badge value={compact(row.status)} /></Td><Td>{formatDate(row.created_at)}</Td><Td>{compact(row.admin_note)}</Td>
                <Td><RequestAdminActions row={row} onPatch={(status, adminNote) => patch(`/admin/hb/followers-requests/${row.id}`, { status, adminNote })} /></Td>
              </tr>
            ))}
          </AdminTable>
        </Panel>
      </div>
    );
  }

  if (page === "hb-custom-software") {
    const summary = Array.isArray(data.summary) ? data.summary as Array<Record<string, unknown>> : [];
    const pending = summary.find((row) => row.status === "pending")?.count || 0;
    return (
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3"><Metric title="Pending custom requests" value={compact(pending)} tone="accent" /><Metric title="Total requests" value={compact(items.length)} /><Metric title="Visible rows" value={compact(filtered.length)} /></div>
        <Panel title="HB9 custom software requests">
          <AdminTable headers={["User", "Wallet", "Package", "Type", "Architecture", "Requirements", "Status", "Date", "Note", "Actions"]}>
            {filtered.map((row) => (
              <tr key={compact(row.id)}>
                <Td>{compact(row.email || row.display_name)}</Td><Td>{compact(row.wallet_address)}</Td><Td>{compact(row.package_name)} {money(row.package_price)}</Td><Td>{compact(row.software_type)}</Td><Td>{compact(row.architecture)}</Td><Td>{compact(row.requirements_note)}</Td><Td><Badge value={compact(row.status)} /></Td><Td>{formatDate(row.created_at)}</Td><Td>{compact(row.admin_note)}</Td>
                <Td><RequestAdminActions row={row} onPatch={(status, adminNote) => patch(`/admin/hb/custom-software-requests/${row.id}`, { status, adminNote })} /></Td>
              </tr>
            ))}
          </AdminTable>
        </Panel>
      </div>
    );
  }

  if (page === "hb-reports") {
    return <HbReports data={data} />;
  }

  if (page === "hb-transparency") {
    return <HbTransparency data={data} />;
  }

  if (page === "hb-treasury") {
    return <HbTreasury data={data} token={token} />;
  }

  if (page === "hb-governance") {
    return <HbGovernance data={data} />;
  }

  if (page === "hb-risk") {
    return <HbRisk data={data} />;
  }

  if (page === "hb-onchain") {
    return <HbOnchainPurchases data={data} token={token} />;
  }

  if (page === "hb-contracts") {
    return <HbContracts data={data} token={token} />;
  }

  return <Panel title="HB9"><p className="text-sm text-slate-400">No data available.</p></Panel>;
}

function HbOnchainPurchases({ data, token }: { data: Record<string, unknown>; token: string }) {
  const items = Array.isArray(data.items) ? data.items as Array<Record<string, unknown>> : [];
  const health = (data.syncHealth && typeof data.syncHealth === "object" ? data.syncHealth : {}) as Record<string, unknown>;
  async function resync() {
    await adminRequest("/admin/hb/onchain-purchases/resync", token, { method: "POST", body: JSON.stringify({}) });
    window.location.reload();
  }
  return (
    <Panel title="On-chain package purchases">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
        <span>Mode: {compact(data.mode)}. Activation must come from indexed PackagePurchased events.</span>
        <button className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-black" onClick={resync} type="button">Trigger resync</button>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric title="Sync health" value={String(health.configReady ? "Ready" : "Needs config")} tone={health.configReady ? "mint" : "danger"} />
        <Metric title="Latest indexed block" value={compact(health.latestIndexedBlock || 0)} />
        <Metric title="Pending sync" value={compact(health.pendingSyncCount || 0)} />
        <Metric title="Failed sync" value={compact(health.failedSyncCount || 0)} tone={Number(health.failedSyncCount || 0) > 0 ? "danger" : "mint"} />
        <Metric title="Contract RPC" value={health.dryRun ? "Dry run" : health.rpcHealthy ? "Connected" : "Offline"} tone={health.dryRun || health.rpcHealthy ? "mint" : "danger"} />
      </div>
      <AdminTable headers={["Tx", "Event", "User", "Buyer", "Sponsor", "Package", "Amount", "Block", "Log", "Status", "Explorer", "Synced"]}>
        {items.map((row) => (
          <tr key={compact(row.id)}>
            <Td>{compact(row.tx_hash)}</Td>
            <Td>{compact(row.contract_event_id)}</Td>
            <Td>{compact(row.email || row.mobile_number || row.display_name)}</Td>
            <Td>{compact(row.buyer_address)}</Td>
            <Td>{compact(row.sponsor_address)}</Td>
            <Td>{compact(row.onchain_package_id)}</Td>
            <Td>{money(row.amount_usd)}</Td>
            <Td>{compact(row.block_number)}</Td>
            <Td>{compact(row.log_index)}</Td>
            <Td><Badge value={compact(row.status)} /></Td>
            <Td><ExplorerButton type="tx" value={String(row.tx_hash || "")} compact /></Td>
            <Td>{formatDate(row.synced_at || row.created_at)}</Td>
          </tr>
        ))}
      </AdminTable>
    </Panel>
  );
}

function TreasuryHealthPanel({ health }: { health: Record<string, unknown> }) {
  const warnings = Array.isArray(health.warnings) ? health.warnings as Array<Record<string, unknown>> : [];
  const queue = (health.queue && typeof health.queue === "object" ? health.queue : {}) as Record<string, unknown>;
  return (
    <Panel title="Treasury health monitoring">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric title="Reserve ratio" value={`${Number(health.reserveRatio || 0).toFixed(2)}x`} tone={Number(health.reserveRatio || 0) >= 1 ? "mint" : "danger"} />
        <Metric title="Pending liabilities" value={money(health.pendingWithdrawalLiabilities)} tone="accent" />
        <Metric title="Active liabilities" value={money(health.activeLiabilities)} />
        <Metric title="Utilization" value={`${Number(health.utilizationPercent || 0).toFixed(1)}%`} tone={Number(health.utilizationPercent || 0) > 90 ? "danger" : "mint"} />
        <Metric title="Stuck payouts" value={compact(queue.stuck_payout_count || 0)} tone={Number(queue.stuck_payout_count || 0) > 0 ? "danger" : "mint"} />
      </div>
      <div className="mt-4 grid gap-2">
        {warnings.length === 0 ? <div className="rounded-xl border border-mint/20 bg-mint/10 p-3 text-sm text-mint">No reserve warnings active.</div> : warnings.map((warning) => (
          <div key={compact(warning.type)} className="rounded-xl border border-yellow-400/25 bg-yellow-400/10 p-3 text-sm text-yellow-100">
            <span className="font-semibold">{compact(warning.type)}</span>: {compact(warning.message)}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function RiskPanel({ data }: { data: Record<string, unknown> }) {
  const rows = Array.isArray(data.highRiskAccounts) ? data.highRiskAccounts as Array<Record<string, unknown>> : [];
  return (
    <Panel title="Risk engine">
      {rows.length === 0 ? <p className="text-sm text-slate-400">No high-risk accounts detected.</p> : (
        <AdminTable headers={["User", "Wallet", "Risk score", "Flag", "Reasons"]}>
          {rows.map((row) => (
            <tr key={compact(row.userId || row.id)}>
              <Td>{compact(row.display_name || row.email || row.mobile_number || row.userId)}</Td>
              <Td>{compact(row.walletAddress || row.usdt_bep20_address || row.hb9_wallet_address)}</Td>
              <Td><Badge value={compact(row.riskScore || 0)} /></Td>
              <Td><Badge value={compact(row.risk_flag || "normal")} /></Td>
              <Td>{Array.isArray(row.reasons) ? row.reasons.join(", ") : "-"}</Td>
            </tr>
          ))}
        </AdminTable>
      )}
    </Panel>
  );
}

function HbProductionDashboard({ data, token }: { data: Record<string, unknown>; token: string }) {
  const health = (data.health && typeof data.health === "object" ? data.health : {}) as Record<string, unknown>;
  const analytics = (data.analytics && typeof data.analytics === "object" ? data.analytics : {}) as Record<string, unknown>;
  const controls = (data.controls && typeof data.controls === "object" ? data.controls : {}) as Record<string, unknown>;
  const treasury = (health.treasuryHealth && typeof health.treasuryHealth === "object" ? health.treasuryHealth : {}) as Record<string, unknown>;
  const live = (treasury.live && typeof treasury.live === "object" ? treasury.live : {}) as Record<string, unknown>;
  const riskAlerts = (data.riskAlerts && typeof data.riskAlerts === "object" ? data.riskAlerts : {}) as Record<string, unknown>;
  const packagePopularity = Array.isArray(analytics.package_popularity) ? analytics.package_popularity as Array<Record<string, unknown>> : [];
  const [readiness, setReadiness] = useState<Array<Record<string, unknown>>>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    adminRequest<{ items: Array<Record<string, unknown>>; ready: boolean }>("/admin/hb/readiness", token)
      .then((result) => {
        setReadiness(result.items || []);
        setReady(Boolean(result.ready));
      })
      .catch(() => undefined);
  }, [token]);

  async function updateControls(body: Record<string, unknown>) {
    if (!window.confirm("Apply production safety control change?")) return;
    setBusy("controls");
    await adminRequest("/admin/hb/production-controls", token, {
      method: "PATCH",
      body: JSON.stringify({ ...body, safetyConfirmation: "CONFIRM_MAINNET_SAFE_ACTION" })
    });
    window.location.reload();
  }

  async function toggleReadiness(row: Record<string, unknown>) {
    setBusy(String(row.key));
    await adminRequest("/admin/hb/readiness", token, {
      method: "PATCH",
      body: JSON.stringify({
        key: row.key,
        confirmed: !row.confirmed,
        note: row.confirmed ? "Unchecked during rollout review" : "Confirmed from production checklist",
        safetyConfirmation: "CONFIRM_MAINNET_SAFE_ACTION"
      })
    });
    const next = await adminRequest<{ items: Array<Record<string, unknown>>; ready: boolean }>("/admin/hb/readiness", token);
    setReadiness(next.items || []);
    setReady(Boolean(next.ready));
    setBusy("");
  }

  return (
    <div className="grid gap-4">
      <Panel title="Production Health">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="API status" value={compact(health.apiStatus)} tone={health.apiStatus === "healthy" ? "mint" : "danger"} />
          <Metric title="DB status" value={compact(health.dbStatus)} tone={health.dbStatus === "configured" ? "mint" : "danger"} />
          <Metric title="Indexer status" value={compact(health.indexerStatus)} tone={health.indexerStatus === "healthy" ? "mint" : "accent"} />
          <Metric title="Latest indexed block" value={compact(health.latestIndexedBlock || 0)} />
          <Metric title="Treasury health" value={compact((health.treasuryHealth as Record<string, unknown> | undefined)?.status || "visible")} tone="mint" />
          <Metric title="Pending withdrawals" value={`${compact((health.pendingWithdrawals as Record<string, unknown> | undefined)?.count || 0)} / ${money((health.pendingWithdrawals as Record<string, unknown> | undefined)?.total)}`} tone="accent" />
          <Metric title="Risk alerts" value={compact(health.riskAlerts || 0)} tone={Number(health.riskAlerts || 0) > 0 ? "danger" : "mint"} />
          <Metric title="RPC latency" value={health.rpcLatencyMs ? `${health.rpcLatencyMs}ms` : compact(health.rpcStatus)} tone={health.rpcStatus === "healthy" ? "mint" : "danger"} />
          <Metric title="BscScan status" value={compact(health.bscScanStatus)} />
          <Metric title="Contract config" value={compact(health.contractConfigStatus)} tone={health.contractConfigStatus === "configured" ? "mint" : "accent"} />
          <Metric title="Proof integrity" value={`${compact(health.proofIntegrityPercent || 0)}%`} tone={Number(health.proofIntegrityPercent || 0) >= 100 ? "mint" : "danger"} />
          <Metric title="Active users today" value={compact(health.activeUsersToday || 0)} />
          <Metric title="Failed wallet auth" value={compact(health.failedWalletAuthAttempts || 0)} tone={Number(health.failedWalletAuthAttempts || 0) > 0 ? "danger" : "mint"} />
        </div>
      </Panel>
      <Panel title="Treasury Live Banner">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Metric title="Deposit wallet" value={live.depositWalletConnected ? "connected" : "missing"} tone={live.depositWalletConnected ? "mint" : "danger"} />
          <Metric title="Withdrawal vault" value={live.withdrawalVaultConnected ? "connected" : "missing"} tone={live.withdrawalVaultConnected ? "mint" : "danger"} />
          <Metric title="Signer" value={live.signerVerified ? "verified" : "blocked"} tone={live.signerVerified ? "mint" : "danger"} />
          <Metric title="BSC RPC" value={compact(live.rpcStatus || health.rpcStatus || "not checked")} tone={(live.rpcStatus || health.rpcStatus) === "healthy" ? "mint" : "danger"} />
          <Metric title="USDT contract" value={live.usdtContractVerified ? "verified" : "blocked"} tone={live.usdtContractVerified ? "mint" : "danger"} />
        </div>
      </Panel>

      <Panel title="Rollout Mode / Emergency Controls">
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Rollout mode" value={compact(controls.rolloutMode)} tone={controls.rolloutMode === "public_live" ? "mint" : "accent"} />
          <Metric title="Daily activation limit" value={compact(controls.dailyActivationLimit || 0)} />
          <Metric title="Rollback mode" value={controls.rollbackMode ? "enabled" : "off"} tone={controls.rollbackMode ? "danger" : "mint"} />
          <Metric title="Readiness" value={ready ? "ready" : "blocked"} tone={ready ? "mint" : "danger"} />
        </div>
        <div className="flex flex-wrap gap-2">
          {["closed_beta", "limited_live", "public_live"].map((mode) => (
            <button key={mode} className="rounded-xl border border-sky-200/10 bg-[#0b1728]/75 px-3 py-2 text-xs text-slate-200 disabled:opacity-60" disabled={busy === "controls"} onClick={() => updateControls({ rolloutMode: mode })} type="button">{mode}</button>
          ))}
          <button className="rounded-xl bg-danger/20 px-3 py-2 text-xs text-red-100" onClick={() => updateControls({ emergencyPause: !controls.emergencyPause })} type="button">{controls.emergencyPause ? "Resume API" : "Emergency pause"}</button>
          <button className="rounded-xl bg-danger/20 px-3 py-2 text-xs text-red-100" onClick={() => updateControls({ emergencyIndexerStop: !controls.emergencyIndexerStop })} type="button">{controls.emergencyIndexerStop ? "Resume indexer" : "Stop indexer"}</button>
          <button className="rounded-xl bg-danger/20 px-3 py-2 text-xs text-red-100" onClick={() => updateControls({ emergencyActivationDisable: !controls.emergencyActivationDisable })} type="button">{controls.emergencyActivationDisable ? "Enable activation" : "Disable activation"}</button>
          <button className="rounded-xl bg-danger/20 px-3 py-2 text-xs text-red-100" onClick={() => updateControls({ emergencyWithdrawalFreeze: !controls.emergencyWithdrawalFreeze })} type="button">{controls.emergencyWithdrawalFreeze ? "Unfreeze withdrawals" : "Freeze withdrawals"}</button>
          <button className="rounded-xl bg-danger/20 px-3 py-2 text-xs text-red-100" onClick={() => updateControls({ emergencyDepositFreeze: !controls.emergencyDepositFreeze })} type="button">{controls.emergencyDepositFreeze ? "Unfreeze deposits" : "Freeze deposits"}</button>
          <button className="rounded-xl bg-danger/20 px-3 py-2 text-xs text-red-100" onClick={() => updateControls({ emergencyPackagePurchasePause: !controls.emergencyPackagePurchasePause })} type="button">{controls.emergencyPackagePurchasePause ? "Resume packages" : "Pause packages"}</button>
          <button className="rounded-xl bg-danger/20 px-3 py-2 text-xs text-red-100" onClick={() => updateControls({ emergencyCoinConversionDisable: !controls.emergencyCoinConversionDisable })} type="button">{controls.emergencyCoinConversionDisable ? "Enable conversion" : "Disable conversion"}</button>
          <button className="rounded-xl bg-danger/20 px-3 py-2 text-xs text-red-100" onClick={() => updateControls({ emergencyFollowerRequestDisable: !controls.emergencyFollowerRequestDisable })} type="button">{controls.emergencyFollowerRequestDisable ? "Enable followers" : "Disable followers"}</button>
          <button className="rounded-xl bg-danger/20 px-3 py-2 text-xs text-red-100" onClick={() => updateControls({ rollbackMode: !controls.rollbackMode })} type="button">{controls.rollbackMode ? "Exit rollback" : "Safe rollback mode"}</button>
          <button className="rounded-xl bg-danger/20 px-3 py-2 text-xs text-red-100" onClick={() => updateControls({ emergencyTreasuryFreezeNotice: !controls.emergencyTreasuryFreezeNotice })} type="button">{controls.emergencyTreasuryFreezeNotice ? "Clear treasury notice" : "Treasury freeze notice"}</button>
        </div>
        <div className="mt-4 grid gap-2 text-sm text-slate-300">
          <InfoRow label="Launch banner" value={compact(controls.launchBanner)} />
          <InfoRow label="Warning banner" value={compact(controls.warningBanner)} />
          <InfoRow label="Maintenance notice" value={compact(controls.maintenanceNotice)} />
        </div>
      </Panel>

      <Panel title="Mainnet Readiness Checklist">
        <AdminTable headers={["Check", "Status", "Confirmed by", "Confirmed at", "Action"]}>
          {readiness.map((row) => (
            <tr key={compact(row.key)}>
              <Td>{compact(row.key).replace(/_/g, " ")}</Td>
              <Td><Badge value={row.confirmed ? "confirmed" : "pending"} /></Td>
              <Td>{compact(row.confirmed_by)}</Td>
              <Td>{formatDate(row.confirmed_at)}</Td>
              <Td><button className="rounded-lg bg-[#0b1728]/75 px-2 py-1 text-xs" disabled={busy === row.key} onClick={() => toggleReadiness(row)} type="button">{row.confirmed ? "Uncheck" : "Confirm"}</button></Td>
            </tr>
          ))}
        </AdminTable>
      </Panel>

      <Panel title="Production Analytics">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Daily activations" value={compact(analytics.daily_activations || 0)} />
          <Metric title="Daily package volume" value={money(analytics.daily_package_volume)} />
          <Metric title="Treasury inflow" value={money(analytics.treasury_inflow)} tone="mint" />
          <Metric title="Treasury outflow" value={money(analytics.treasury_outflow)} tone="accent" />
          <Metric title="Active referrals" value={compact(analytics.active_referrals || 0)} />
          <Metric title="Wallet success rate" value={`${compact(analytics.wallet_connection_success_rate || 0)}%`} />
          <Metric title="Tx failure rate" value={`${compact(analytics.transaction_failure_rate || 0)}%`} tone={Number(analytics.transaction_failure_rate || 0) > 0 ? "danger" : "mint"} />
          <Metric title="Indexer risk alerts" value={compact(riskAlerts.failedIndexerEvents || 0)} tone={Number(riskAlerts.failedIndexerEvents || 0) > 0 ? "danger" : "mint"} />
        </div>
      </Panel>

      <Panel title="Package Popularity">
        <AdminTable headers={["Package", "Amount", "Purchases", "Volume"]}>
          {packagePopularity.map((row) => (
            <tr key={compact(row.name)}>
              <Td>{compact(row.name)}</Td>
              <Td>{money(row.amount_usd)}</Td>
              <Td>{compact(row.purchase_count || 0)}</Td>
              <Td>{money(row.volume)}</Td>
            </tr>
          ))}
        </AdminTable>
      </Panel>
    </div>
  );
}

function HbGovernance({ data }: { data: Record<string, unknown> }) {
  const owners = (data.owners && typeof data.owners === "object" ? data.owners : {}) as Record<string, unknown>;
  const pending = (data.pendingOwnershipTransfer && typeof data.pendingOwnershipTransfer === "object" ? data.pendingOwnershipTransfer : {}) as Record<string, unknown>;
  const contracts = Array.isArray(data.contracts) ? data.contracts as Array<Record<string, unknown>> : [];
  return (
    <div className="grid gap-4">
      <Panel title="Governance / Treasury Control">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Multisig status" value={compact(data.multisigStatus)} tone={data.multisigStatus === "ready" ? "mint" : "danger"} />
          <Metric title="Safe mode" value={data.mainnetSafeMode ? "Enabled" : "Disabled"} tone={data.mainnetSafeMode ? "mint" : "danger"} />
          <Metric title="Chain" value={compact(data.chainId)} />
          <Metric title="Pending transfer" value={Object.values(pending).some(Boolean) ? "Pending" : "None"} tone="accent" />
        </div>
        <div className="mt-4 grid gap-3 text-sm text-slate-300">
          <InfoRow label="Multisig owner" value={compact(data.multisigAddress)} />
          <InfoRow label="Package manager owner" value={compact(owners.packageManager)} />
          <InfoRow label="Package manager pending owner" value={compact(pending.packageManager)} />
          <InfoRow label="Treasury splitter owner" value={compact(owners.treasurySplitter)} />
          <InfoRow label="Treasury splitter pending owner" value={compact(pending.treasurySplitter)} />
          <InfoRow label="Income distributor owner" value={compact(owners.incomeDistributor)} />
          <InfoRow label="Income distributor pending owner" value={compact(pending.incomeDistributor)} />
          <InfoRow label="Treasury authority status" value={compact(data.treasuryAuthorityStatus)} />
        </div>
      </Panel>
      <Panel title="Contract ownership surfaces">
        <AdminTable headers={["Key", "Address", "Owner status", "Explorer"]}>
          {contracts.map((row) => (
            <tr key={compact(row.key)}>
              <Td>{compact(row.key)}</Td>
              <Td>{compact(row.contract_address)}</Td>
              <Td><Badge value={row.contract_address ? "configured" : "Contract not configured yet"} /></Td>
              <Td><ExplorerButton baseUrl={String(data.explorerBaseUrl || "https://bscscan.com")} type="contract" value={String(row.contract_address || "")} compact /></Td>
            </tr>
          ))}
        </AdminTable>
      </Panel>
    </div>
  );
}

function HbRisk({ data }: { data: Record<string, unknown> }) {
  const payouts = Array.isArray(data.suspiciousPayouts) ? data.suspiciousPayouts as Array<Record<string, unknown>> : [];
  return (
    <div className="grid gap-4">
      <RiskPanel data={data} />
      <Panel title="Suspicious payout activity">
        <AdminTable headers={["Withdrawal", "User", "Wallet", "Payout", "Status", "Requested"]}>
          {payouts.map((row) => (
            <tr key={compact(row.id)}>
              <Td>{compact(row.id)}</Td>
              <Td>{compact(row.email || row.display_name)}</Td>
              <Td>{compact(row.wallet_address)}</Td>
              <Td>{money(row.payout_amount_usd)}</Td>
              <Td><Badge value={compact(row.status)} /></Td>
              <Td>{formatDate(row.requested_at)}</Td>
            </tr>
          ))}
        </AdminTable>
      </Panel>
    </div>
  );
}

function HbContracts({ data, token }: { data: Record<string, unknown>; token: string }) {
  const items = Array.isArray(data.items) ? data.items as Array<Record<string, unknown>> : [];
  const fieldMap: Record<string, string> = {
    package_manager: "packageManagerAddress",
    referral_registry: "referralRegistryAddress",
    treasury_splitter: "treasurySplitterAddress",
    income_distributor: "incomeDistributorAddress",
    usdt_bep20: "usdtBep20Address"
  };
  async function update(row: Record<string, unknown>) {
    const field = fieldMap[String(row.key)];
    if (!field) return;
    const next = window.prompt(`Set ${row.key} contract address. Leave blank to clear.`, String(row.contract_address || ""));
    if (next === null) return;
    if (!window.confirm("Mainnet safe mode requires explicit confirmation for contract updates.")) return;
    await adminRequest("/admin/hb/onchain-contracts", token, {
      method: "PATCH",
      body: JSON.stringify({ [field]: next.trim(), enabled: true, safetyConfirmation: "CONFIRM_MAINNET_SAFE_ACTION" })
    });
    window.location.reload();
  }
  async function resyncContracts() {
    await adminRequest("/admin/hb/onchain-purchases/resync", token, { method: "POST", body: JSON.stringify({}) });
    window.alert("On-chain resync queued.");
  }
  return (
    <Panel title="HB9 contract addresses">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
        <span>Stores public contract addresses only. Explorer: {compact(data.explorerBaseUrl)}</span>
        <button className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-black" onClick={resyncContracts} type="button">Trigger resync</button>
      </div>
      <AdminTable headers={["Key", "Address", "Chain", "Start block", "Enabled", "Source", "Explorer", "Updated by", "Updated", "Actions"]}>
        {items.map((row) => (
          <tr key={compact(row.key)}>
            <Td>{compact(row.key)}</Td>
            <Td>{compact(row.contract_address)}</Td>
            <Td>{compact(row.chain_id)}</Td>
            <Td>{compact(row.start_block)}</Td>
            <Td><Badge value={String(Boolean(row.enabled))} /></Td>
            <Td>{compact(row.source)}</Td>
            <Td><ExplorerButton baseUrl={String(data.explorerBaseUrl || "https://bscscan.com")} type="contract" value={String(row.contract_address || "")} compact /></Td>
            <Td>{compact(row.updated_by)}</Td>
            <Td>{formatDate(row.updated_at)}</Td>
            <Td><button className="rounded-lg bg-[#0b1728]/75 px-2 py-1 text-xs" onClick={() => update(row)} type="button">Edit</button></Td>
          </tr>
        ))}
      </AdminTable>
    </Panel>
  );
}

function HbFundsManagement({ data, token, query }: { data: Record<string, unknown>; token: string; query: string }) {
  const history = Array.isArray(data.items) ? data.items as Array<Record<string, unknown>> : [];
  const [tab, setTab] = useState<"transfer" | "credit" | "deduct" | "history" | "bulk">("transfer");
  const [users, setUsers] = useState<Array<Record<string, unknown>>>([]);
  const [form, setForm] = useState({ senderUserId: "", receiverUserId: "", userId: "", coinSymbol: "USDT", amount: "", note: "", userIds: "" });
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const coins = ["USDT", "BTC", "BNB", "HB9", "PEPE", "DOGE", "SHIB", "BTTC", "ADA"];
  const filteredHistory = history.filter((row) => !query || JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    adminRequest<Record<string, unknown>>("/admin/hb/coins/users", token)
      .then((result) => {
        const nextUsers = Array.isArray(result.users) ? result.users as Array<Record<string, unknown>> : [];
        setUsers(nextUsers);
        const first = String(nextUsers[0]?.id || "");
        setForm((current) => ({
          ...current,
          senderUserId: current.senderUserId || first,
          receiverUserId: current.receiverUserId || String(nextUsers[1]?.id || first),
          userId: current.userId || first
        }));
      })
      .catch(() => undefined);
  }, [token]);

  function setField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(path: string, body: Record<string, unknown>, warning: string) {
    if (!form.note.trim() || form.note.trim().length < 3) {
      setMessage("Note or reason is required.");
      return;
    }
    if (Number(form.amount) <= 0) {
      setMessage("Enter a positive amount.");
      return;
    }
    if (!window.confirm(warning)) return;
    setBusy(true);
    setMessage("");
    try {
      await adminRequest(path, token, {
        method: "POST",
        body: JSON.stringify({ ...body, coinSymbol: form.coinSymbol, amount: form.amount, note: form.note.trim(), idempotencyKey: `hb-ui-${path}-${Date.now()}-${crypto.randomUUID()}` })
      });
      setMessage("Internal accounting action recorded with proof.");
      window.location.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Fund action failed.");
    } finally {
      setBusy(false);
    }
  }

  const userSelect = (value: string, onChange: (value: string) => void) => (
    <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
      {users.map((user) => <option key={compact(user.id)} value={String(user.id)}>{compact(user.display_name || user.email || user.mobile_number)} - {compact(user.id).slice(0, 8)}</option>)}
    </select>
  );

  const controls = (
    <div className="grid gap-3 md:grid-cols-3">
      <label className="space-y-2 text-sm text-slate-400">
        <span>Coin</span>
        <select className="field" value={form.coinSymbol} onChange={(event) => setField("coinSymbol", event.target.value)}>
          {coins.map((coin) => <option key={coin} value={coin}>{displayAdminCoinSymbol(coin)}</option>)}
        </select>
      </label>
      <label className="space-y-2 text-sm text-slate-400">
        <span>Amount</span>
        <input className="field" inputMode="decimal" value={form.amount} onChange={(event) => setField("amount", event.target.value)} placeholder="0.00000000" />
      </label>
      <label className="space-y-2 text-sm text-slate-400">
        <span>Note / reason</span>
        <input className="field" value={form.note} onChange={(event) => setField("note", event.target.value)} placeholder="Required accounting reason" />
      </label>
    </div>
  );

  return (
    <div className="grid gap-4">
      <Panel title="Funds Management">
        <div className="mb-4 flex flex-wrap gap-2">
          {(["transfer", "credit", "deduct", "history", "bulk"] as const).map((item) => (
            <button key={item} className={`rounded-xl px-3 py-2 text-xs font-semibold ${tab === item ? "bg-accent text-black" : "border border-sky-200/10 bg-[#0b1728]/75 text-slate-200"}`} onClick={() => setTab(item)} type="button">{item.replace("_", " ")}</button>
          ))}
        </div>
        {tab === "transfer" ? (
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-400"><span>Sender</span>{userSelect(form.senderUserId, (value) => setField("senderUserId", value))}</label>
              <label className="space-y-2 text-sm text-slate-400"><span>Receiver</span>{userSelect(form.receiverUserId, (value) => setField("receiverUserId", value))}</label>
            </div>
            {controls}
            <button className="w-fit rounded-2xl bg-accent px-4 py-3 font-semibold text-black disabled:opacity-60" disabled={busy} onClick={() => submit("/admin/hb/funds/transfer", { senderUserId: form.senderUserId, receiverUserId: form.receiverUserId }, "Transfer internal balance between users? This is irreversible except by a new correcting entry.")} type="button">Transfer Funds</button>
          </div>
        ) : null}
        {tab === "credit" ? (
          <div className="grid gap-4">
            <label className="space-y-2 text-sm text-slate-400"><span>User</span>{userSelect(form.userId, (value) => setField("userId", value))}</label>
            {controls}
            <button className="w-fit rounded-2xl bg-mint px-4 py-3 font-semibold text-black disabled:opacity-60" disabled={busy} onClick={() => submit("/admin/hb/funds/credit", { userId: form.userId }, "Credit internal balance to this user?")} type="button">Credit User</button>
          </div>
        ) : null}
        {tab === "deduct" ? (
          <div className="grid gap-4">
            <label className="space-y-2 text-sm text-slate-400"><span>User</span>{userSelect(form.userId, (value) => setField("userId", value))}</label>
            {controls}
            <button className="w-fit rounded-2xl bg-danger px-4 py-3 font-semibold text-white disabled:opacity-60" disabled={busy} onClick={() => submit("/admin/hb/funds/deduct", { userId: form.userId }, "Deduct internal balance? Negative balances are blocked, but this action still requires a correcting entry to reverse.")} type="button">Deduct Balance</button>
          </div>
        ) : null}
        {tab === "bulk" ? (
          <div className="grid gap-4">
            <label className="space-y-2 text-sm text-slate-400">
              <span>User IDs</span>
              <textarea className="field min-h-28" value={form.userIds} onChange={(event) => setField("userIds", event.target.value)} placeholder="Paste one user ID per line or comma-separated" />
            </label>
            {controls}
            <button className="w-fit rounded-2xl bg-accent px-4 py-3 font-semibold text-black disabled:opacity-60" disabled={busy} onClick={() => {
              const userIds = form.userIds.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
              submit("/admin/hb/funds/bulk-distribution", { userIds }, `Distribute ${form.amount} ${form.coinSymbol} to ${userIds.length} users? Rollback requires manual correcting entries.`);
            }} type="button">Run Bulk Distribution</button>
          </div>
        ) : null}
        {message ? <p className="mt-4 text-sm text-sky-100">{message}</p> : null}
      </Panel>

      <Panel title="Funds History">
        <AdminTable headers={["Type", "Sender", "Receiver/User", "Coin", "Amount", "Before", "After", "Proof", "Admin", "Note", "Created"]}>
          {filteredHistory.map((row) => (
            <tr key={compact(row.id)}>
              <Td><Badge value={compact(row.action_type)} /></Td>
              <Td>{compact(row.sender_email || row.sender_user_id)}</Td>
              <Td>{compact(row.receiver_email || row.receiver_user_id)}</Td>
              <Td><AdminCoin symbol={compact(row.coin_symbol)} /></Td>
              <Td>{compact(row.amount)}</Td>
              <Td>{compact(row.sender_before_balance || row.receiver_before_balance)}</Td>
              <Td>{compact(row.sender_after_balance || row.receiver_after_balance)}</Td>
              <Td>{row.public_reference_id ? <a className="text-accent" href={`/proof/${encodeURIComponent(String(row.public_reference_id))}`} target="_blank" rel="noreferrer">{compact(row.public_reference_id)}</a> : "-"}</Td>
              <Td>{compact(row.admin_id)}</Td>
              <Td>{compact(row.note)}</Td>
              <Td>{formatDate(row.created_at)}</Td>
            </tr>
          ))}
        </AdminTable>
      </Panel>
    </div>
  );
}

function HbCoins({ data, token, query }: { data: Record<string, unknown>; token: string; query: string }) {
  const users = Array.isArray(data.users) ? data.users as Array<Record<string, unknown>> : [];
  const coins = Array.isArray(data.coins) ? data.coins as Array<Record<string, unknown>> : [];
  const adjustableCoins = coins.filter((coin) => String(coin.symbol || coin.coin_symbol).toUpperCase() !== "USDT");
  const ledger = Array.isArray(data.ledger) ? data.ledger as Array<Record<string, unknown>> : [];
  const totals = Array.isArray(data.totals) ? data.totals as Array<Record<string, unknown>> : [];
  const latestAdminActions = Array.isArray(data.latestAdminActions) ? data.latestAdminActions as Array<Record<string, unknown>> : [];
  const [userId, setUserId] = useState("");
  const [coinSymbol, setCoinSymbol] = useState("BTC");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"credit" | "debit" | "">("");
  const [message, setMessage] = useState("");
  const [detailLedger, setDetailLedger] = useState<Array<Record<string, unknown>>>(ledger);
  const [reconciliation, setReconciliation] = useState<Record<string, unknown> | null>(null);
  const selectedUser = users.find((user) => String(user.id) === userId) || users[0];
  const filteredLedger = detailLedger.filter((row) => !query || JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (!userId && users[0]?.id) setUserId(String(users[0].id));
  }, [userId, users]);

  useEffect(() => {
    setDetailLedger(ledger);
  }, [ledger]);

  useEffect(() => {
    let active = true;
    adminRequest<Record<string, unknown>>("/admin/hb/coins/reconciliation", token)
      .then((result) => {
        if (active) setReconciliation(result);
      })
      .catch(() => {
        if (active) setReconciliation(null);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function selectUser(nextUserId: string) {
    setUserId(nextUserId);
    if (!nextUserId) return;
    const result = await adminRequest<Record<string, unknown>>(`/admin/hb/coins/users?userId=${encodeURIComponent(nextUserId)}`, token);
    setDetailLedger(Array.isArray(result.ledger) ? result.ledger as Array<Record<string, unknown>> : []);
  }

  async function adjust(direction: "credit" | "debit") {
    if (!userId || !coinSymbol || Number(amount) <= 0) {
      setMessage("Choose user, coin, and a positive amount.");
      return;
    }
    if (note.trim().length < 3) {
      setMessage("Admin note is required for manual coin adjustments.");
      return;
    }
    setBusy(direction);
    setMessage("");
    try {
      await adminRequest(`/admin/hb/coins/${direction}`, token, {
        method: "POST",
        body: JSON.stringify({ userId, coinSymbol, amount, note: note.trim() })
      });
      setMessage(`${coinSymbol} ${direction} recorded.`);
      window.location.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Coin adjustment failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {totals.map((row) => (
          <Metric key={compact(row.coin_symbol)} title={`${compact(row.coin_symbol)} balance`} value={compact(row.total_balance || 0)} tone={String(row.coin_symbol) === "USDT" ? "mint" : "slate"} />
        ))}
      </div>

      <Panel title="Coin summary report">
        <AdminTable headers={["Coin", "Users holding", "Total balance", "Credited", "Debited", "Net supply"]}>
          {totals.map((row) => (
            <tr key={compact(row.coin_symbol)}>
              <Td><AdminCoin symbol={compact(row.coin_symbol)} /></Td>
              <Td>{compact(row.holder_count || 0)}</Td>
              <Td>{compact(row.total_balance || 0)}</Td>
              <Td>{compact(row.total_credited || 0)}</Td>
              <Td>{compact(row.total_debited || 0)}</Td>
              <Td>{compact(row.net_supply || 0)}</Td>
            </tr>
          ))}
        </AdminTable>
      </Panel>

      <Panel title="Reconciliation">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric title="Status" value={reconciliation?.healthy ? "Healthy" : "Review"} tone={reconciliation?.healthy ? "mint" : "danger"} />
          {Object.entries((reconciliation?.counts && typeof reconciliation.counts === "object" ? reconciliation.counts : {}) as Record<string, unknown>).map(([key, value]) => (
            <Metric key={key} title={key.replace(/([A-Z])/g, " $1")} value={compact(value)} tone={Number(value || 0) > 0 ? "danger" : "mint"} />
          ))}
        </div>
        {reconciliation ? <ReconciliationTables data={reconciliation} /> : <p className="mt-4 text-sm text-slate-400">Reconciliation status is loading.</p>}
      </Panel>

      <Panel title="Admin coin balance control">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_160px_160px_minmax(0,1fr)_auto_auto] lg:items-end">
          <label className="space-y-2 text-sm text-slate-400">
            <span>User</span>
            <select className="field" value={userId} onChange={(event) => selectUser(event.target.value)}>
              {users.map((user) => (
                <option key={compact(user.id)} value={String(user.id)}>
                  {compact(user.display_name || user.email || user.mobile_number)} - {compact(user.id)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-400">
            <span>Coin</span>
            <select className="field" value={coinSymbol} onChange={(event) => setCoinSymbol(event.target.value)}>
              {adjustableCoins.map((coin) => <option key={compact(coin.symbol)} value={String(coin.symbol)}>{displayAdminCoinSymbol(compact(coin.symbol))}</option>)}
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-400">
            <span>Amount</span>
            <input className="field" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
          </label>
          <label className="space-y-2 text-sm text-slate-400">
            <span>Note / reason</span>
            <input className="field" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Manual balance adjustment" />
          </label>
          <button className="rounded-2xl bg-mint px-4 py-3 font-semibold text-black disabled:opacity-60" disabled={busy !== ""} onClick={() => adjust("credit")} type="button">{busy === "credit" ? "Saving..." : "Credit"}</button>
          <button className="rounded-2xl bg-danger px-4 py-3 font-semibold text-white disabled:opacity-60" disabled={busy !== ""} onClick={() => adjust("debit")} type="button">{busy === "debit" ? "Saving..." : "Debit"}</button>
        </div>
        {message ? <p className="mt-3 text-sm text-sky-100">{message}</p> : null}
      </Panel>

      <Panel title="Users holding coin balances">
        <AdminTable headers={["User", "Status", "USDT", "BTC", "BNB", "HB9", "PEPE", "DOGE", "SHIBA", "BTTC", "ADA", "Action"]}>
          {users.map((user) => {
            const balances = new Map((Array.isArray(user.balances) ? user.balances as Array<Record<string, unknown>> : []).map((row) => [String(row.coin_symbol), row]));
            return (
              <tr key={compact(user.id)}>
                <Td>{compact(user.display_name || user.email || user.mobile_number)}</Td>
                <Td><Badge value={compact(user.status)} /></Td>
                {["USDT", "BTC", "BNB", "HB9", "PEPE", "DOGE", "SHIB", "BTTC", "ADA"].map((symbol) => <Td key={symbol}><span className="inline-flex items-center gap-1.5"><CoinLogo symbol={symbol} size={18} />{compact(balances.get(symbol)?.balance || 0)}</span></Td>)}
                <Td><button className="rounded-lg bg-[#0b1728]/75 px-2 py-1 text-xs" onClick={() => selectUser(String(user.id))} type="button">View detail</button></Td>
              </tr>
            );
          })}
        </AdminTable>
      </Panel>

      <Panel title="Selected user balances">
        <div className="mb-4 text-sm text-slate-400">
          {selectedUser ? `${compact(selectedUser.display_name || selectedUser.email || selectedUser.mobile_number)} (${compact(selectedUser.id)})` : "No user selected"}
        </div>
        <AdminTable headers={["Coin", "Name", "Balance", "Updated"]}>
          {(Array.isArray(selectedUser?.balances) ? selectedUser.balances as Array<Record<string, unknown>> : []).map((row) => (
            <tr key={compact(row.coin_symbol)}>
              <Td><AdminCoin symbol={compact(row.coin_symbol)} /></Td>
              <Td>{compact(row.coin_name)}</Td>
              <Td>{compact(row.balance || 0)}</Td>
              <Td>{formatDate(row.updated_at)}</Td>
            </tr>
          ))}
        </AdminTable>
      </Panel>

      <Panel title="Selected user coin ledger history">
        <AdminTable headers={["User", "Coin", "Direction", "Type", "Amount", "Reference", "Admin", "Note", "Created"]}>
          {filteredLedger.map((row) => (
            <tr key={compact(row.id)}>
              <Td>{compact(row.email || row.display_name || row.mobile_number || row.user_id)}</Td>
              <Td><AdminCoin symbol={compact(row.coin_symbol)} /></Td>
              <Td><Badge value={compact(row.direction)} /></Td>
              <Td>{compact(row.type)}</Td>
              <Td>{compact(row.amount)}</Td>
              <Td>{compact(row.reference)}</Td>
              <Td>{compact(row.admin_email || row.admin_id)}</Td>
              <Td>{compact(row.note)}</Td>
              <Td>{formatDate(row.created_at)}</Td>
            </tr>
          ))}
        </AdminTable>
      </Panel>

      <Panel title="Latest admin actions">
        <AdminTable headers={["User", "Coin", "Direction", "Amount", "Reference", "Admin", "Note", "Created"]}>
          {latestAdminActions.map((row) => (
            <tr key={compact(row.id)}>
              <Td>{compact(row.email || row.display_name || row.mobile_number || row.user_id)}</Td>
              <Td><AdminCoin symbol={compact(row.coin_symbol)} /></Td>
              <Td><Badge value={compact(row.direction)} /></Td>
              <Td>{compact(row.amount)}</Td>
              <Td>{compact(row.reference)}</Td>
              <Td>{compact(row.admin_id)}</Td>
              <Td>{compact(row.note)}</Td>
              <Td>{formatDate(row.created_at)}</Td>
            </tr>
          ))}
        </AdminTable>
      </Panel>
    </div>
  );
}

function AdminCoin({ symbol }: { symbol: string }) {
  const upper = symbol.toUpperCase();
  const display = displayAdminCoinSymbol(symbol);
  return <span className="inline-flex items-center gap-2"><CoinLogo symbol={upper} size={20} />{display}</span>;
}

function displayAdminCoinSymbol(symbol: string) {
  const upper = symbol.toUpperCase();
  if (upper === "BTCT") return "BTTC";
  if (upper === "SHIB") return "SHIBA";
  return symbol;
}

function ReconciliationTables({ data }: { data: Record<string, unknown> }) {
  const balanceMismatches = Array.isArray(data.balanceMismatches) ? data.balanceMismatches as Array<Record<string, unknown>> : [];
  const negativeBalances = Array.isArray(data.negativeBalances) ? data.negativeBalances as Array<Record<string, unknown>> : [];
  const orphanLedgerEntries = Array.isArray(data.orphanLedgerEntries) ? data.orphanLedgerEntries as Array<Record<string, unknown>> : [];
  const duplicateReferences = Array.isArray(data.duplicateReferences) ? data.duplicateReferences as Array<Record<string, unknown>> : [];
  const usdtSync = Array.isArray(data.usdtSync) ? data.usdtSync as Array<Record<string, unknown>> : [];
  return (
    <div className="mt-4 grid gap-4">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-sky-100">Balance vs ledger mismatches</h3>
        <AdminTable headers={["User", "Coin", "Stored", "Ledger", "Difference"]}>
          {balanceMismatches.map((row, index) => <tr key={`${compact(row.user_id)}-${compact(row.coin_symbol)}-${index}`}><Td>{compact(row.email || row.mobile_number || row.user_id)}</Td><Td><AdminCoin symbol={compact(row.coin_symbol)} /></Td><Td>{compact(row.stored_balance)}</Td><Td>{compact(row.ledger_balance)}</Td><Td>{compact(row.difference)}</Td></tr>)}
        </AdminTable>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-sky-100">USDT sync audit</h3>
        <AdminTable headers={["User", "Coin USDT", "Internal ledger", "Difference"]}>
          {usdtSync.map((row, index) => <tr key={`${compact(row.user_id)}-usdt-${index}`}><Td>{compact(row.email || row.mobile_number || row.user_id)}</Td><Td>{compact(row.usdt_coin_balance)}</Td><Td>{compact(row.internal_ledger_balance)}</Td><Td>{compact(row.difference)}</Td></tr>)}
        </AdminTable>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-sky-100">Negative/orphan/duplicate checks</h3>
        <div className="grid gap-3 xl:grid-cols-3">
          <div className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-3">
            <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Negative balances</div>
            {negativeBalances.slice(0, 5).map((row, index) => <div key={index} className="text-xs text-slate-300">{compact(row.email || row.user_id)} {compact(row.coin_symbol)} {compact(row.balance)}</div>)}
            {negativeBalances.length === 0 ? <div className="text-xs text-mint">None</div> : null}
          </div>
          <div className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-3">
            <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Orphan ledger</div>
            {orphanLedgerEntries.slice(0, 5).map((row, index) => <div key={index} className="text-xs text-slate-300">{compact(row.id)} {compact(row.coin_symbol)} {compact(row.amount)}</div>)}
            {orphanLedgerEntries.length === 0 ? <div className="text-xs text-mint">None</div> : null}
          </div>
          <div className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-3">
            <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Duplicate references</div>
            {duplicateReferences.slice(0, 5).map((row, index) => <div key={index} className="text-xs text-slate-300">{compact(row.reference)} x{compact(row.duplicate_count)}</div>)}
            {duplicateReferences.length === 0 ? <div className="text-xs text-mint">None</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function HbTransparency({ data }: { data: Record<string, unknown> }) {
  const items = Array.isArray(data.items) ? data.items as Array<Record<string, unknown>> : [];
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric title="Total proofs" value={compact(data.totalProofs || items.length)} tone="mint" />
        <Metric title="Proof integrity" value={`${Number(data.integrityPercent ?? 100).toFixed(2)}%`} tone={Number(data.integrityPercent ?? 100) === 100 ? "mint" : "danger"} />
        <Metric title="Broken chain count" value={compact(data.brokenProofCount || 0)} tone={Number(data.brokenProofCount || 0) > 0 ? "danger" : "mint"} />
        <Metric title="Unproved ledger entries" value={compact(data.unprovedLedgerEntries || 0)} tone={Number(data.unprovedLedgerEntries || 0) > 0 ? "accent" : "mint"} />
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        <IntegrityList title="Broken chains" rows={Array.isArray(data.brokenChains) ? data.brokenChains as Array<Record<string, unknown>> : []} />
        <IntegrityList title="Missing references" rows={Array.isArray(data.missingReferences) ? data.missingReferences as Array<Record<string, unknown>> : []} />
        <IntegrityList title="Duplicate hashes" rows={Array.isArray(data.duplicateHashes) ? data.duplicateHashes as Array<Record<string, unknown>> : []} />
      </div>
      <Panel title="Financial action timeline">
        <AdminTable headers={["Reference", "Type", "Masked user", "Amount", "Status", "Proof hash", "Previous", "On-chain", "Created"]}>
          {items.map((row) => (
            <tr key={compact(row.public_reference_id)}>
              <Td>{compact(row.public_reference_id)}</Td>
              <Td>{compact(row.proof_type)}</Td>
              <Td>{compact(row.masked_user_id)}</Td>
              <Td>{money(row.amount_usd)}</Td>
              <Td><Badge value={compact(row.status || row.onchain_status || "recorded")} /></Td>
              <Td>{compact(row.proof_hash).slice(0, 18)}</Td>
              <Td>{compact(row.previous_proof_hash).slice(0, 18)}</Td>
              <Td>{compact(row.chain_tx_hash || row.onchain_status)}</Td>
              <Td>{formatDate(row.created_at)}</Td>
            </tr>
          ))}
        </AdminTable>
      </Panel>
    </div>
  );
}

function IntegrityList({ title, rows }: { title: string; rows: Array<Record<string, unknown>> }) {
  return (
    <div className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-3">
      <div className="mb-2 text-xs font-semibold uppercase text-slate-500">{title}</div>
      {rows.length === 0 ? <div className="text-xs text-mint">None</div> : rows.slice(0, 6).map((row, index) => (
        <div key={`${title}-${index}`} className="break-all text-xs text-slate-300">{Object.values(row).map(compact).join(" - ")}</div>
      ))}
    </div>
  );
}

function HbTreasury({ data, token }: { data: Record<string, unknown>; token: string }) {
  const items = Array.isArray(data.items) ? data.items as Array<Record<string, unknown>> : [];
  const health = (data.health && typeof data.health === "object" ? data.health : {}) as Record<string, unknown>;
  const live = (health.live && typeof health.live === "object" ? health.live : {}) as Record<string, unknown>;
  const recentDeposits = Array.isArray(health.recentDeposits) ? health.recentDeposits as Array<Record<string, unknown>> : [];
  const recentWithdrawals = Array.isArray(health.recentWithdrawals) ? health.recentWithdrawals as Array<Record<string, unknown>> : [];
  const failedWithdrawals = Array.isArray(health.failedWithdrawals) ? health.failedWithdrawals as Array<Record<string, unknown>> : [];
  const explorerBaseUrl = String(health.explorerBaseUrl || "https://bscscan.com");
  const fields = [
    ["treasuryUsdtBep20Address", "treasury_usdt_bep20_address"],
    ["payoutWalletAddress", "payout_wallet_address"],
    ["companyReserveWallet", "company_reserve_wallet"]
  ] as const;

  async function update(settingKey: string, label: string) {
    const next = window.prompt(`Set ${label}. Leave blank to clear.`);
    if (next === null) return;
    if (!window.confirm("Mainnet safe mode requires explicit confirmation for treasury updates.")) return;
    await adminRequest("/admin/hb/treasury-settings", token, {
      method: "PATCH",
      body: JSON.stringify({ [settingKey]: next.trim(), safetyConfirmation: "CONFIRM_MAINNET_SAFE_ACTION" })
    });
    window.location.reload();
  }

  return (
    <div className="grid gap-4">
      <TreasuryHealthPanel health={health} />
      <Panel title="Live Treasury Balances">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="USDT balance" value={compact(live.usdtBalance || "0")} tone="mint" />
          <Metric title="Deposit USDT" value={compact(live.depositUsdtBalance || "0")} />
          <Metric title="BNB gas balance" value={compact(live.bnbGasBalance || "0")} tone={Number(live.bnbGasBalance || 0) > 0 ? "mint" : "danger"} />
          <Metric title="RPC health" value={compact(live.rpcStatus || "not checked")} tone={live.rpcStatus === "healthy" ? "mint" : "danger"} />
        </div>
      </Panel>
      <Panel title="HB9 Treasury">
        <p className="mb-4 text-sm text-slate-400">Treasury wallet settings store public addresses only. Private keys and seed phrases must never be stored here.</p>
        <AdminTable headers={["Setting", "Address", "Network", "Chain", "Explorer", "Updated by", "Updated", "Actions"]}>
          {items.map((row) => {
            const field = fields.find(([, key]) => key === row.key);
            return (
              <tr key={compact(row.key)}>
                <Td>{compact(row.label)}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <span className="break-all">{compact(row.wallet_address)}</span>
                    {row.wallet_address ? <button className="rounded-lg bg-[#0b1728]/75 px-2 py-1 text-xs" onClick={() => navigator.clipboard?.writeText(String(row.wallet_address))} type="button">Copy</button> : null}
                  </div>
                </Td>
                <Td>{compact(row.network)}</Td>
                <Td>{compact(row.chain_id)}</Td>
                <Td><ExplorerButton baseUrl={explorerBaseUrl} type="wallet" value={String(row.wallet_address || "")} compact /></Td>
                <Td>{compact(row.updated_by)}</Td>
                <Td>{formatDate(row.updated_at)}</Td>
                <Td>{field ? <button className="rounded-lg bg-[#0b1728]/75 px-2 py-1 text-xs" onClick={() => update(field[0], compact(row.label))} type="button">Edit</button> : null}</Td>
              </tr>
            );
          })}
        </AdminTable>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Recent Deposits">
          <AdminTable headers={["Amount", "Tx", "Status", "Created"]}>
            {recentDeposits.map((row) => <tr key={compact(row.id)}><Td>{money(row.usd_amount)}</Td><Td><ExplorerButton baseUrl={explorerBaseUrl} type="tx" value={String(row.tx_hash || "")} compact /></Td><Td><Badge value={compact(row.status)} /></Td><Td>{formatDate(row.created_at)}</Td></tr>)}
          </AdminTable>
        </Panel>
        <Panel title="Recent Withdrawals">
          <AdminTable headers={["Gross", "Fee", "Net", "Tx", "Status"]}>
            {recentWithdrawals.map((row) => <tr key={compact(row.id)}><Td>{money(row.gross_amount || row.amount_usd)}</Td><Td>{money(row.fee_amount || row.fee_usd)}</Td><Td>{money(row.net_amount || row.payout_amount_usd)}</Td><Td><ExplorerButton baseUrl={explorerBaseUrl} type="tx" value={String(row.tx_hash || "")} compact /></Td><Td><Badge value={compact(row.status)} /></Td></tr>)}
          </AdminTable>
        </Panel>
        <Panel title="Failed Withdrawals">
          <AdminTable headers={["Gross", "Tx", "Reason", "Updated"]}>
            {failedWithdrawals.map((row) => <tr key={compact(row.id)}><Td>{money(row.gross_amount)}</Td><Td><ExplorerButton baseUrl={explorerBaseUrl} type="tx" value={String(row.tx_hash || "")} compact /></Td><Td>{compact(row.failure_reason)}</Td><Td>{formatDate(row.updated_at)}</Td></tr>)}
          </AdminTable>
        </Panel>
      </div>
    </div>
  );
}

function HbProductsAdmin({ rows, token, onToggleActive }: { rows: Array<Record<string, unknown>>; token: string; onToggleActive: (row: Record<string, unknown>) => Promise<void> }) {
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function upload(row: Record<string, unknown>, file: File | undefined, gallery = false) {
    if (!file) return;
    setBusyId(String(row.id));
    setError("");
    try {
      const form = new FormData();
      form.append("image", file);
      await adminRequest(`/admin/hb/products/${row.id}/image${gallery ? "?gallery=true" : ""}`, token, {
        method: "POST",
        body: form
      });
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Product image upload failed.");
    } finally {
      setBusyId("");
    }
  }

  async function remove(row: Record<string, unknown>) {
    setBusyId(String(row.id));
    setError("");
    try {
      await adminRequest(`/admin/hb/products/${row.id}/image`, token, { method: "DELETE" });
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Product image remove failed.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <Panel title="HB9 products">
      <div className="mb-4 rounded-2xl border border-white/10 bg-[#0b1728]/60 p-3 text-sm text-slate-300">
        Upload JPG, JPEG, PNG, or WEBP product images up to 5MB. SVG and executable files are rejected.
      </div>
      {error ? <p className="mb-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-red-100">{error}</p> : null}
      <AdminTable headers={["Product", "Slug", "Package", "Price", "Stock", "Featured", "Active", "Image", "Gallery", "Updated", "Actions"]}>
        {rows.map((row) => {
          const imageUrl = compact(row.thumbnail_url || row.image_url);
          const hasImage = imageUrl !== "-";
          const gallery = Array.isArray(row.gallery) ? row.gallery as Array<Record<string, unknown>> : [];
          const busy = busyId === String(row.id);
          return (
            <tr key={compact(row.id)}>
              <Td>{compact(row.title)}</Td>
              <Td>{compact(row.slug)}</Td>
              <Td>{compact(row.package_name)}</Td>
              <Td>{money(row.package_price)}</Td>
              <Td>{compact(row.stock)}</Td>
              <Td>{compact(row.featured)}</Td>
              <Td><Badge value={row.active ? "active" : "inactive"} /></Td>
              <Td>
                <div className="flex min-w-[180px] items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#0b1728]/70">
                    {hasImage ? <img className="h-full w-full object-cover" src={imageUrl} alt="" /> : <ImageIcon className="text-slate-500" size={20} />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-xs text-slate-400">{imageUrl}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-accent px-2 py-1 text-xs font-semibold text-black">
                        <Upload size={13} /> {hasImage ? "Replace" : "Upload"}
                        <input className="hidden" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => upload(row, event.target.files?.[0])} />
                      </label>
                      {hasImage ? (
                        <button className="inline-flex items-center gap-1 rounded-lg bg-[#0b1728]/75 px-2 py-1 text-xs text-slate-200 disabled:opacity-60" onClick={() => remove(row)} disabled={busy} type="button">
                          <Trash2 size={13} /> Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Td>
              <Td>
                <div className="min-w-[150px]">
                  <div className="mb-2 flex -space-x-2">
                    {gallery.slice(0, 3).map((item) => (
                      <img key={compact(item.id)} className="h-8 w-8 rounded-lg border border-[#0b1018] object-cover" src={compact(item.image_url)} alt="" />
                    ))}
                    {gallery.length === 0 ? <span className="text-xs text-slate-500">No gallery</span> : null}
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#0b1728]/75 px-2 py-1 text-xs text-slate-200">
                    <Upload size={13} /> Add gallery
                    <input className="hidden" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => upload(row, event.target.files?.[0], true)} />
                  </label>
                </div>
              </Td>
              <Td>{formatDate(row.updated_at)}</Td>
              <Td><button className="rounded-lg bg-[#0b1728]/75 px-2 py-1 text-xs disabled:opacity-60" onClick={() => onToggleActive(row)} disabled={busy} type="button">{row.active ? "Disable" : "Enable"}</button></Td>
            </tr>
          );
        })}
      </AdminTable>
    </Panel>
  );
}

function HbTable({ title, rows, headers, fields, moneyFields = [], dateFields = [] }: { title: string; rows: Array<Record<string, unknown>>; headers: string[]; fields: string[]; moneyFields?: string[]; dateFields?: string[] }) {
  return (
    <Panel title={title}>
      <AdminTable headers={headers}>
        {rows.map((row, index) => (
          <tr key={`${compact(row.id)}-${index}`}>
            {fields.map((field) => <Td key={field}>{moneyFields.includes(field) ? money(row[field]) : dateFields.includes(field) ? formatDate(row[field]) : field === "status" || field.includes("status") ? <Badge value={compact(row[field])} /> : compact(row[field])}</Td>)}
          </tr>
        ))}
      </AdminTable>
    </Panel>
  );
}

function HbReports({ data }: { data: Record<string, unknown> }) {
  const sections = [
    ["Daily sales", data.dailySales],
    ["Package-wise sales", data.packageSales],
    ["Income distribution", data.incomeDistribution],
    ["Deposit summary", data.depositSummary],
    ["Active user growth", data.activeGrowth],
    ["Company reserve", data.companyReserve]
  ] as const;
  return (
    <div className="grid gap-4">
      {sections.map(([title, value]) => {
        const rows = Array.isArray(value) ? value as Array<Record<string, unknown>> : [];
        const headers = rows[0] ? Object.keys(rows[0]) : ["No data"];
        return (
          <Panel key={title} title={title}>
            {rows.length === 0 ? <p className="text-sm text-slate-400">No records found.</p> : (
              <AdminTable headers={headers}>
                {rows.map((row, index) => <tr key={`${title}-${index}`}>{headers.map((header) => <Td key={header}>{header.includes("amount") || header.includes("total") || header.includes("volume") ? money(row[header]) : compact(row[header])}</Td>)}</tr>)}
              </AdminTable>
            )}
          </Panel>
        );
      })}
    </div>
  );
}

function RechargeOrders({ rows }: { rows: RechargeOrderRow[] }) {
  return (
    <Panel title="Recharge order management">
      <AdminTable headers={["Order", "Wallet", "Country", "Operator", "Phone", "Local", "Crypto", "Network", "Tx", "Provider", "Status", "Refund", "Created", "Actions"]}>
        {rows.map((row) => (
          <tr key={compact(row.id)}>
            <Td>{compact(row.id)}</Td><Td>{compact(row.user_wallet_address)}</Td><Td>{compact(row.country_code)}</Td><Td>{compact(row.operator_name)}</Td><Td>{compact(row.phone_number)}</Td><Td>{compact(row.local_currency)} {compact(row.local_amount)}</Td><Td>{compact(row.crypto_amount)} {compact(row.crypto_symbol)}</Td><Td>{compact(row.network)}</Td><Td>{compact(row.tx_hash)}</Td><Td>{compact(row.provider)}</Td><Td><Badge value={compact(row.status)} /></Td><Td><Badge value={compact(row.refund_status)} /></Td><Td>{formatDate(row.created_at)}</Td>
            <Td><ActionButtons actions={["View", "Retry", "Fail", "Refund", "Note"]} /></Td>
          </tr>
        ))}
      </AdminTable>
    </Panel>
  );
}

function PaymentOrders({ rows }: { rows: PaymentOrderRow[] }) {
  return (
    <Panel title="Payment order management">
      <AdminTable headers={["Payment", "Wallet", "Merchant", "Category", "Crypto", "Network", "Tx", "Status", "Created", "Actions"]}>
        {rows.map((row) => (
          <tr key={compact(row.id)}>
            <Td>{compact(row.id)}</Td><Td>{compact(row.wallet_address)}</Td><Td>{compact(row.merchant_name)}</Td><Td>{compact(row.category)}</Td><Td>{compact(row.amount)} {compact(row.asset)}</Td><Td>BSC</Td><Td>{compact(row.tx_hash)}</Td><Td><Badge value={compact(row.status)} /></Td><Td>{formatDate(row.created_at)}</Td>
            <Td><ActionButtons actions={["View", "Update", "Note"]} /></Td>
          </tr>
        ))}
      </AdminTable>
    </Panel>
  );
}

function UsersPage({ rows }: { rows: UserRow[] }) {
  return (
    <Panel title="Wallet-based user activity">
      <AdminTable headers={["Wallet", "Local indicator", "First seen", "Last activity", "Recharge count", "Payment count", "Total volume"]}>
        {rows.map((row) => <tr key={compact(row.wallet_address)}><Td>{compact(row.wallet_address)}</Td><Td>{row.local_wallet_only ? "business account" : "-"}</Td><Td>{formatDate(row.first_seen)}</Td><Td>{formatDate(row.last_activity)}</Td><Td>{compact(row.recharge_count || 0)}</Td><Td>{compact(row.payment_count || 0)}</Td><Td>{money(row.total_volume)}</Td></tr>)}
      </AdminTable>
    </Panel>
  );
}

function ProviderSettings({ data, token }: { data: ProviderSettingsData | null; token: string }) {
  const providers = data?.providers || [];
  const [selectedProvider, setSelectedProvider] = useState(data?.activeProvider || "reloadly");

  useEffect(() => {
    setSelectedProvider(data?.activeProvider || "reloadly");
  }, [data?.activeProvider]);

  async function testProvider() {
    await adminRequest("/admin/provider-settings/test", token, {
      method: "POST",
      body: JSON.stringify({ provider: selectedProvider })
    });
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {providers.map((provider) => <Metric key={provider.provider} title={provider.provider} value={provider.status || (provider.configured ? "configured" : "missing")} tone={provider.configured ? "mint" : "accent"} />)}
      </div>
      <Panel title="Provider controls">
        <div className="grid gap-3 md:grid-cols-3">
          <select className="field" value={selectedProvider} onChange={(event) => setSelectedProvider(event.target.value)}>
            {providers.map((provider) => <option key={provider.provider} value={provider.provider}>{provider.provider}</option>)}
          </select>
          <input className="field" readOnly value={data?.webhookUrl || "/api/recharge/webhook"} />
          <button className="rounded-2xl bg-accent px-4 py-3 font-semibold text-black" type="button" onClick={testProvider}>Test connection</button>
        </div>
      </Panel>
    </div>
  );
}

function FeesPage({ data, token }: { data: FeesData | null; token: string }) {
  const [draft, setDraft] = useState({
    rechargePlatformFeePercent: "1.8",
    fixedFee: "0",
    minimumFee: "0.15",
    qrPayFeePercent: "0.5",
    refundFee: "0",
    supportedCryptoSymbols: "BNB,USDT"
  });

  useEffect(() => {
    setDraft({
      rechargePlatformFeePercent: compact(data?.rechargePlatformFeePercent ?? data?.recharge_platform_fee_percent ?? "1.8"),
      fixedFee: compact(data?.fixedFee ?? data?.fixed_fee ?? "0"),
      minimumFee: compact(data?.minimumFee ?? data?.minimum_fee ?? "0.15"),
      qrPayFeePercent: compact(data?.qrPayFeePercent ?? data?.qr_pay_fee_percent ?? "0.5"),
      refundFee: compact(data?.refundFee ?? data?.refund_fee ?? "0"),
      supportedCryptoSymbols: (data?.supportedCryptoSymbols || data?.supported_crypto_symbols || ["BNB", "USDT"]).join(",")
    });
  }, [data]);

  function setField(field: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function saveFees() {
    await adminRequest("/admin/fees", token, {
      method: "POST",
      body: JSON.stringify({
        rechargePlatformFeePercent: Number(draft.rechargePlatformFeePercent),
        fixedFee: Number(draft.fixedFee),
        minimumFee: Number(draft.minimumFee),
        qrPayFeePercent: Number(draft.qrPayFeePercent),
        refundFee: Number(draft.refundFee),
        supportedCryptoSymbols: draft.supportedCryptoSymbols.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean)
      })
    });
  }

  const values = [
    ["Recharge platform fee %", "rechargePlatformFeePercent"],
    ["Fixed fee", "fixedFee"],
    ["Minimum fee", "minimumFee"],
    ["QR pay fee %", "qrPayFeePercent"],
    ["Refund fee", "refundFee"],
    ["Supported crypto symbols", "supportedCryptoSymbols"]
  ] as const;

  return (
    <Panel title="Fee settings">
      <div className="grid gap-3 md:grid-cols-2">
        {values.map(([label, field]) => (
          <label key={label} className="space-y-2 text-sm text-slate-400">
            <span>{label}</span>
            <input className="field" value={draft[field]} onChange={(event) => setField(field, event.target.value)} />
          </label>
        ))}
      </div>
      <button className="mt-4 rounded-2xl bg-accent px-4 py-3 font-semibold text-black" type="button" onClick={saveFees}>Save fees</button>
    </Panel>
  );
}

function AuditLogs({ rows, query, compact: compactRows = false }: { rows: AuditLogRow[]; query: string; compact?: boolean }) {
  const filtered = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));
  return (
    <AdminTable headers={compactRows ? ["Action", "Actor", "Entity", "Created"] : ["Action", "Actor", "Entity type", "Entity ID", "IP/User agent", "Metadata", "Created"]}>
      {filtered.map((row, index) => compactRows ? (
        <tr key={`${row.action}-${row.created_at}-${index}`}><Td>{compact(row.action)}</Td><Td>{compact(row.actor_wallet_address)}</Td><Td>{compact(row.entity_type)}</Td><Td>{formatDate(row.created_at)}</Td></tr>
      ) : (
        <tr key={`${row.action}-${row.created_at}-${index}`}><Td>{compact(row.action)}</Td><Td>{compact(row.actor_wallet_address)}</Td><Td>{compact(row.entity_type)}</Td><Td>{compact(row.entity_id)}</Td><Td>-</Td><Td>{typeof row.metadata === "string" ? row.metadata : JSON.stringify(row.metadata || {})}</Td><Td>{formatDate(row.created_at)}</Td></tr>
      ))}
    </AdminTable>
  );
}

function SettingsPage() {
  return (
    <div className="grid gap-4">
      <Panel title="Admin security">
        <div className="grid gap-3 text-sm text-slate-300">
          <div className="settings-row"><Shield size={18} /> JWT/session auth enabled</div>
          <div className="settings-row"><Activity size={18} /> Admin actions audit logged</div>
          <div className="settings-row"><RefreshCcw size={18} /> Role-ready: super_admin, support_admin</div>
        </div>
      </Panel>
    </div>
  );
}

function AdminLoadingState() {
  return (
    <div className="grid gap-4" aria-label="Admin data loading">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => <div key={index} className="shimmer-card h-24 rounded-2xl border border-sky-200/10" />)}
      </div>
      <section className="rounded-[1.35rem] border border-sky-200/15 bg-[#0b1728]/75 p-4 shadow-wallet backdrop-blur-xl">
        <div className="shimmer-card mb-4 h-5 w-48 rounded-xl" />
        <div className="space-y-2">
          {Array.from({ length: 5 }, (_, index) => <div key={index} className="shimmer-card h-12 rounded-xl" />)}
        </div>
      </section>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="premium-surface rounded-[1.2rem] p-4 sm:rounded-[1.35rem]"><h2 className="mb-4 text-lg font-semibold">{title}</h2>{children}</section>;
}

function Metric({ title, value, tone = "slate" }: { title: string; value: string; tone?: "slate" | "mint" | "danger" | "accent" }) {
  const color = tone === "mint" ? "text-mint" : tone === "danger" ? "text-danger" : tone === "accent" ? "text-accent" : "text-white";
  return <div className={`premium-surface rounded-2xl p-4 ${tone === "mint" ? "treasury-glow" : ""}`}><div className="text-xs text-sky-200/60">{title}</div><div className={`mt-2 break-words text-xl font-semibold sm:text-2xl ${color}`}>{value}</div></div>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-col gap-1 rounded-xl border border-sky-200/10 bg-[#0b1728]/60 p-3 sm:flex-row sm:items-center sm:justify-between"><span className="text-slate-500">{label}</span><span className="break-all font-mono text-slate-100">{value}</span></div>;
}

function AdminTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:thin]" role="region" aria-label="Scrollable admin table">
      <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-left text-sm lg:min-w-[900px]">
        <thead><tr>{headers.map((header) => <th key={header} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="max-w-[18rem] break-words border-y border-sky-200/10 bg-[#0b1728]/70 px-3 py-3 align-top first:rounded-l-xl first:border-l last:rounded-r-xl last:border-r">{children}</td>;
}

function Badge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const good = ["success", "none", "ready", "active", "verified", "confirmed", "indexed", "healthy"].includes(normalized);
  const bad = normalized.includes("failed") || normalized.includes("refund") || normalized.includes("risk") || normalized.includes("warning") || normalized.includes("suspended");
  const tone = good ? "status-pill-success" : bad ? "status-pill-risk" : normalized.includes("pending") ? "status-pill-warning" : "";
  return <span className={`status-pill ${tone}`}>{value}</span>;
}

function RequestAdminActions({ row, onPatch }: { row: Record<string, unknown>; onPatch: (status: string, adminNote: string) => void }) {
  const status = String(row.status || "");
  const note = () => window.prompt("Admin note") || "";
  return (
    <div className="flex flex-wrap gap-1">
      {status === "pending" ? <button className="rounded-lg bg-[#0b1728]/75 px-2 py-1 text-xs" onClick={() => onPatch("processing", note() || "Processing request")} type="button">Processing</button> : null}
      {status === "pending" || status === "processing" ? <button className="rounded-lg bg-mint/20 px-2 py-1 text-xs text-mint" onClick={() => onPatch("completed", note() || "Completed")} type="button">Complete</button> : null}
      {status !== "completed" ? <button className="rounded-lg bg-danger/20 px-2 py-1 text-xs text-red-100" onClick={() => onPatch("rejected", note() || "Rejected")} type="button">Reject</button> : null}
    </div>
  );
}

function ActionButtons({ actions }: { actions: string[] }) {
  return <div className="flex flex-wrap gap-1">{actions.map((action) => <button key={action} className="tap-feedback rounded-lg bg-[#0b1728]/75 px-2 py-1 text-xs text-slate-200" type="button">{action}</button>)}</div>;
}
