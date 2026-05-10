"use client";

import { CheckCircle2, Fuel, QrCode, ScanLine, XCircle } from "lucide-react";
import { useState } from "react";
import { Panel, PrimaryButton, Field, Select } from "@/components/ui/Primitives";
import { parseQrPayload, type QrPaymentRequest } from "@/services/qrPaymentProvider";
import { useTransactionStore } from "@/store/transactionStore";

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
  const [request, setRequest] = useState<QrPaymentRequest | null>(parseQrPayload(demoPayload));
  const [success, setSuccess] = useState(false);
  const [permission, setPermission] = useState<"idle" | "granted" | "denied">("idle");
  const addTransaction = useTransactionStore((state) => state.addTransaction);

  function confirm() {
    if (!request) return;
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
    setSuccess(true);
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Scan & Pay</h1>
            <p className="text-sm text-slate-400">Static and dynamic BSC QR payment flow</p>
          </div>
          <div className="rounded-2xl bg-accent p-3 text-black"><ScanLine size={24} /></div>
        </div>
        <div className="flex h-56 flex-col items-center justify-center rounded-[1.6rem] border border-dashed border-white/15 bg-black/25 text-center">
          <QrCode size={76} className="text-slate-500" />
          <button
            className="mt-4 rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-black"
            onClick={async () => {
              try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                stream.getTracks().forEach((track) => track.stop());
                setPermission("granted");
              } catch {
                setPermission("denied");
              }
            }}
            type="button"
          >
            Enable Camera
          </button>
          <p className="mt-2 text-xs text-slate-400">{permission === "granted" ? "Camera ready for scanner integration." : permission === "denied" ? "Camera denied. Use manual QR input." : "Camera permission required to scan."}</p>
        </div>
        <textarea className="field mt-4 min-h-24" value={raw} onChange={(event) => setRaw(event.target.value)} />
        <PrimaryButton className="mt-3 w-full" onClick={() => { setRequest(parseQrPayload(raw)); setSuccess(false); }} type="button">Parse QR</PrimaryButton>
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
            <Field value={request.address} onChange={(event) => setRequest({ ...request, address: event.target.value })} placeholder="Merchant BSC address" />
            <Field inputMode="decimal" value={request.amount} onChange={(event) => setRequest({ ...request, amount: event.target.value })} placeholder="Amount" />
            <Select value={request.asset} onChange={(event) => setRequest({ ...request, asset: event.target.value as "BNB" | "USDT" })}>
              <option value="USDT">USDT</option>
              <option value="BNB">BNB</option>
            </Select>
          </div>
          {success ? <div className="mt-4 flex items-center gap-2 text-mint"><CheckCircle2 /> Payment success</div> : null}
          {!request.address ? <div className="mt-4 flex items-center gap-2 text-danger"><XCircle /> Payment will fail until a merchant address is added.</div> : null}
          <PrimaryButton className="mt-4 w-full" onClick={confirm} type="button">Confirm Payment</PrimaryButton>
        </Panel>
      ) : null}
    </div>
  );
}
