import type { WalletToken } from "@/types/wallet";

const tokenIconMap: Record<string, { label: string; className: string }> = {
  BNB: { label: "BNB", className: "bg-[#f3ba2f] text-black" },
  USDT: { label: "USDT", className: "bg-[#26a17b] text-white" },
  USDC: { label: "USDC", className: "bg-[#2775ca] text-white" },
  ETH: { label: "ETH", className: "bg-[#627eea] text-white" },
  MATIC: { label: "POL", className: "bg-[#8247e5] text-white" },
  TRX: { label: "TRX", className: "bg-[#ff060a] text-white" },
  BTC: { label: "BTC", className: "bg-[#f7931a] text-black" },
  AVAX: { label: "AVAX", className: "bg-[#e84142] text-white" },
  ARB: { label: "ARB", className: "bg-[#28a0f0] text-white" },
  OP: { label: "OP", className: "bg-[#ff0420] text-white" }
};

function tokenIconKey(token: Pick<WalletToken, "symbol" | "network">) {
  if (token.network === "arbitrum") return "ARB";
  if (token.network === "optimism") return "OP";
  return token.symbol.toUpperCase();
}

export function TokenIcon({ token, size = "md" }: { token: WalletToken; size?: "md" | "lg" }) {
  const mapped = tokenIconMap[tokenIconKey(token)];
  const fallbackLabel = token.symbol.trim().slice(0, 1).toUpperCase() || "?";
  const sizeClass = size === "lg" ? "h-14 w-14 text-xs" : "h-10 w-10 text-[10px]";

  if (mapped) {
    return (
      <span className={`flex shrink-0 items-center justify-center rounded-full font-bold shadow-[0_0_18px_rgba(255,255,255,0.08)] ${sizeClass} ${mapped.className}`}>
        {mapped.label}
      </span>
    );
  }

  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full font-bold text-black shadow-[0_0_18px_rgba(255,255,255,0.08)] ${sizeClass}`} style={{ backgroundColor: token.color || "#31d0aa" }}>
      {fallbackLabel}
    </span>
  );
}
