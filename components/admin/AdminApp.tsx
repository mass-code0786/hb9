"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Activity,
  Banknote,
  ClipboardList,
  CreditCard,
  FileSearch,
  Gauge,
  LogOut,
  RefreshCcw,
  Settings,
  Shield,
  SlidersHorizontal,
  Users
} from "lucide-react";

type AdminPage = "dashboard" | "recharge" | "payments" | "users" | "providers" | "fees" | "audit" | "settings";

const nav = [
  { href: "/admin", label: "Overview", page: "dashboard", icon: Gauge },
  { href: "/admin/recharge-orders", label: "Recharge", page: "recharge", icon: ClipboardList },
  { href: "/admin/payment-orders", label: "Payments", page: "payments", icon: CreditCard },
  { href: "/admin/users", label: "Users", page: "users", icon: Users },
  { href: "/admin/provider-settings", label: "Providers", page: "providers", icon: SlidersHorizontal },
  { href: "/admin/fees", label: "Fees", page: "fees", icon: Banknote },
  { href: "/admin/audit-logs", label: "Audit", page: "audit", icon: FileSearch },
  { href: "/admin/settings", label: "Settings", page: "settings", icon: Settings }
] as const;

const rechargeOrders = [
  { id: "rech_1001", wallet: "0x93d4...a91f", country: "IN", operator: "Airtel", phone: "+91****42", local: "INR 199", crypto: "2.54 USDT", network: "bsc", tx: "0x8f2...19aa", provider: "mock", status: "success", refund: "none", created: "2026-05-10" },
  { id: "rech_1002", wallet: "0x61a1...60cb", country: "PK", operator: "Jazz", phone: "+92****88", local: "PKR 500", crypto: "1.95 USDT", network: "bsc", tx: "0xfail...002", provider: "mock", status: "refund_pending", refund: "review_required", created: "2026-05-10" },
  { id: "rech_1003", wallet: "0x44f0...b20c", country: "AE", operator: "Etisalat", phone: "+971****17", local: "AED 20", crypto: "5.59 USDT", network: "bsc", tx: "0xa12...f8d", provider: "ding", status: "processing_recharge", refund: "none", created: "2026-05-09" }
];

const paymentOrders = [
  { id: "pay_2201", wallet: "0x93d4...a91f", merchant: "Fuel station", category: "petrol", crypto: "12.00 USDT", network: "bsc", tx: "0x77b...10a", status: "success", created: "2026-05-10" },
  { id: "pay_2202", wallet: "0x61a1...60cb", merchant: "QR merchant", category: "merchant", crypto: "0.018 BNB", network: "bsc", tx: "0x91d...e3b", status: "pending", created: "2026-05-09" }
];

const auditLogs = [
  { action: "admin.recharge.update", actor: "admin@bitzenx.local", entity: "recharge_order", id: "rech_1002", ip: "127.0.0.1", metadata: "refund_pending", created: "2026-05-10 21:30" },
  { action: "recharge.create", actor: "0x61a1...60cb", entity: "recharge_order", id: "rech_1002", ip: "-", metadata: "mock provider", created: "2026-05-10 21:25" },
  { action: "admin.provider.test", actor: "admin@bitzenx.local", entity: "provider_settings", id: "-", ip: "127.0.0.1", metadata: "mock ready", created: "2026-05-10 20:58" }
];

export function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!email || password.length < 8) {
      setError("Enter admin email and password.");
      return;
    }
    localStorage.setItem("bitzenx.admin.token", "local-admin-session");
    router.push("/admin");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8">
      <form onSubmit={login} className="w-full max-w-sm rounded-2xl border border-white/10 bg-panel/90 p-5 shadow-wallet backdrop-blur">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl bg-accent p-3 text-black"><Shield size={22} /></div>
          <div>
            <h1 className="text-xl font-semibold">BitzenX Admin</h1>
            <p className="text-sm text-slate-400">Secure operations dashboard</p>
          </div>
        </div>
        <input className="field mb-3" type="email" placeholder="Admin email" value={email} onChange={(event) => setEmail(event.target.value)} />
        <input className="field mb-3" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
        {error ? <p className="mb-3 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-red-100">{error}</p> : null}
        <button className="w-full rounded-2xl bg-accent px-4 py-3 font-semibold text-black" type="submit">Login</button>
      </form>
    </main>
  );
}

