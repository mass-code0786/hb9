import { useId } from "react";

type HB9LogoProps = {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg" | number;
};

const markSizes = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-14 w-14"
};

const textSizes = {
  sm: "text-base",
  md: "text-lg",
  lg: "text-2xl"
};

function sizeClass(size: HB9LogoProps["size"]) {
  return typeof size === "number" ? "" : markSizes[size || "md"];
}

function textSizeClass(size: HB9LogoProps["size"]) {
  return typeof size === "number" ? "text-lg" : textSizes[size || "md"];
}

export function HB9Logo({
  className = "",
  markClassName = "",
  textClassName = "",
  showText = true,
  size = "md"
}: HB9LogoProps) {
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const outer = `hb9-outer-${rawId}`;
  const glass = `hb9-glass-${rawId}`;
  const glow = `hb9-glow-${rawId}`;
  const numericSize = typeof size === "number" ? { width: size, height: size } : undefined;

  return (
    <div className={`inline-flex min-w-0 items-center gap-3 ${className}`} aria-label="HB9">
      <span
        className={`relative inline-grid shrink-0 place-items-center ${sizeClass(size)} ${markClassName}`}
        style={numericSize}
        aria-hidden="true"
      >
        <span className="absolute inset-[-6%] rounded-full bg-cyan-300/10 blur-sm" />
        <svg className="relative h-full w-full drop-shadow-[0_0_7px_rgba(0,200,255,0.26)]" viewBox="0 0 72 72" role="img" shapeRendering="geometricPrecision" textRendering="geometricPrecision">
          <defs>
            <linearGradient id={outer} x1="12" x2="60" y1="6" y2="66" gradientUnits="userSpaceOnUse">
              <stop stopColor="#E0F8FF" />
              <stop offset="0.34" stopColor="#22D3EE" />
              <stop offset="0.72" stopColor="#2563EB" />
              <stop offset="1" stopColor="#00C8FF" />
            </linearGradient>
            <linearGradient id={glass} x1="18" x2="55" y1="13" y2="59" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0F3457" />
              <stop offset="0.48" stopColor="#071827" />
              <stop offset="1" stopColor="#020817" />
            </linearGradient>
            <radialGradient id={glow} cx="0" cy="0" r="1" gradientTransform="matrix(24 24 -24 24 26 18)" gradientUnits="userSpaceOnUse">
              <stop stopColor="#BAF2FF" stopOpacity="0.62" />
              <stop offset="0.42" stopColor="#38BDF8" stopOpacity="0.2" />
              <stop offset="1" stopColor="#020817" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path d="M36 5.8 60.2 19.8v28L36 61.8 11.8 47.8v-28L36 5.8Z" fill="#020817" stroke={`url(#${outer})`} strokeWidth="2.05" strokeLinejoin="round" />
          <path d="M36 11.4 55.3 22.6v22.8L36 56.6 16.7 45.4V22.6L36 11.4Z" fill={`url(#${glass})`} stroke="#7DD3FC" strokeOpacity="0.36" strokeWidth="0.95" />
          <path d="M36 10.5 56.9 22.6v24.1L36 58.8 15.1 46.7V22.6L36 10.5Z" fill={`url(#${glow})`} />
          <path d="M20.9 24.4 36 15.7l15.1 8.7M20.9 47.6 36 56.3l15.1-8.7M16.7 34.7h7.9M47.4 34.7h7.9" stroke="#67E8F9" strokeOpacity="0.34" strokeWidth="1.05" strokeLinecap="round" />
          <path d="M20 23.8h8.2M20 48.2h8.2M43.8 23.8H52M43.8 48.2H52" stroke="#BAF2FF" strokeOpacity="0.22" strokeWidth="0.8" strokeLinecap="round" />
          <path d="M21.2 20.9C26 15.9 31.2 13.4 36 13.4c4.9 0 10 2.5 14.8 7.5H21.2Z" fill="#E0F8FF" opacity="0.08" />
          <text x="35.8" y="42.7" textAnchor="middle" fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif" fontSize="18.2" fontWeight="900" letterSpacing="0.9" fill="#F8FEFF">HB9</text>
          <text x="35.8" y="42.7" textAnchor="middle" fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif" fontSize="18.2" fontWeight="900" letterSpacing="0.9" fill="none" stroke="#67E8F9" strokeOpacity="0.22" strokeWidth="0.55">HB9</text>
          <circle cx="21.2" cy="24.4" r="1.15" fill="#BAF2FF" />
          <circle cx="50.8" cy="47.6" r="1.15" fill="#38BDF8" />
        </svg>
      </span>
      {showText ? (
        <span className={`min-w-0 truncate font-black leading-tight tracking-normal text-slate-50 ${textSizeClass(size)} ${textClassName}`}>
          HB9
        </span>
      ) : null}
    </div>
  );
}
