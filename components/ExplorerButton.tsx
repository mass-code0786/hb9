"use client";

import { ExternalLink } from "lucide-react";

type ExplorerButtonProps = {
  baseUrl?: string | null;
  type: "tx" | "wallet" | "contract";
  value?: string | null;
  label?: string;
  compact?: boolean;
};

export function explorerUrl(baseUrl: string | null | undefined, type: ExplorerButtonProps["type"], value: string | null | undefined) {
  if (!baseUrl || !value) return "";
  const cleanBase = baseUrl.replace(/\/$/, "");
  const path = type === "tx" ? "tx" : "address";
  return `${cleanBase}/${path}/${value}`;
}

export function ExplorerButton({ baseUrl = "https://bscscan.com", type, value, label, compact = false }: ExplorerButtonProps) {
  const href = explorerUrl(baseUrl, type, value);
  if (!href) return <span className="text-xs text-slate-500">Explorer pending</span>;
  return (
    <a
      className={`tap-feedback inline-flex items-center justify-center gap-1 rounded-xl border border-accent/25 bg-accent/10 font-semibold text-accent hover:bg-accent/15 ${compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"}`}
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label || (type === "tx" ? "Open transaction in BscScan" : type === "contract" ? "Open contract in BscScan" : "Open wallet in BscScan")}
    >
      <ExternalLink size={compact ? 13 : 15} />
      {label || (type === "tx" ? "Open tx" : type === "contract" ? "Open contract" : "Open wallet")}
    </a>
  );
}
