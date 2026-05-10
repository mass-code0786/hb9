"use client";

import { ethers } from "ethers";
import { CheckCircle2, Fuel, QrCode, ScanLine, XCircle } from "lucide-react";
import { useState } from "react";
import { Panel, PrimaryButton, Field, Select } from "@/components/ui/Primitives";
import { BrandLogo } from "@/components/BrandLogo";
import { parseQrPayloadSafe, type QrPaymentRequest } from "@/services/qrPaymentProvider";
import { useTransactionStore } from "@/store/transactionStore";
import { QrScanner } from "@/features/qr-pay/QrScanner";

const demoPayload = JSON.stringify({
  mode: "dynamic",
  merchant: "BitzenX Fuel Station",
  category: "petrol",
  address: "0x0000000000000000000000000000000000000000",
  asset: "USDT",
  amount: "12.50",
  reference: "pump-04"
});

export function QrPayModule() {
  const [raw, setRaw] = useState(demoPayload);
  const [request, setRequest] = useState<QrPaymentRequest | null>(parseQrPayloadSafe(demoPayload).request);
  const [result, setResult] = useState<"idle" | "success" | "failed">("idle");
  const [error, setError] = useState("");
  const addTransaction = useTransactionStore((state) => state.addTransaction);

  function applyPayload(value: string) {
    setRaw(value);
    const parsed = parseQrPayloadSafe(value);
    setRequest(parsed.request);
    setError(parsed.error);
    setResult("idle");
  }

  function confirm() {
    if (!request) return;
    if (!ethers.isAddress(request.address) || !request.amount || Number(request.amount) <= 0) {
      setResult("failed");
      return;
    }
    addTransaction({
      id: `qr-${Date.now()}`,
      type: "qr-pay",
      title: request.category === "petrol" ? "Petrol pump payment" : request.merchant,
      asset: request.asset,
      amount: `-${request.amount || "0"}`,
      status: "success",
      counterparty: request.address,
      gasFee: "Network fee estimated before broadcast",
      createdAt: new Date().toISOString()
    });
    setResult("success");
  }

  return (
    <div className="space-y-4">
      <Panel data-testid="qr-pay-screen">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo size="sm" />
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold">Scan & Pay</h1>
              <p className="text-sm text-slate-400">Static and dynamic BSC QR payment flow</p>
            </div>
          </div>
          <div className="rounded-2xl bg-accent p-3 text-black"><ScanLine size={24} /></div>
        </div>
        <QrScanner onScan={applyPayload} />
        <textarea className="field mt-4 min-h-24" value={raw} onChange={(event) => setRaw(event.target.value)} aria-label="Manual QR payload" />
        {error ? <div className="mt-3 rounded-2xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</div> : null}
        <PrimaryButton className="mt-3 w-full" onClick={() => applyPayload(raw)} type="button">Parse Manual QR</PrimaryButton>
      </Panel>
      {request ? (
        <Panel>
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-3">{request.category === "petrol" ? <Fuel size={22} /> : <QrCode size={22} />}</div>
            <div>
              <h2 className="font-semibold">{request.merchant}</h2>
              <p className="text-xs uppercase text-slate-400">{request.mode} QR | {request.reference}</p>
            </div>
          </div>
          <div className="grid gap-3">
            <Field value={request.address} onChange={(event) => setRequest({ ...request, address: event.target.value })} placeholder="Merchant BSC address" aria-label="Merchant BSC address" />
            <Field inputMode="decimal" value={request.amount} onChange={(event) => setRequest({ ...request, amount: event.target.value })} placeholder="Amount" />
            <Select value={request.asset} onChange={(event) => setRequest({ ...request, asset: event.target.value as "BNB" | "USDT" })}>
              <option value="USDT">USDT</option>
              <option value="BNB">BNB</option>
            </Select>
          </div>
          {result === "success" ? <div className="mt-4 flex items-center gap-2 rounded-2xl border border-mint/30 bg-mint/10 p-3 text-mint"><CheckCircle2 /> Payment success</div> : null}
          {result === "failed" || !ethers.isAddress(request.address) ? <div className="mt-4 flex items-center gap-2 rounded-2xl border border-danger/30 bg-danger/10 p-3 text-danger"><XCircle /> Add a valid merchant address and amount before confirming.</div> : null}
          <PrimaryButton className="mt-4 w-full" onClick={confirm} type="button">Confirm Payment</PrimaryButton>
        </Panel>
      ) : null}
    </div>
  );
}
