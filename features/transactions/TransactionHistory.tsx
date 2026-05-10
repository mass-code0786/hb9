"use client";

import { ExternalLink } from "lucide-react";
import { Panel } from "@/components/ui/Primitives";
import { BSCSCAN_URL } from "@/lib/config";
import type { WalletTransaction } from "@/types/wallet";
import { timeAgo } from "@/utils/format";

export function TransactionHistory({ transactions }: { transactions: WalletTransaction[] }) {
  return (
    <Panel>
      <h1 className="mb-4 text-2xl font-semibold">Transaction History</h1>
      <div className="space-y-3">
        {transactions.map((tx) => (
          <div key={tx.id} className="rounded-2xl bg-white/[0.045] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{tx.title}</div>
                <div className="mt-1 text-xs text-slate-400">{timeAgo(tx.createdAt)} | Gas: {tx.gasFee || "Estimated before send"}</div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs ${tx.status === "success" ? "bg-mint/10 text-mint" : tx.status === "failed" ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent"}`}>{tx.status}</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span>{tx.amount} {tx.asset}</span>
              {tx.hash ? (
                <a className="flex items-center gap-1 text-accent" href={`${BSCSCAN_URL}/tx/${tx.hash}`} target="_blank" rel="noreferrer">Explorer <ExternalLink size={14} /></a>
              ) : <span className="text-slate-500">No hash</span>}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
