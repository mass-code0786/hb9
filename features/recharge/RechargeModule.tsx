"use client";

import { CheckCircle2, Smartphone, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { Panel, PrimaryButton, Select, Field } from "@/components/ui/Primitives";
import { rechargeCountries, quoteRecharge, submitRecharge, supportedCountryCount } from "@/services/rechargeProvider";
import { useRechargeStore } from "@/store/rechargeStore";
import { useTransactionStore } from "@/store/transactionStore";

export function RechargeModule() {
  const store = useRechargeStore();
  const addTransaction = useTransactionStore((state) => state.addTransaction);
  const [status, setStatus] = useState<"idle" | "processing" | "success" | "failed">("idle");
  const [quote, setQuote] = useState<{ fee: string; payable: string; eta: string } | null>(null);
  const [error, setError] = useState("");
  const country = useMemo(() => rechargeCountries.find((item) => item.code === store.country) || rechargeCountries[0], [store.country]);

  async function preview() {
    setError("");
    if (!store.mobile.trim() || !store.amount || Number(store.amount) <= 0) {
      setError("Enter a mobile number and a valid recharge amount.");
      return;
    }
    setStatus("processing");
    setQuote(await quoteRecharge(store.amount));
    setStatus("idle");
  }

  async function submit() {
    setError("");
    if (!quote) {
      setError("Get a quote before creating the recharge order.");
      return;
    }
    setStatus("processing");
    try {
      const order = await submitRecharge({
        country: country.name,
        operator: store.operator,
        mobile: store.mobile,
        amount: store.amount,
        cryptoAsset: store.cryptoAsset
      });
      store.addOrder(order);
      addTransaction({
        id: order.id,
        type: "recharge",
        title: `${country.name} recharge`,
        asset: order.cryptoAsset,
        amount: `-${order.amount}`,
        status: "success",
        gasFee: "Estimated at checkout",
        createdAt: order.createdAt
      });
      setStatus("success");
    } catch {
      setError("Recharge provider failed. Try again or choose another operator.");
      setStatus("failed");
    }
  }

  return (
    <div className="space-y-4 md:grid md:grid-cols-[1fr_360px] md:gap-5 md:space-y-0">
      <Panel>
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-2xl bg-accent p-3 text-black"><Smartphone size={22} /></div>
          <div>
            <h1 className="text-2xl font-semibold">Global Recharge</h1>
            <p className="text-sm text-slate-400">{supportedCountryCount} countries ready for provider integration</p>
          </div>
        </div>
        <div className="grid gap-3">
          <Select value={store.country} onChange={(event) => {
            const selected = rechargeCountries.find((item) => item.code === event.target.value) || rechargeCountries[0];
            store.setField("country", selected.code);
            store.setField("operator", selected.operators[0]);
          }}>
            {rechargeCountries.map((item) => <option key={item.code} value={item.code}>{item.name} ({item.dialCode})</option>)}
          </Select>
          <Select value={store.operator} onChange={(event) => store.setField("operator", event.target.value)}>
            {country.operators.map((operator) => <option key={operator}>{operator}</option>)}
          </Select>
          <Field inputMode="tel" placeholder={`${country.dialCode} mobile number`} value={store.mobile} onChange={(event) => store.setField("mobile", event.target.value)} />
          <Field inputMode="decimal" placeholder={`Amount in ${country.currency}`} value={store.amount} onChange={(event) => store.setField("amount", event.target.value)} />
          <Select value={store.cryptoAsset} onChange={(event) => store.setCryptoAsset(event.target.value as "BNB" | "USDT")}>
            <option value="USDT">Pay with USDT</option>
            <option value="BNB">Pay with BNB</option>
          </Select>
        </div>
        {quote ? (
          <div className="mt-4 rounded-2xl border border-accent/20 bg-accent/10 p-4 text-sm text-slate-200">
            <div className="font-semibold text-accent">Order preview</div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300">
              <span>Operator</span><span className="text-right">{store.operator}</span>
              <span>Fee</span><span className="text-right">{quote.fee}</span>
              <span>Payable</span><span className="text-right">{quote.payable} {store.cryptoAsset}</span>
              <span>ETA</span><span className="text-right">{quote.eta}</span>
            </div>
          </div>
        ) : null}
        {error ? <div className="mt-4 flex items-center gap-2 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger"><XCircle size={18} /> {error}</div> : null}
        {status === "success" ? (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-mint/30 bg-mint/10 p-4 text-mint"><CheckCircle2 size={18} /> Recharge successful</div>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <PrimaryButton type="button" onClick={preview} disabled={status === "processing"}>{status === "processing" ? "Loading" : "Quote"}</PrimaryButton>
          <PrimaryButton type="button" onClick={submit} disabled={status === "processing"}>{status === "processing" ? "Processing" : "Pay"}</PrimaryButton>
        </div>
      </Panel>
      <Panel>
        <h2 className="mb-4 text-lg font-semibold">History</h2>
        <div className="space-y-2">
          {store.history.length === 0 ? <p className="text-sm text-slate-400">No recharge orders yet.</p> : null}
          {store.history.map((order) => (
            <div key={order.id} className="rounded-2xl bg-white/[0.045] p-3 text-sm">
              <div className="flex justify-between"><span>{order.operator}</span><span className="text-mint">{order.status}</span></div>
              <div className="mt-1 text-slate-400">{order.mobile} | {order.amount} via {order.cryptoAsset}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
