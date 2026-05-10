"use client";

import { CheckCircle2, Clock3, FileText, RefreshCcw, Smartphone, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorCard, Field, Panel, PrimaryButton, SecondaryButton, Select } from "@/components/ui/Primitives";
import { BrandLogo } from "@/components/BrandLogo";
import {
  fetchRechargeCountries,
  fetchRechargeOperators,
  fetchRechargeProducts,
  getRechargeStatus,
  quoteRecharge,
  submitRecharge,
  supportedCountryCount
} from "@/services/rechargeProvider";
import { useRechargeStore } from "@/store/rechargeStore";
import { useTransactionStore } from "@/store/transactionStore";
import type { RechargeCountry, RechargeOperator, RechargeOrder, RechargeProduct, RechargeQuote } from "@/types/wallet";

const statusLabels: Record<RechargeOrder["status"], string> = {
  awaiting_payment: "Awaiting payment",
  payment_detected: "Payment detected",
  processing_recharge: "Processing recharge",
  success: "Success",
  failed: "Failed",
  refund_pending: "Refund review",
  refunded: "Refunded"
};

function flagEmoji(countryCode: string) {
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function money(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function RechargeModule() {
  const store = useRechargeStore();
  const addTransaction = useTransactionStore((state) => state.addTransaction);
  const [countries, setCountries] = useState<RechargeCountry[]>([]);
  const [operators, setOperators] = useState<RechargeOperator[]>([]);
  const [products, setProducts] = useState<RechargeProduct[]>([]);
  const [quote, setQuote] = useState<RechargeQuote | null>(null);
  const [order, setOrder] = useState<RechargeOrder | null>(null);
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState<"catalog" | "quote" | "order" | "status" | "">("catalog");
  const [error, setError] = useState("");

  const country = useMemo(() => countries.find((item) => item.code === store.country) || countries[0], [countries, store.country]);
  const operator = useMemo(() => operators.find((item) => item.id === store.operatorId) || operators[0], [operators, store.operatorId]);
  const product = useMemo(() => products.find((item) => item.id === store.productId) || products[0], [products, store.productId]);
  const step = order ? 7 : quote ? 5 : product ? 4 : operator ? 3 : store.mobile ? 2 : 1;

  useEffect(() => {
    let active = true;
    setLoading("catalog");
    fetchRechargeCountries()
      .then((items) => {
        if (!active) return;
        setCountries(items);
      })
      .catch(() => setError("Could not load recharge countries."))
      .finally(() => setLoading(""));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!store.country) return;
    let active = true;
    setLoading("catalog");
    fetchRechargeOperators(store.country)
      .then((items) => {
        if (!active) return;
        setOperators(items);
        const next = items[0];
        if (next && !items.some((item) => item.id === store.operatorId)) {
          store.setField("operatorId", next.id);
          store.setField("operator", next.name);
        }
      })
      .catch(() => setError("Could not load operators for this country."))
      .finally(() => setLoading(""));
    return () => {
      active = false;
    };
  }, [store.country, store.operatorId, store]);

  useEffect(() => {
    if (!store.operatorId) return;
    let active = true;
    setLoading("catalog");
    fetchRechargeProducts(store.operatorId)
      .then((items) => {
        if (!active) return;
        setProducts(items);
        const next = items[0];
        if (next && !items.some((item) => item.id === store.productId)) store.setField("productId", next.id);
      })
      .catch(() => setError("Could not load recharge plans."))
      .finally(() => setLoading(""));
    return () => {
      active = false;
    };
  }, [store.operatorId, store.productId, store]);

  async function preview() {
    setError("");
    setOrder(null);
    if (!country || !operator || !product) {
      setError("Select a country, operator, and plan.");
      return;
    }
    if (!store.mobile.trim()) {
      setError("Enter a valid mobile number.");
      return;
    }
    setLoading("quote");
    try {
      setQuote(await quoteRecharge({
        countryCode: country.code,
        operatorId: operator.id,
        phoneNumber: store.mobile,
        productId: product.id,
        cryptoSymbol: store.cryptoAsset === "BNB" ? "BNB" : "USDT",
        network: store.cryptoAsset === "BNB" ? "bsc" : "bsc"
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create recharge quote.");
    } finally {
      setLoading("");
    }
  }

  async function createOrder() {
    setError("");
    if (!quote) {
      setError("Confirm a quote before creating the recharge order.");
      return;
    }
    if (!txHash.trim()) {
      setError("Enter the confirmed blockchain transaction hash.");
      return;
    }
    setLoading("order");
    try {
      const nextOrder = await submitRecharge({ quoteId: quote.id, txHash: txHash.trim() });
      setOrder(nextOrder);
      store.addOrder(nextOrder);
      addTransaction({
        id: nextOrder.id,
        type: "recharge",
        title: `${nextOrder.operatorName} recharge`,
        asset: nextOrder.cryptoAsset,
        amount: `-${nextOrder.cryptoAmount}`,
        status: nextOrder.status === "success" ? "success" : nextOrder.status === "failed" || nextOrder.status === "refund_pending" ? "failed" : "pending",
        hash: nextOrder.txHash,
        gasFee: "Paid on-chain",
        createdAt: nextOrder.createdAt
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recharge provider failed. Try again or choose another plan.");
    } finally {
      setLoading("");
    }
  }

  async function refreshStatus() {
    if (!order) return;
    setLoading("status");
    try {
      const updated = await getRechargeStatus(order.id);
      if (updated) {
        setOrder(updated);
        store.updateOrder(updated);
      }
    } finally {
      setLoading("");
    }
  }

  function resetFlow() {
    setQuote(null);
    setOrder(null);
    setTxHash("");
    setError("");
  }

  return (
    <div className="space-y-4 md:grid md:grid-cols-[minmax(0,1fr)_360px] md:gap-5 md:space-y-0" data-testid="recharge-screen">
      <Panel>
        <div className="mb-5 flex items-center gap-3">
          <BrandLogo size="sm" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">Global Recharge</h1>
            <p className="text-sm text-slate-400">{supportedCountryCount} countries, local currency quotes</p>
          </div>
          <div className="ml-auto rounded-2xl bg-accent p-3 text-black"><Smartphone size={22} /></div>
        </div>

        <div className="mb-4 grid grid-cols-7 gap-1">
          {[1, 2, 3, 4, 5, 6, 7].map((item) => (
            <div key={item} className={`h-1.5 rounded-full ${item <= step ? "bg-accent" : "bg-white/10"}`} />
          ))}
        </div>

        <div className="grid gap-3">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">1. Country</span>
            <Select value={store.country} onChange={(event) => {
              resetFlow();
              store.setField("country", event.target.value);
            }} disabled={loading === "catalog"}>
              {countries.map((item) => <option key={item.code} value={item.code}>{flagEmoji(item.code)} {item.name} ({item.dialCode})</option>)}
            </Select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">2. Mobile number</span>
            <Field inputMode="tel" placeholder={`${country?.dialCode || "+"} mobile number`} value={store.mobile} onChange={(event) => {
              resetFlow();
              store.setField("mobile", event.target.value);
            }} />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">3. Operator</span>
            <Select value={store.operatorId} onChange={(event) => {
              const selected = operators.find((item) => item.id === event.target.value);
              resetFlow();
              store.setField("operatorId", event.target.value);
              store.setField("operator", selected?.name || "");
            }} disabled={loading === "catalog" || operators.length === 0}>
              {operators.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">4. Plan / amount</span>
            <Select value={store.productId} onChange={(event) => {
              resetFlow();
              store.setField("productId", event.target.value);
            }} disabled={loading === "catalog" || products.length === 0}>
              {products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">6. Pay with</span>
            <Select value={store.cryptoAsset} onChange={(event) => {
              resetFlow();
              store.setCryptoAsset(event.target.value as "BNB" | "USDT");
            }}>
              <option value="USDT">USDT on BSC</option>
              <option value="BNB">BNB on BSC</option>
            </Select>
          </label>
        </div>

        {quote ? (
          <div className="mt-4 rounded-2xl border border-accent/20 bg-accent/10 p-4 text-sm text-slate-200">
            <div className="mb-3 flex items-center gap-2 font-semibold text-accent"><FileText size={16} /> Quote preview</div>
            <QuoteRow label="Country" value={`${flagEmoji(quote.countryCode)} ${quote.countryName}`} />
            <QuoteRow label="Operator" value={quote.operatorName} />
            <QuoteRow label="Mobile" value={quote.phoneNumber} />
            <QuoteRow label="Local amount" value={money(quote.localAmount, quote.localCurrency)} />
            <QuoteRow label="FX rate" value={`1 ${quote.localCurrency} = $${quote.fxRate}`} />
            <QuoteRow label="Platform fee" value={`$${quote.platformFee}`} />
            <QuoteRow label="Payable" value={`${quote.cryptoAmount} ${quote.cryptoSymbol}`} strong />
            <QuoteRow label="ETA" value={quote.estimatedDelivery} />
            <Field className="mt-3" placeholder="Confirmed blockchain tx hash" value={txHash} onChange={(event) => setTxHash(event.target.value)} />
            <p className="mt-2 text-xs leading-5 text-slate-400">Send from the local BitzenX wallet, wait for confirmation, then paste the transaction hash. Signing remains local.</p>
          </div>
        ) : null}

        {order ? <OrderStatus order={order} onRefresh={refreshStatus} loading={loading === "status"} /> : null}
        {error ? <ErrorCard message={error} onRetry={quote ? createOrder : preview} className="mt-4" /> : null}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <SecondaryButton type="button" onClick={resetFlow}>Retry</SecondaryButton>
          {quote ? (
            <PrimaryButton type="button" onClick={createOrder} disabled={loading === "order" || Boolean(order)}>{loading === "order" ? "Processing" : "Confirm paid"}</PrimaryButton>
          ) : (
            <PrimaryButton type="button" onClick={preview} disabled={loading === "quote" || loading === "catalog"}>{loading ? "Loading" : "Get quote"}</PrimaryButton>
          )}
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-4 text-lg font-semibold">Recharge history</h2>
        <div className="space-y-2">
          {store.history.length === 0 ? <EmptyState title="No recharge orders" detail="Completed and pending top-ups will appear here." /> : null}
          {store.history.map((item) => (
            <button key={item.id} className="w-full rounded-2xl bg-white/[0.045] p-3 text-left text-sm transition hover:bg-white/[0.075]" onClick={() => setOrder(item)} type="button">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate font-medium">{item.operatorName}</span>
                <span className={item.status === "success" ? "text-mint" : item.status === "refund_pending" || item.status === "failed" ? "text-danger" : "text-accent"}>{statusLabels[item.status]}</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">{item.phoneNumber} | {money(item.localAmount, item.localCurrency)} | {item.cryptoAmount} {item.cryptoAsset}</div>
            </button>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function QuoteRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-xs">
      <span className="text-slate-400">{label}</span>
      <span className={`min-w-0 truncate text-right ${strong ? "font-semibold text-accent" : "text-slate-100"}`}>{value}</span>
    </div>
  );
}

function OrderStatus({ order, onRefresh, loading }: { order: RechargeOrder; onRefresh: () => void; loading: boolean }) {
  const failed = order.status === "failed" || order.status === "refund_pending";
  const success = order.status === "success";
  return (
    <div className={`mt-4 rounded-2xl border p-4 text-sm ${success ? "border-mint/30 bg-mint/10" : failed ? "border-danger/30 bg-danger/10" : "border-accent/25 bg-accent/10"}`}>
      <div className="flex items-center gap-2 font-semibold">
        {success ? <CheckCircle2 size={18} className="text-mint" /> : failed ? <XCircle size={18} className="text-danger" /> : <Clock3 size={18} className="text-accent" />}
        <span>{statusLabels[order.status]}</span>
        <button className="ml-auto rounded-xl bg-white/10 p-2" onClick={onRefresh} type="button" aria-label="Refresh recharge status" disabled={loading}>
          <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      <div className="mt-3 grid gap-1 text-xs text-slate-300">
        <QuoteRow label="Receipt" value={order.id} />
        <QuoteRow label="Provider order" value={order.providerOrderId || "Pending"} />
        <QuoteRow label="Transaction" value={order.txHash} />
        <QuoteRow label="Refund" value={order.refundStatus || "none"} />
        {order.failureReason ? <QuoteRow label="Reason" value={order.failureReason} /> : null}
      </div>
    </div>
  );
}

