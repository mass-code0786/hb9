"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ShieldAlert } from "lucide-react";
import { fetchPublicHbProof, type PublicHbProof } from "@/services/halalBusinessService";
import { Panel } from "@/components/ui/Primitives";
import { HalalBusinessLogo } from "@/components/brand/HalalBusinessLogo";

export default function ProofPage({ params }: { params: { referenceId: string } }) {
  const [proof, setProof] = useState<PublicHbProof | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPublicHbProof(params.referenceId)
      .then(setProof)
      .catch((err) => setError(err instanceof Error ? err.message : "Proof could not be loaded."));
  }, [params.referenceId]);

  const verified = proof?.verification_status === "verified";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-5 text-slate-50">
      <div className="mb-5">
        <HalalBusinessLogo size="lg" showText />
        <div className="mt-3 text-xs uppercase tracking-[0.16em] text-accent">Public Proof Verification</div>
      </div>
      <Panel>
        {error ? <div className="rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-red-100">{error}</div> : null}
        {!proof && !error ? <p className="text-sm text-slate-300">Verifying proof...</p> : null}
        {proof ? (
          <div>
            <div className="mb-5 flex items-start gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full border ${verified ? "border-mint/30 bg-mint/10 text-mint" : "border-danger/30 bg-danger/10 text-red-100"}`}>
                {verified ? <CheckCircle2 size={26} /> : <ShieldAlert size={26} />}
              </div>
              <div>
                <h1 className="text-2xl font-semibold">{proof.public_reference_id}</h1>
                <p className="mt-1 text-sm capitalize text-slate-400">{proof.verification_status}</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ProofRow label="Proof hash" value={proof.proof_hash} mono />
              <ProofRow label="Previous proof hash" value={proof.previous_proof_hash || "Genesis"} mono />
              <ProofRow label="Ledger type" value={proof.ledger_type} />
              <ProofRow label="Amount" value={`$${Number(proof.amount_usd || 0).toFixed(2)}`} />
              <ProofRow label="Masked user" value={proof.masked_user_id || "HB9-COMPANY"} />
              <ProofRow label="Chain reference" value={proof.chain_reference || "not_applicable"} />
              <ProofRow label="Tx hash" value={proof.tx_hash || "No on-chain mirror"} mono />
              <ProofRow label="Created" value={new Date(proof.created_at).toLocaleString()} />
            </div>
            {proof.explorer_url ? <a className="mt-5 inline-flex rounded-2xl border border-accent/25 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent" href={proof.explorer_url} target="_blank" rel="noreferrer">Open Explorer</a> : null}
          </div>
        ) : null}
      </Panel>
    </main>
  );
}

function ProofRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-2xl border border-sky-200/10 bg-[#0b1728]/70 p-3">
      <div className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className={`mt-2 break-all text-sm font-semibold text-slate-100 ${mono ? "font-mono text-xs" : ""}`}>{value}</div>
    </div>
  );
}
