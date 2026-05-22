"use client";

import { ChevronRight, ShieldCheck, Sparkles } from "lucide-react";
import type { HbProduct } from "@/services/halalBusinessService";

type PackageScene = "starter" | "growth" | "popular" | "automation" | "ai" | "enterprise";
type PackageVisualConfig = { from: string; mid: string; to: string; accent: string; label: string; scene: PackageScene };

export const hbPackageNames: Record<number, string> = {
  4: "Starter Package",
  20: "Growth Package",
  100: "Popular Package",
  500: "Automation Package",
  2500: "AI Business Package",
  12500: "Enterprise Package"
};

export const hbPackageBenefits: Record<number, string> = {
  4: "4 Business Idea Books",
  20: "20 Business Idea & Money Management Books + 700 Social Media Followers",
  100: "100 Story, Business Idea, Money Management Books + 4000 Social Media Followers",
  500: "All $100 features + WhatsApp Automatic Message Software",
  2500: "All $500 features + AI Calling Agent + Meta Auto Ads Run AI Software",
  12500: "All $2500 features + 3 Custom Software, Centralized or Decentralized"
};

export const hbPackageShortText: Record<number, string> = {
  4: "4 Books",
  20: "20 Books + 700 Followers",
  100: "100 Books + 4000 Followers",
  500: "WhatsApp Automation Software",
  2500: "AI Calling + Meta Ads AI",
  12500: "3 Custom Software"
};

export const hbPackageVisuals: Record<number, PackageVisualConfig> = {
  4: { from: "#38bdf8", mid: "#2563eb", to: "#0f172a", accent: "#7dd3fc", label: "4X", scene: "starter" },
  20: { from: "#c084fc", mid: "#7c3aed", to: "#1e1b4b", accent: "#d8b4fe", label: "20X", scene: "growth" },
  100: { from: "#facc15", mid: "#f59e0b", to: "#1e293b", accent: "#fde68a", label: "100", scene: "popular" },
  500: { from: "#34d399", mid: "#10b981", to: "#063b2b", accent: "#86efac", label: "WA", scene: "automation" },
  2500: { from: "#8b5cf6", mid: "#06b6d4", to: "#172554", accent: "#c4b5fd", label: "AI", scene: "ai" },
  12500: { from: "#f59e0b", mid: "#38bdf8", to: "#111827", accent: "#fde68a", label: "ENT", scene: "enterprise" }
};

export const hbPackageAmounts = [4, 20, 100, 500, 2500, 12500] as const;

export function money(value: unknown) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00";
}

export function featuresForHbPackageAmount(amount: unknown) {
  return (hbPackageBenefits[Number(amount)] || "Digital product package + Premium HB9 access + Dashboard tools").split("+").map((item) => item.trim()).filter(Boolean);
}

export function buildDefaultHbPackageProducts(): HbProduct[] {
  return hbPackageAmounts.map((amount, index) => ({
    id: `hb-package-${amount}`,
    title: `${money(amount)} ${hbPackageNames[amount]}`,
    slug: `hb-package-${amount}`,
    short_description: hbPackageShortText[amount],
    description: hbPackageBenefits[amount],
    package_id: `hb-package-${amount}`,
    package_price: amount,
    package_type: "activation",
    image_url: "",
    thumbnail_url: "",
    stock: 999,
    active: true,
    featured: index < 6,
    package_name: hbPackageNames[amount]
  }));
}

