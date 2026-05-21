"use client";

import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { PackageIllustration, packageIllustrationTypeForAmount } from "@/components/packages/PackageIllustration";
import { EmptyState, ErrorText, Panel, PrimaryButton } from "@/components/ui/Primitives";
import {
  buyHbProduct,
  fetchHbIncome,
  fetchHbMe,
  fetchHbOrders,
  fetchHbProducts,
  fetchHbPurchases,
  fetchHbReferrals,
  fetchHbWallet,
  getHbToken,
  type HbDeposit,
  type HbIncome,
  type HbOrder,
  type HbProduct,
  type HbPurchase,
  type HbReferral,
  type HbReferralSummary,
  type HbSingleLegReserve,
  type HbUser,
  type HbWithdrawal
} from "@/services/halalBusinessService";
import { getStoredHbReferral } from "@/lib/referral";

type HbMainTab = "products" | "team" | "income" | "wallet";

const HB_BYPASS_AUTH = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_HB_BYPASS_AUTH === "true";

const devUser: HbUser = {
  id: "dev-hb-user",
  email: "demo@halalbusiness.local",
  display_name: "Demo User",
  referral_code: "HBDEMO",
  status: "inactive"
};

const devProducts: HbProduct[] = [4, 20, 100, 500, 2500, 12500].map((amount, index) => ({
  id: `dev-product-${amount}`,
  title: `$${amount} Activation Product`,
  slug: `dev-product-${amount}`,
  short_description: "Activation product.",
  description: "Activation product mapped to a HB9 package.",
  package_id: `dev-package-${amount}`,
  package_price: amount,
  package_type: "activation",
  image_url: index % 2 === 0 ? "/tokens/bnb.svg" : "/tokens/usdt.svg",
  thumbnail_url: index % 2 === 0 ? "/tokens/bnb.svg" : "/tokens/usdt.svg",
  stock: 999,
  active: true,
  featured: index < 3,
  package_name: `$${amount} Activation Package`
}));

function money(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00";
}