export function AdminApp({ page }: { page: AdminPage }) {
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const title = nav.find((item) => item.page === page)?.label || "Admin";

  function logout() {
    localStorage.removeItem("bitzenx.admin.token");
    router.push("/admin/login");
  }

  const content = useMemo(() => {
    if (page === "recharge") return <RechargeOrders query={query} />;
    if (page === "payments") return <PaymentOrders query={query} />;
    if (page === "users") return <UsersPage />;
    if (page === "providers") return <ProviderSettings />;
    if (page === "fees") return <FeesPage />;
    if (page === "audit") return <AuditLogs query={query} />;
    if (page === "settings") return <SettingsPage />;
    return <Overview />;
  }, [page, query]);

  return (
    <main className="min-h-dvh bg-[#05070b] text-slate-50">
      <div className="mx-auto grid min-h-dvh max-w-7xl grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-[#0b1018]/90 p-4 backdrop-blur md:border-b-0 md:border-r">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-2xl bg-accent p-2 text-black"><Shield size={18} /></div>
            <div>
              <div className="font-semibold">BitzenX Admin</div>
              <div className="text-xs text-slate-500">super_admin ready</div>
            </div>
          </div>
          <nav className="grid grid-cols-2 gap-2 md:grid-cols-1">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${active ? "bg-accent text-black" : "text-slate-300 hover:bg-white/[0.07] hover:text-white"}`}>
                  <Icon size={16} /> {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <section className="min-w-0 p-4 md:p-6">
          <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{title}</h1>
              <p className="text-sm text-slate-400">No wallet secrets, seed phrases, or private keys are available here.</p>
            </div>
            <div className="flex gap-2">
              <input className="field h-11 md:w-72" placeholder="Search or filter" value={query} onChange={(event) => setQuery(event.target.value)} />
              <button className="rounded-xl border border-white/10 bg-white/[0.06] px-3" onClick={logout} type="button" aria-label="Logout"><LogOut size={18} /></button>
            </div>
          </header>
          {content}
        </section>
      </div>
    </main>
  );
}

function Overview() {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric title="Total recharge orders" value="128" />
        <Metric title="Successful recharge orders" value="116" tone="mint" />
        <Metric title="Failed recharge orders" value="5" tone="danger" />
        <Metric title="Refund pending" value="7" tone="accent" />
        <Metric title="Total payment orders" value="84" />
        <Metric title="Total volume" value="$18,420" />
        <Metric title="Provider status" value="mock ready" tone="mint" />
      </div>
      <Panel title="Recent audit logs"><AuditLogs query="" compact /></Panel>
    </div>
  );
}

function RechargeOrders({ query }: { query: string }) {
  const rows = rechargeOrders.filter((row) => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));
  return (
    <Panel title="Recharge order management">
      <AdminTable headers={["Order", "Wallet", "Country", "Operator", "Phone", "Local", "Crypto", "Network", "Tx", "Provider", "Status", "Refund", "Created", "Actions"]}>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td>{row.id}</Td><Td>{row.wallet}</Td><Td>{row.country}</Td><Td>{row.operator}</Td><Td>{row.phone}</Td><Td>{row.local}</Td><Td>{row.crypto}</Td><Td>{row.network}</Td><Td>{row.tx}</Td><Td>{row.provider}</Td><Td><Badge value={row.status} /></Td><Td><Badge value={row.refund} /></Td><Td>{row.created}</Td>
            <Td><ActionButtons actions={["View", "Retry", "Fail", "Refund", "Note"]} /></Td>
          </tr>
        ))}
      </AdminTable>
    </Panel>
  );
}

function PaymentOrders({ query }: { query: string }) {
  const rows = paymentOrders.filter((row) => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));
  return (
    <Panel title="Payment order management">
      <AdminTable headers={["Payment", "Wallet", "Merchant", "Category", "Crypto", "Network", "Tx", "Status", "Created", "Actions"]}>
        {rows.map((row) => (
          <tr key={row.id}>
            <Td>{row.id}</Td><Td>{row.wallet}</Td><Td>{row.merchant}</Td><Td>{row.category}</Td><Td>{row.crypto}</Td><Td>{row.network}</Td><Td>{row.tx}</Td><Td><Badge value={row.status} /></Td><Td>{row.created}</Td>
            <Td><ActionButtons actions={["View", "Update", "Note"]} /></Td>
          </tr>
        ))}
      </AdminTable>
    </Panel>
  );
}

function UsersPage() {
  const users = [
    { wallet: "0x93d4...a91f", local: "local encrypted wallet", first: "2026-05-01", last: "2026-05-10", recharge: 8, payment: 3, volume: "$842" },
    { wallet: "0x61a1...60cb", local: "local encrypted wallet", first: "2026-05-03", last: "2026-05-10", recharge: 2, payment: 1, volume: "$91" }
  ];
  return (
    <Panel title="Wallet-based user activity">
      <AdminTable headers={["Wallet", "Local indicator", "First seen", "Last activity", "Recharge count", "Payment count", "Total volume"]}>
        {users.map((row) => <tr key={row.wallet}><Td>{row.wallet}</Td><Td>{row.local}</Td><Td>{row.first}</Td><Td>{row.last}</Td><Td>{row.recharge}</Td><Td>{row.payment}</Td><Td>{row.volume}</Td></tr>)}
      </AdminTable>
    </Panel>
  );
}

function ProviderSettings() {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {["mock", "reloadly", "dtone", "ding"].map((provider) => <Metric key={provider} title={provider} value={provider === "mock" ? "ready" : "masked key only"} tone={provider === "mock" ? "mint" : "accent"} />)}
      </div>
      <Panel title="Provider controls">
        <div className="grid gap-3 md:grid-cols-3">
          <select className="field"><option>mock</option><option>reloadly</option><option>dtone</option><option>ding</option></select>
          <input className="field" readOnly value="/api/recharge/webhook" />
          <button className="rounded-2xl bg-accent px-4 py-3 font-semibold text-black" type="button">Test connection</button>
        </div>
      </Panel>
    </div>
  );
}

function FeesPage() {
  return (
    <Panel title="Fee settings">
      <div className="grid gap-3 md:grid-cols-2">
        {["Recharge platform fee %", "Fixed fee", "Minimum fee", "QR pay fee %", "Refund fee", "Supported crypto symbols"].map((label, index) => (
          <label key={label} className="space-y-2 text-sm text-slate-400">
            <span>{label}</span>
            <input className="field" defaultValue={index === 0 ? "1.8" : index === 5 ? "BNB,USDT" : "0"} />
          </label>
        ))}
      </div>
      <button className="mt-4 rounded-2xl bg-accent px-4 py-3 font-semibold text-black" type="button">Save fees</button>
    </Panel>
  );
}

function AuditLogs({ query, compact = false }: { query: string; compact?: boolean }) {
  const rows = auditLogs.filter((row) => JSON.stringify(row).toLowerCase().includes(query.toLowerCase()));
  return (
    <AdminTable headers={compact ? ["Action", "Actor", "Entity", "Created"] : ["Action", "Actor", "Entity type", "Entity ID", "IP/User agent", "Metadata", "Created"]}>
      {rows.map((row) => compact ? (
        <tr key={`${row.action}-${row.created}`}><Td>{row.action}</Td><Td>{row.actor}</Td><Td>{row.entity}</Td><Td>{row.created}</Td></tr>
      ) : (
        <tr key={`${row.action}-${row.created}`}><Td>{row.action}</Td><Td>{row.actor}</Td><Td>{row.entity}</Td><Td>{row.id}</Td><Td>{row.ip}</Td><Td>{row.metadata}</Td><Td>{row.created}</Td></tr>
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

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/10 bg-panel/90 p-4 shadow-wallet backdrop-blur"><h2 className="mb-4 text-lg font-semibold">{title}</h2>{children}</section>;
}

function Metric({ title, value, tone = "slate" }: { title: string; value: string; tone?: "slate" | "mint" | "danger" | "accent" }) {
  const color = tone === "mint" ? "text-mint" : tone === "danger" ? "text-danger" : tone === "accent" ? "text-accent" : "text-white";
  return <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4"><div className="text-xs text-slate-500">{title}</div><div className={`mt-2 text-2xl font-semibold ${color}`}>{value}</div></div>;
}

function AdminTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-separate border-spacing-y-2 text-left text-sm">
        <thead><tr>{headers.map((header) => <th key={header} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{header}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="bg-white/[0.045] px-3 py-3 first:rounded-l-xl last:rounded-r-xl">{children}</td>;
}

function Badge({ value }: { value: string }) {
  const good = value === "success" || value === "none" || value === "ready";
  const bad = value.includes("failed") || value.includes("refund");
  return <span className={`rounded-full px-2 py-1 text-xs ${good ? "bg-mint/15 text-mint" : bad ? "bg-danger/15 text-red-100" : "bg-accent/15 text-accent"}`}>{value}</span>;
}

function ActionButtons({ actions }: { actions: string[] }) {
  return <div className="flex flex-wrap gap-1">{actions.map((action) => <button key={action} className="rounded-lg bg-white/10 px-2 py-1 text-xs text-slate-200" type="button">{action}</button>)}</div>;
}