export function HbPackageProductCard({ product, cta, onBuy, compact = false }: { product: HbProduct; cta: string; onBuy: () => void; compact?: boolean }) {
  const amount = Number(product.package_price);
  const tierName = hbPackageNames[amount] || product.package_name || product.title;
  return (
    <div className={`hb-interactive hb-glow-gold group relative overflow-hidden rounded-[22px] border border-cyan-200/12 bg-[linear-gradient(155deg,rgba(8,37,68,0.78),rgba(3,14,29,0.92))] shadow-[0_0_16px_rgba(0,200,255,0.09),0_10px_26px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.055)] backdrop-blur-xl transition duration-250 hover:-translate-y-0.5 hover:border-cyan-200/18 hover:shadow-[0_0_20px_rgba(0,200,255,0.13),0_14px_32px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.07)] active:scale-[0.99] ${compact ? "p-2.5" : "p-3"}`}>
      <div className="absolute right-[-2.5rem] top-[-2.5rem] h-24 w-24 rounded-full bg-cyan-300/12 blur-2xl" />
      <div className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/40 to-transparent" />
      <div className={compact ? "space-y-3" : "flex gap-3"}>
        <HbPackageVisual amount={amount} size={compact ? "wide" : "md"} />
        <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-1.5">
              <h3 className={`${compact ? "min-h-8 text-[11.5px] leading-4" : "text-sm leading-4"} line-clamp-2 font-black tracking-normal text-white`}>{money(amount)} {tierName.replace(/ Package$/, "")}</h3>
              <ShieldCheck className="mt-0.5 shrink-0 text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.55)]" size={14} />
            </div>
            <p className={`${compact ? "min-h-[28px]" : ""} mt-1 line-clamp-2 text-[10px] font-medium leading-[14px] text-sky-100/62`}>{hbPackageShortText[amount] || hbPackageBenefits[amount] || product.short_description || product.package_name}</p>
          </div>
          <div className="mt-2 flex items-center justify-center">
            <button className="hb-interactive hb-glow-gold w-full rounded-[0.85rem] bg-gradient-to-r from-cyan-200 via-cyan-300 to-sky-500 px-2.5 py-1.5 text-[10px] font-black text-[#03111f] shadow-[0_0_16px_rgba(34,211,238,0.24),inset_0_1px_0_rgba(255,255,255,0.35)] transition duration-200 hover:shadow-[0_0_22px_rgba(34,211,238,0.34)] active:scale-95" onClick={onBuy} disabled={product.stock <= 0} type="button">{product.stock <= 0 ? "Out" : cta}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HbPackageListItem({ product, onBuy }: { product: HbProduct; onBuy: () => void }) {
  const amount = Number(product.package_price);
  const title = `${money(amount)} ${hbPackageNames[amount] || product.package_name || product.title}`;
  return (
    <div className="hb-interactive hb-glow-gold flex w-full items-center gap-2.5 rounded-[22px] border border-cyan-200/14 bg-[linear-gradient(145deg,rgba(8,34,64,0.8),rgba(3,14,29,0.93))] p-2.5 text-left shadow-[0_0_18px_rgba(0,200,255,0.09),0_12px_26px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.06)] transition duration-200 hover:-translate-y-0.5 hover:border-cyan-200/22 hover:shadow-[0_0_22px_rgba(0,200,255,0.14)]">
      <HbPackageVisual amount={amount} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <h3 className="truncate font-semibold">{title}</h3>
          <span className="shrink-0 text-lg font-black text-cyan-100"><Sparkles size={16} /></span>
        </div>
        <p className="mt-0.5 line-clamp-1 text-[11px] text-sky-100/58">{hbPackageShortText[amount] || featuresForHbPackageAmount(amount).join(" + ")}</p>
        <button className="hb-interactive hb-glow-gold mt-2 rounded-[0.9rem] bg-gradient-to-r from-cyan-200 via-cyan-300 to-sky-500 px-3 py-1.5 text-[11px] font-black text-[#03111f] shadow-[0_0_16px_rgba(34,211,238,0.22),inset_0_1px_0_rgba(255,255,255,0.34)] transition duration-200 active:scale-95" onClick={onBuy} disabled={product.stock <= 0} type="button">{product.stock <= 0 ? "Out" : "Buy with USDT"}</button>
      </div>
      <button className="hb-interactive hb-glow-cyan grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-200/10 bg-cyan-300/8 text-cyan-100/70" onClick={onBuy} type="button" aria-label={`Open ${title}`}>
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

export function HbAllPackagesList({ products, onBuy }: { products: HbProduct[]; onBuy: (product: HbProduct) => void }) {
  return (
    <div className="space-y-2.5">
      {products.map((product) => <HbPackageListItem key={product.id} product={product} onBuy={() => onBuy(product)} />)}
    </div>
  );
}

export function HbPackageVisual({ amount: rawAmount, size }: { amount: unknown; size: "sm" | "md" | "wide" }) {
  const amount = Number(rawAmount);
  const visual = hbPackageVisuals[amount] || hbPackageVisuals[4];
  const isWide = size === "wide";
  const frameClass = size === "sm" ? "h-12 w-12 rounded-xl" : isWide ? "h-20 w-full rounded-[1rem]" : "h-20 w-20 rounded-[1rem]";
  return (
    <div className={`relative grid shrink-0 place-items-center overflow-hidden border border-cyan-200/12 bg-[#061a31]/88 shadow-[0_0_16px_rgba(0,200,255,0.12),inset_0_1px_0_rgba(255,255,255,0.06)] ${frameClass}`}>
      <div className="absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" />
      <div className="absolute inset-0 opacity-95" style={{ background: `radial-gradient(circle at 52% 34%, ${visual.accent}4d, transparent 42%), radial-gradient(circle at 50% 12%, ${visual.accent}36, transparent 54%), radial-gradient(circle at 90% 80%, ${visual.mid}24, transparent 40%), linear-gradient(145deg, ${visual.to}, #020817)` }} />
      <svg className="relative z-10 h-[108%] w-[108%] drop-shadow-[0_12px_20px_rgba(0,0,0,0.38)]" viewBox="0 0 140 110" fill="none" aria-hidden="true" shapeRendering="geometricPrecision">
        <defs>
          <linearGradient id={`pkg-cover-${amount}`} x1="20" y1="18" x2="84" y2="92" gradientUnits="userSpaceOnUse"><stop stopColor={visual.from} /><stop offset=".5" stopColor={visual.mid} /><stop offset="1" stopColor={visual.to} /></linearGradient>
          <linearGradient id={`pkg-glass-${amount}`} x1="66" y1="10" x2="122" y2="78" gradientUnits="userSpaceOnUse"><stop stopColor="#ffffff" stopOpacity=".48" /><stop offset=".35" stopColor={visual.accent} stopOpacity=".16" /><stop offset="1" stopColor="#020817" stopOpacity=".18" /></linearGradient>
          <radialGradient id={`pkg-glow-${amount}`} cx="0" cy="0" r="1" gradientTransform="matrix(48 42 -42 48 78 30)" gradientUnits="userSpaceOnUse"><stop stopColor={visual.accent} stopOpacity=".72" /><stop offset=".46" stopColor={visual.mid} stopOpacity=".22" /><stop offset="1" stopColor={visual.to} stopOpacity="0" /></radialGradient>
        </defs>
        <ellipse cx="70" cy="95" rx="54" ry="8" fill={visual.mid} opacity=".2" />
        <circle cx="104" cy="22" r="22" fill={`url(#pkg-glow-${amount})`} opacity=".78" />
        <path d="M12 20h18M110 18h16M11 86h18M113 88h15" stroke={visual.accent} strokeOpacity=".36" strokeWidth="1.35" strokeLinecap="round" />
        <circle cx="16" cy="36" r="1.6" fill={visual.accent} opacity=".85" />
        <circle cx="123" cy="68" r="1.5" fill={visual.accent} opacity=".62" />
        <PackageBundleScene scene={visual.scene} amount={amount} visual={visual} />
      </svg>
    </div>
  );
}

function PackageBundleScene({ scene, amount, visual }: { scene: PackageScene; amount: number; visual: PackageVisualConfig }) {
  const bookCount = scene === "starter" ? 4 : scene === "growth" ? 5 : scene === "popular" ? 7 : scene === "enterprise" ? 4 : 3;
  const isSoftware = amount >= 500;
  const tag = scene === "automation" ? "CHAT" : scene === "ai" ? "AI" : scene === "enterprise" ? "VAULT" : "EBOOK";
  return (
    <g>
      <g opacity=".38">
        <path d="M25 78c18-16 49-16 68 0M35 68c11-8 31-8 42 0" stroke={visual.accent} strokeWidth="1.1" strokeLinecap="round" />
        <path d="M94 37h18l8 7v25H94V37Z" fill="#020817" stroke={visual.accent} strokeOpacity=".22" />
      </g>
      <ellipse cx="54" cy="91" rx="34" ry="6" fill="#020817" opacity=".42" />
      {Array.from({ length: bookCount }).map((_, index) => (
        <g key={index} transform={`translate(${22 + index * 6.4} ${48 - index * 2.7}) rotate(-7)`}>
          <path d="M3 46h21l-6 6H8L3 46Z" fill="#020817" fillOpacity=".36" />
          <path d="M0 0h18l6 5v43H6L0 43V0Z" fill={`url(#pkg-cover-${amount})`} stroke="#fff" strokeOpacity=".32" strokeWidth=".85" />
          <path d="M18 0v43l6 5V5L18 0Z" fill="#020817" fillOpacity=".48" />
          <path d="M0 0 6 5h18L18 0H0Z" fill="#fff" fillOpacity=".26" />
          <path d="M2 2h4v41H2V2Z" fill="#fff" fillOpacity=".12" />
          <rect x="4" y="8" width="11" height="2.2" rx="1.1" fill="#fff" opacity=".72" />
          <rect x="4" y="14" width="8" height="1.8" rx=".9" fill="#fff" opacity=".38" />
          <rect x="4" y="31" width="10" height="7" rx="1.5" fill="#020817" fillOpacity=".28" stroke="#fff" strokeOpacity=".18" />
          <path d="M4 24h11" stroke={visual.accent} strokeOpacity=".42" strokeWidth=".9" strokeLinecap="round" />
        </g>
      ))}
      <g transform="translate(78 24)">
        <path d="M7 51h38l-11 8H18L7 51Z" fill="#020817" fillOpacity=".34" />
        <path d="M0 0h33l12 9v45H12L0 45V0Z" fill={isSoftware ? "#031326" : `url(#pkg-cover-${amount})`} stroke={visual.accent} strokeOpacity=".55" strokeWidth="1.2" />
        <path d="M33 0v45l12 9V9L33 0Z" fill={visual.mid} fillOpacity={isSoftware ? ".34" : ".55"} />
        <path d="M0 0 12 9h33L33 0H0Z" fill={`url(#pkg-glass-${amount})`} />
        <path d="M4 4h5v41H4V4Z" fill="#fff" fillOpacity=".1" />
        <rect x="7" y="10" width="22" height="3" rx="1.5" fill="#fff" opacity=".78" />
        <rect x="7" y="17" width="16" height="2.4" rx="1.2" fill="#fff" opacity=".36" />
        <rect x="7" y="27" width="25" height="12" rx="2.5" fill="#020817" fillOpacity=".48" stroke={visual.accent} strokeOpacity=".35" />
        <path d="M10 35h6l4-5 5 4h5" stroke={visual.accent} strokeOpacity=".72" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" />
        <text x="9" y="50" fill="#fff" fontSize="7" fontWeight="900" letterSpacing=".6">{tag}</text>
      </g>
      <g transform="translate(83 14)" opacity=".96">
        <rect width="42" height="25" rx="4" fill="#020817" fillOpacity=".68" stroke={visual.accent} strokeOpacity=".55" />
        {scene === "starter" ? <g><circle cx="12" cy="12" r="5" fill={visual.accent} opacity=".55" /><path d="M6 22c3-6 9-6 12 0M22 8h12M22 14h8M22 20h13" stroke="#BAF2FF" strokeWidth="1.5" strokeLinecap="round" /></g> : null}
        {scene === "growth" ? <g><path d="M7 19 16 10l8 5 11-10" stroke="#D8B4FE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><path d="M8 22h28" stroke="#fff" strokeOpacity=".28" strokeWidth="1" /></g> : null}
        {scene === "popular" ? <g><path d="M21 5 25 13l9 1-7 5 2 9-8-5-8 5 2-9-7-5 9-1 4-8Z" fill="#FDE68A" /><path d="M5 21h8M30 21h7" stroke="#fff" strokeOpacity=".45" strokeWidth="1.4" strokeLinecap="round" /></g> : null}
        {scene === "automation" ? <g><path d="M8 17c4-9 13-10 17-3 3 5 6 6 10 1" stroke="#86EFAC" strokeWidth="2" strokeLinecap="round" /><circle cx="11" cy="9" r="3" fill="#86EFAC" opacity=".75" /><path d="M17 8h17" stroke="#fff" strokeOpacity=".45" strokeWidth="1.5" strokeLinecap="round" /></g> : null}
        {scene === "ai" ? <g><path d="M12 19v-8h18v8M16 11V8h10v3M16 16h.1M26 16h.1M20 21h4" stroke="#E0F2FE" strokeWidth="1.7" strokeLinecap="round" /><circle cx="34" cy="7" r="3" fill="#C4B5FD" opacity=".7" /></g> : null}
        {scene === "enterprise" ? <g><path d="M9 20h24M12 16h18M15 12h12M18 8h6" stroke="#FDE68A" strokeWidth="1.8" strokeLinecap="round" /><rect x="6" y="6" width="30" height="17" rx="3" stroke="#FDE68A" strokeOpacity=".38" /></g> : null}
      </g>
      <g opacity=".58">
        <path d="M104 49h16l7 6v24h-23V49Z" fill="#020817" stroke={visual.accent} strokeOpacity=".34" />
        <path d="M120 49v24l7 6V55l-7-6Z" fill={visual.mid} fillOpacity=".22" />
        <path d="M108 58h9M108 64h13M108 70h8" stroke={visual.accent} strokeOpacity=".58" strokeWidth="1.05" strokeLinecap="round" />
      </g>
      <g transform="translate(20 82)">
        <rect width="58" height="12" rx="6" fill="#020817" fillOpacity=".58" stroke={visual.accent} strokeOpacity=".32" />
        <text x="8" y="8.8" fill="#fff" fontSize="7.5" fontWeight="900" letterSpacing=".4">{visual.label}</text>
        <text x="28" y="8.8" fill={visual.accent} fontSize="6.5" fontWeight="800" opacity=".95">{isSoftware ? "SOFTWARE KIT" : "DIGITAL BUNDLE"}</text>
      </g>
    </g>
  );
}
