import type { WalletToken } from "@/types/wallet";

type IconSpec = {
  label: string;
  bg: string;
  fg: string;
  mark?: "diamond" | "coin" | "ring" | "bolt" | "layers" | "triangle" | "hex" | "op";
};

const tokenIconMap: Record<string, IconSpec> = {
  BNB: { label: "BNB", bg: "#f3ba2f", fg: "#111827", mark: "diamond" },
  USDT: { label: "USDT", bg: "#26a17b", fg: "#ffffff", mark: "coin" },
  USDC: { label: "USDC", bg: "#2775ca", fg: "#ffffff", mark: "ring" },
  ETH: { label: "ETH", bg: "#627eea", fg: "#ffffff", mark: "diamond" },
  MATIC: { label: "MATIC", bg: "#8247e5", fg: "#ffffff", mark: "layers" },
  TRX: { label: "TRX", bg: "#ff060a", fg: "#ffffff", mark: "triangle" },
  BTC: { label: "BTC", bg: "#f7931a", fg: "#111827", mark: "coin" },
  AVAX: { label: "AVAX", bg: "#e84142", fg: "#ffffff", mark: "triangle" },
  ARB: { label: "ARB", bg: "#28a0f0", fg: "#ffffff", mark: "hex" },
  OP: { label: "OP", bg: "#ff0420", fg: "#ffffff", mark: "op" }
};

function tokenIconKey(token: Pick<WalletToken, "symbol" | "network">) {
  if (token.network === "arbitrum") return "ARB";
  if (token.network === "optimism") return "OP";
  return token.symbol.toUpperCase();
}

export function TokenIcon({ token, size = "md" }: { token: WalletToken; size?: "md" | "lg" }) {
  const mapped = tokenIconMap[tokenIconKey(token)];
  const fallbackLabel = token.symbol.trim().slice(0, 2).toUpperCase() || "?";
  const sizeClass = size === "lg" ? "h-14 w-14" : "h-10 w-10";
  const spec = mapped || { label: fallbackLabel, bg: token.color || "#31d0aa", fg: "#061015", mark: "coin" as const };

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_0_20px_rgba(0,0,0,0.22)] ${sizeClass}`}
      style={{ background: `radial-gradient(circle at 30% 20%, rgba(255,255,255,0.35), transparent 0.7rem), ${spec.bg}` }}
      aria-label={`${token.symbol} token icon`}
    >
      <TokenMark spec={spec} large={size === "lg"} />
      <span className={`${size === "lg" ? "text-[0.58rem]" : "text-[0.48rem]"} absolute bottom-1 rounded-full bg-black/20 px-1.5 font-bold leading-4 tracking-normal`} style={{ color: spec.fg }}>
        {mapped ? spec.label : fallbackLabel}
      </span>
    </span>
  );
}

function TokenMark({ spec, large }: { spec: IconSpec; large: boolean }) {
  const stroke = spec.fg;
  const width = large ? 32 : 24;
  const height = large ? 32 : 24;
  const common = { fill: "none", stroke, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  if (spec.mark === "diamond") {
    return (
      <svg width={width} height={height} viewBox="0 0 32 32" aria-hidden="true">
        <path {...common} d="M16 4 25 16 16 28 7 16 16 4Z" />
        <path {...common} d="M10 16h12M16 4v24" />
      </svg>
    );
  }
  if (spec.mark === "ring") {
    return (
      <svg width={width} height={height} viewBox="0 0 32 32" aria-hidden="true">
        <circle {...common} cx="16" cy="16" r="10" />
        <path {...common} d="M20 10a7 7 0 1 0 0 12" />
      </svg>
    );
  }
  if (spec.mark === "bolt") {
    return (
      <svg width={width} height={height} viewBox="0 0 32 32" aria-hidden="true">
        <path {...common} d="M18 3 7 18h8l-1 11 11-16h-8l1-10Z" />
      </svg>
    );
  }
  if (spec.mark === "layers") {
    return (
      <svg width={width} height={height} viewBox="0 0 32 32" aria-hidden="true">
        <path {...common} d="m8 14 8-5 8 5-8 5-8-5Z" />
        <path {...common} d="m8 19 8 5 8-5" />
      </svg>
    );
  }
  if (spec.mark === "triangle") {
    return (
      <svg width={width} height={height} viewBox="0 0 32 32" aria-hidden="true">
        <path {...common} d="M16 5 27 25H5L16 5Z" />
        <path {...common} d="m13 19 3-5 3 5" />
      </svg>
    );
  }
  if (spec.mark === "hex") {
    return (
      <svg width={width} height={height} viewBox="0 0 32 32" aria-hidden="true">
        <path {...common} d="m16 4 10 6v12l-10 6-10-6V10l10-6Z" />
        <path {...common} d="M11 20h10" />
      </svg>
    );
  }
  if (spec.mark === "op") {
    return (
      <svg width={width} height={height} viewBox="0 0 32 32" aria-hidden="true">
        <path {...common} d="M8 17c0-4 2.7-7 6.5-7s6.5 3 6.5 7-2.7 7-6.5 7S8 21 8 17Z" />
        <path {...common} d="M22 12h3c2 0 3 1 3 2.7s-1 2.8-3 2.8h-3" />
      </svg>
    );
  }

  return (
    <svg width={width} height={height} viewBox="0 0 32 32" aria-hidden="true">
      <circle {...common} cx="16" cy="16" r="10" />
      <path {...common} d="M16 9v14M11 13h8a3 3 0 0 1 0 6h-8" />
    </svg>
  );
}
