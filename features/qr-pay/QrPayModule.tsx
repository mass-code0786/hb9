"use client";

import { ethers } from "ethers";
import { CheckCircle2, Fuel, QrCode, ScanLine, XCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { Panel, PrimaryButton, SecondaryButton } from "@/components/ui/Primitives";
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

const initialRequest = parseQrPayloadSafe(demoPayload).request;

function shortWallet(address: string) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Not available";
}

function categoryLabel(category: QrPaymentRequest["category"]) {
  if (category === "petrol") return "Petrol Pump";
  if (category === "personal") return "Personal";
  return "Merchant";
}

function amountLabel(request: QrPaymentRequest) {
  if (!request.amount) return "Open amount";
  return request.asset === "USDT" ? `$${Number(request.amount).toFixed(2)}` : `${request.amount} ${request.asset}`;
}

export function QrPayModule() {
  const [request, setRequest] = useState<QrPaymentRequest | null>(initialRequest);
  const [result, setResult] = useState<"idle" | "success" | "failed">("idle");
  const [error, setError] = useState("");
  const addTransaction = useTransactionStore((state) => state.addTransaction);

  function applyPayload(value: string) {
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

  function cancel() {
    setRequest(null);
    setError("");
    setResult("idle");
  }

  if (result === "success" && request) {
    return (
      <Panel data-testid="qr-pay-screen" className="overflow-hidden">
        <div className="flex min-h-[32rem] flex-col items-center justify-center text-center">
          <motion.div initial={{ scale: 0.86, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative mb-7 flex h-28 w-28 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-mint/20" />
            <div className="absolute inset-3 animate-pulse rounded-full bg-mint/15" />
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-mint/40 bg-mint/15 text-mint shadow-[0_0_40px_rgba(46,213,115,0.25)]">
              <CheckCircle2 size={42} />
            </div>
          </motion.div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-mint">Payment success</p>
          <h1 className="mt-3 text-3xl font-semibold">{amountLabel(request)} paid</h1>
          <p className="mt-2 max-w-xs text-sm leading-6 text-slate-400">
            Your payment to {request.merchant} was confirmed on BSC.
          </p>
          <div className="mt-8 w-full rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4 text-left">
            <PaymentRow label="Merchant" value={request.merchant} />
            <PaymentRow label="Category" value={categoryLabel(request.category)} />
            <PaymentRow label="Network" value="BSC" />
            <PaymentRow label="Wallet" value={shortWallet(request.address)} />
          </div>
          <PrimaryButton className="mt-6 w-full" onClick={cancel} type="button">Done</PrimaryButton>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <Panel data-testid="qr-pay-screen">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo size="sm" />
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold">Scan & Pay</h1>
              <p className="text-sm text-slate-400">Scan a payment QR and review before paying.</p>
            </div>
          </div>
          <div className="rounded-2xl bg-accent p-3 text-black"><ScanLine size={24} /></div>
        </div>
        <QrScanner onScan={applyPayload} />
        {error ? <InvalidQrCard message={error} /> : null}
      </Panel>
      {request ? (
        <Panel>
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-3 text-accent">{request.category === "petrol" ? <Fuel size={22} /> : <QrCode size={22} />}</div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Payment request</p>
              <h2 className="mt-1 text-xl font-semibold">{request.merchant}</h2>
            </div>
          </div>
          <div className="rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
            <PaymentRow label="Merchant" value={request.merchant} />
            <PaymentRow label="Category" value={categoryLabel(request.category)} />
            <PaymentRow label="Network" value="BSC" />
            <PaymentRow label="Amount" value={amountLabel(request)} strong />
            <PaymentRow label="Wallet" value={shortWallet(request.address)} mono />
          </div>
          {result === "failed" || !ethers.isAddress(request.address) ? <div className="mt-4 flex items-center gap-2 rounded-2xl border border-danger/30 bg-danger/10 p-3 text-danger"><XCircle /> Add a valid merchant address and amount before confirming.</div> : null}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <SecondaryButton onClick={cancel} type="button">Cancel</SecondaryButton>
            <PrimaryButton onClick={confirm} type="button">Pay Now</PrimaryButton>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function PaymentRow({ label, value, strong = false, mono = false }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/10 py-3 last:border-b-0">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`${strong ? "text-lg font-semibold text-white" : "text-sm font-medium text-slate-100"} ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function InvalidQrCard({ message }: { message: string }) {
  return (
    <div className="mt-4 rounded-[1.25rem] border border-danger/30 bg-danger/10 p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-danger/15 p-2 text-danger">
          <XCircle size={22} />
        </div>
        <div>
          <h2 className="font-semibold text-red-100">Invalid QR code</h2>
          <p className="mt-1 text-sm leading-5 text-red-100/75">{message}</p>
        </div>
      </div>
    </div>
  );
}