export function HbMainFlow({ tab, walletAddress }: { tab: HbMainTab; walletAddress: string }) {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<HbUser | null>(null);
  const [products, setProducts] = useState<HbProduct[]>(devProducts);
  const [walletBalances, setWalletBalances] = useState({ deposit: "0", income: "0" });
  const [walletSummary, setWalletSummary] = useState({
    depositAddress: "",
    pendingDeposits: { total: "0", count: 0 },
    verifiedDeposits: { total: "0", count: 0 },
    totalPurchased: { total: "0", count: 0 }
  });
  const [deposits, setDeposits] = useState<HbDeposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<HbWithdrawal[]>([]);
  const [purchases, setPurchases] = useState<HbPurchase[]>([]);
  const [orders, setOrders] = useState<HbOrder[]>([]);
  const [income, setIncome] = useState<HbIncome[]>([]);
  const [singleLegReserve, setSingleLegReserve] = useState<HbSingleLegReserve[]>([]);
  const [incomeSummary, setIncomeSummary] = useState({ direct_income: "0", level_income: "0", single_leg_reserve: "0", salaryIncome: "0" });
  const [referrals, setReferrals] = useState<HbReferral[]>([]);
  const [referralSummary, setReferralSummary] = useState<HbReferralSummary | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [buyPrompt, setBuyPrompt] = useState<{ type: "confirm" | "insufficient"; product: HbProduct } | null>(null);

  const activeToken = token || getHbToken();
  const currentUser = user;

  useEffect(() => {
    fetchHbProducts()
      .then((data) => setProducts(data.items.length ? data.items : devProducts))
      .catch(() => setProducts(devProducts));

    const stored = getHbToken();
    if (stored) {
      setToken(stored);
      refresh(stored);
      return;
    }
  }, []);

  async function refresh(nextToken = activeToken) {
    if (!nextToken) return;
    setLoading(true);
    setError("");
    try {
      const [me, wallet, purchaseData, orderData, incomeData, referralData] = await Promise.all([
        fetchHbMe(nextToken),
        fetchHbWallet(nextToken),
        fetchHbPurchases(nextToken),
        fetchHbOrders(nextToken),
        fetchHbIncome(nextToken),
        fetchHbReferrals(nextToken)
      ]);
      setUser(me.user);
      setWalletBalances(wallet.balances);
      setWalletSummary({
        depositAddress: wallet.depositAddress,
        pendingDeposits: wallet.pendingDeposits,
        verifiedDeposits: wallet.verifiedDeposits,
        totalPurchased: wallet.totalPurchased
      });
      setDeposits(wallet.deposits);
      setWithdrawals(wallet.withdrawals);
      setPurchases(purchaseData.items);
      setOrders(orderData.items);
      setIncome(incomeData.items);
      setSingleLegReserve(incomeData.singleLegReserve);
      setIncomeSummary({
        direct_income: incomeData.summary.direct_income || "0",
        level_income: incomeData.summary.level_income || "0",
        single_leg_reserve: incomeData.summary.single_leg_reserve || "0",
        salaryIncome: "0"
      });
      setReferrals(referralData.items);
      setReferralSummary(referralData);
    } catch (err) {
      if (!HB_BYPASS_AUTH) setError(err instanceof Error ? err.message : "HB9 data could not be loaded.");
      setReferralSummary((current) => current || mockReferralSummary);
    } finally {
      setLoading(false);
    }
  }

  function requestBuy(product: HbProduct) {
    setError("");
    setNotice("");
    if (Number(walletBalances.deposit || 0) + Number.EPSILON < Number(product.package_price)) {
      setBuyPrompt({ type: "insufficient", product });
      return;
    }
    setBuyPrompt({ type: "confirm", product });
  }

  async function confirmBuy(productId: string) {
    if (!activeToken) {
      setError("Create or log in to HB9 before buying an activation product.");
      return;
    }
    setError("");
    setNotice("");
    try {
      const result = await buyHbProduct(activeToken, productId);
      setNotice(result.activated ? "Product purchased. Your ID is now active." : "Product purchased.");
      await refresh(activeToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Product purchase failed.");
    } finally {
      setBuyPrompt(null);
    }
  }

  return (
    <div className="space-y-4">
      {notice ? <div className="rounded-2xl border border-mint/30 bg-mint/10 p-4 text-sm text-mint">{notice}</div> : null}
      <ErrorText error={error} />
      {!activeToken || !currentUser ? (
        <Panel>
          <h2 className="text-xl font-semibold">Login Required</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Login to access products, wallet, team, and income records.</p>
        </Panel>
      ) : null}
      {activeToken && currentUser ? (
        <>
      {tab === "products" ? <HbProducts products={products} loading={loading} onBuy={requestBuy} /> : null}
      {tab === "team" ? <HbTeam user={currentUser} referrals={referrals} summary={referralSummary || mockReferralSummary} /> : null}
      {tab === "income" ? <HbIncome income={income} singleLegReserve={singleLegReserve} summary={incomeSummary} /> : null}
      {tab === "wallet" ? <HbWallet walletAddress={walletAddress} balances={walletBalances} summary={walletSummary} deposits={deposits} withdrawals={withdrawals} purchases={purchases} orders={orders} /> : null}
        </>
      ) : null}
      {buyPrompt ? (
        <BuyPrompt
          prompt={buyPrompt}
          onCancel={() => setBuyPrompt(null)}
          onGoWallet={() => {
            setBuyPrompt(null);
            window.dispatchEvent(new CustomEvent("bitzenx:set-tab", { detail: "wallet" }));
          }}
          onConfirm={() => confirmBuy(buyPrompt.product.id)}
        />
      ) : null}
    </div>
  );
}

function HbProducts({ products, loading, onBuy }: { products: HbProduct[]; loading: boolean; onBuy: (product: HbProduct) => void }) {
  const ordered = [...products].sort((a, b) => Number(a.package_price) - Number(b.package_price));
  return (
    <Panel data-testid="hb-products-screen">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Products</h1>
        <p className="mt-2 text-sm text-slate-400">Activation products mapped to HB9 packages.</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3">
        {ordered.map((product) => {
          const disabled = loading || product.stock <= 0;
          return (
            <div key={product.id} className="flex min-w-0 flex-col overflow-hidden rounded-[1.35rem] border border-sky-200/15 bg-[#0b1728]/70 shadow-[0_0_24px_rgba(56,189,248,0.1)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-sky-200/25">
              <div className="hb-dashboard-product-visual flex aspect-[5/4] items-center justify-center bg-sky-200/[0.06]">
                <PackageIllustration type={packageIllustrationTypeForAmount(product.package_price)} />
              </div>
              <div className="flex flex-1 flex-col p-2.5">
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="min-w-0">
                    <h2 className="line-clamp-2 text-[13px] font-semibold leading-4 sm:text-sm sm:leading-5">{product.title}</h2>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-accent sm:text-base">{money(product.package_price)}</div>
                    <span className="mt-1 inline-flex max-w-full rounded-full border border-accent/30 bg-accent/10 px-1.5 py-0.5 text-[9px] leading-3 text-accent">
                      <span className="truncate">Activation</span>
                    </span>
                  </div>
                </div>
                <PrimaryButton className="mt-2.5 w-full px-2 py-2 text-xs sm:text-sm" onClick={() => onBuy(product)} disabled={disabled} type="button">
                  {product.stock <= 0 ? "Out of Stock" : "Buy with USDT"}
                </PrimaryButton>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function BuyPrompt({ prompt, onCancel, onConfirm, onGoWallet }: {
  prompt: { type: "confirm" | "insufficient"; product: HbProduct };
  onCancel: () => void;
  onConfirm: () => void;
  onGoWallet: () => void;
}) {
  const isInsufficient = prompt.type === "insufficient";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-3 pb-3 backdrop-blur-sm sm:items-center sm:pb-0">
      <div className="w-full max-w-md rounded-[1.6rem] border border-sky-200/15 bg-[#071827]/90 p-4 shadow-wallet backdrop-blur-2xl">
        <h2 className="text-xl font-semibold">{isInsufficient ? "Insufficient Balance" : "Confirm Buy with USDT"}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {isInsufficient
            ? "Insufficient balance. Please deposit USDT first."
            : `You are buying ${prompt.product.title} for ${money(prompt.product.package_price)}. This will activate your HB9 ID and start package distribution.`}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button className="rounded-2xl border border-sky-200/15 bg-[#0b1728]/75 px-4 py-3 font-semibold text-slate-100 transition hover:bg-[#0b1728]/90" onClick={onCancel} type="button">Cancel</button>
          {isInsufficient ? (
            <button className="rounded-2xl bg-gradient-to-r from-sky-300 via-cyan-400 to-sky-500 px-4 py-3 font-semibold text-[#031524] shadow-[0_14px_34px_rgba(56,189,248,0.24)]" onClick={onGoWallet} type="button">Go to Wallet</button>
          ) : (
            <button className="rounded-2xl bg-gradient-to-r from-sky-300 via-cyan-400 to-sky-500 px-4 py-3 font-semibold text-[#031524] shadow-[0_14px_34px_rgba(56,189,248,0.24)]" onClick={onConfirm} type="button">Confirm Buy</button>
          )}
        </div>
      </div>
    </div>
  );
}

function HbTeam({ user, referrals, summary }: { user: HbUser; referrals: HbReferral[]; summary: HbReferralSummary }) {
  const referralUrl = typeof window === "undefined" ? user.referral_code : `${window.location.origin}/?ref=${user.referral_code}`;
  return (
    <div className="space-y-4" data-testid="hb-team-screen">
      <Panel>
        <h1 className="text-2xl font-semibold">Team</h1>
        <div className="mt-4 rounded-2xl border border-accent/25 bg-accent/10 p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-accent">Referral Link</div>
          <div className="mt-2 break-all font-mono text-sm">{referralUrl}</div>
          <button className="mt-3 flex items-center gap-2 text-sm font-semibold text-accent" onClick={() => navigator.clipboard.writeText(referralUrl)} type="button"><Copy size={15} /> Copy / Share</button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="Direct" value={String(summary.directReferrals.length)} />
          <Metric label="Active" value={String(summary.activeCount)} />
          <Metric label="Inactive" value={String(summary.inactiveCount)} />
        </div>
        <div className="mt-4 rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4 shadow-[0_0_18px_rgba(56,189,248,0.08)] backdrop-blur-xl">
          <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Sponsor</div>
          <div className="mt-2 font-semibold">{summary.sponsor?.display_name || "No sponsor"}</div>
          {summary.sponsor ? <div className="mt-1 text-xs text-slate-400">{summary.sponsor.email} - {summary.sponsor.status}</div> : null}
          {getStoredHbReferral() ? <div className="mt-2 text-xs text-slate-500">Source referral: {getStoredHbReferral()}</div> : null}
        </div>
      </Panel>
      <Panel>
        <h2 className="mb-4 text-lg font-semibold">Level Team</h2>
        {summary.levelSummary.length === 0 ? <EmptyState title="No level team yet." /> : (
          <div className="grid gap-2 sm:grid-cols-3">
            {Array.from({ length: 15 }, (_, index) => {
              const level = summary.levelSummary.find((item) => item.level_no === index + 1);
              return <div key={index} className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-3 text-sm shadow-[0_0_16px_rgba(56,189,248,0.07)]"><div className="font-semibold">Level {index + 1}</div><div className="mt-1 text-slate-400">{level?.total_count || 0} members</div></div>;
            })}
          </div>
        )}
      </Panel>
      <Panel>
        <h2 className="mb-4 text-lg font-semibold">Direct Team</h2>
        {referrals.length === 0 ? <EmptyState title="No direct referrals yet." /> : referrals.map((item) => <div key={item.id} className="mb-2 rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-3"><div className="font-semibold">{item.display_name}</div><div className="text-xs text-slate-400">{item.email} - {item.status}</div></div>)}
      </Panel>
    </div>
  );
}

function HbIncome({ income, singleLegReserve, summary }: {
  income: HbIncome[];
  singleLegReserve: HbSingleLegReserve[];
  summary: { direct_income: string; level_income: string; single_leg_reserve: string; salaryIncome: string };
}) {
  const [tab, setTab] = useState<"direct" | "level" | "single" | "salary">("direct");
  const currentItems = tab === "direct" ? income.filter((item) => item.income_type === "upline") : tab === "level" ? income.filter((item) => item.income_type === "level") : tab === "single" ? singleLegReserve : [];
  const tabs = [
    ["direct", "Direct", summary.direct_income],
    ["level", "Level", summary.level_income],
    ["single", "Single Leg", summary.single_leg_reserve],
    ["salary", "Salary", summary.salaryIncome]
  ] as const;
  return (
    <Panel data-testid="hb-income-screen">
      <h1 className="text-2xl font-semibold">Income</h1>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {tabs.map((item) => <button key={item[0]} className={`rounded-2xl border p-3 text-left transition ${tab === item[0] ? "border-sky-200/30 bg-gradient-to-r from-sky-300 via-cyan-400 to-sky-500 text-[#031524] shadow-[0_0_24px_rgba(56,189,248,0.2)]" : "border-sky-200/10 bg-[#0b1728]/70 text-slate-200 hover:bg-[#0b1728]/80"}`} onClick={() => setTab(item[0])} type="button"><div className="text-xs font-semibold">{item[1]}</div><div className="mt-1 font-semibold">{money(item[2])}</div></button>)}
      </div>
      <div className="mt-4 rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4 shadow-[0_0_18px_rgba(56,189,248,0.08)] backdrop-blur-xl">
        <h2 className="font-semibold">Single Leg section</h2>
        <p className="mt-1 text-sm text-slate-400">Single leg reserve/income: <span className="text-slate-100">{money(summary.single_leg_reserve)}</span></p>
      </div>
      <div className="mt-4 space-y-2">
        {currentItems.length === 0 ? <EmptyState title="No income records for this tab." /> : currentItems.map((item) => <div key={item.id} className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-3"><div className="font-semibold">{money(item.amount_usd)}</div><div className="text-xs text-slate-400">{item.status} - {new Date(item.created_at).toLocaleString()}</div></div>)}
      </div>
    </Panel>
  );
}

function HbWallet({ walletAddress, balances, summary, deposits, withdrawals, purchases, orders }: {
  walletAddress: string;
  balances: { deposit: string; income: string };
  summary: { depositAddress: string; pendingDeposits: { total: string; count: number }; verifiedDeposits: { total: string; count: number }; totalPurchased: { total: string; count: number } };
  deposits: HbDeposit[];
  withdrawals: HbWithdrawal[];
  purchases: HbPurchase[];
  orders: HbOrder[];
}) {
  const reserved = withdrawals
    .filter((item) => ["pending", "under_review", "approved", "processing"].includes(item.status))
    .reduce((sum, item) => sum + Number(item.amount_usd || 0), 0);

  return (
    <div className="space-y-4" data-testid="hb-wallet-screen">
      <Panel>
        <h1 className="text-2xl font-semibold">Wallet</h1>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Metric label="Balance" value={money(balances.deposit)} />
          <Metric label="Reserved" value={money(reserved)} />
          <Metric label="Income" value={money(balances.income)} />
        </div>
        <div className="mt-4 rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4 shadow-[0_0_18px_rgba(56,189,248,0.08)] backdrop-blur-xl">
          <div className="text-xs uppercase tracking-[0.16em] text-slate-500">HB9 Wallet ID</div>
          <div className="mt-2 break-all font-mono text-sm">{walletAddress || "HB9 account not loaded"}</div>
        </div>
        <div className="mt-3 rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-4 shadow-[0_0_18px_rgba(56,189,248,0.08)] backdrop-blur-xl">
          <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Company Deposit Address</div>
          <div className="mt-2 break-all font-mono text-sm">{summary.depositAddress || "Use Deposit to create a payment invoice"}</div>
        </div>
      </Panel>
      <HistoryPanel title="Deposit History" items={deposits.map((item) => ({ id: item.id, title: `${money(item.usd_amount)} ${item.asset}`, meta: `${item.status} - ${new Date(item.created_at).toLocaleString()}` }))} />
      <HistoryPanel title="Withdrawal History" items={withdrawals.map((item) => ({ id: item.id, title: `${money(item.amount_usd)} ${item.currency}`, meta: `${item.status} - ${new Date(item.requested_at).toLocaleString()}` }))} />
      <HistoryPanel title="Package Purchase History" items={purchases.map((item) => ({ id: item.id, title: item.package_name, meta: `${money(item.amount_usd)} - ${item.status}` }))} />
      <HistoryPanel title="Product Orders" items={orders.map((item) => ({ id: item.id, title: item.product_title, meta: `${money(item.amount_usd)} - ${item.payment_status}` }))} />
      <HistoryPanel title="Internal Ledger" items={[
        { id: "deposit-balance", title: "Deposit wallet", meta: money(balances.deposit) },
        { id: "income-balance", title: "Income wallet", meta: money(balances.income) },
        { id: "verified-deposits", title: "Verified deposits", meta: `${summary.verifiedDeposits.count} records - ${money(summary.verifiedDeposits.total)}` },
        { id: "pending-deposits", title: "Pending deposits", meta: `${summary.pendingDeposits.count} records - ${money(summary.pendingDeposits.total)}` }
      ]} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-3 shadow-[0_0_16px_rgba(56,189,248,0.07)] backdrop-blur-xl"><div className="text-xs text-sky-200/60">{label}</div><div className="mt-1 truncate font-semibold text-slate-100">{value}</div></div>;
}

function HistoryPanel({ title, items }: { title: string; items: Array<{ id: string; title: string; meta: string }> }) {
  return (
    <Panel>
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {items.length === 0 ? <EmptyState title={`No ${title.toLowerCase()} yet.`} /> : items.map((item) => <div key={item.id} className="mb-2 rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-3"><div className="font-semibold">{item.title}</div><div className="text-xs text-slate-400">{item.meta}</div></div>)}
    </Panel>
  );
}

const mockReferralSummary: HbReferralSummary = {
  sponsor: null,
  items: [],
  directReferrals: [],
  levelSummary: [],
  levelCounts: Array.from({ length: 15 }, (_, index) => ({ level: index + 1, total: 0, active: 0 })),
  totalTeamCount: 0,
  singleLegCount: 0,
  directTeamCount: 0,
  activeTeamCount: 0,
  inactiveTeamCount: 0,
  activeCount: 0,
  inactiveCount: 0,
  packageSummary: { purchase_count: 0, purchase_volume: "0" }
};
