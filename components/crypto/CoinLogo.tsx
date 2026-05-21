"use client";

import { useId } from "react";

type CoinLogoProps = {
  symbol: string;
  size?: number;
  className?: string;
};

function normalizedSymbol(symbol: string) {
  const value = symbol.toUpperCase();
  if (value === "SHIBA") return "SHIB";
  if (value === "BTCT") return "BTTC";
  return value;
}

export function CoinLogo({ symbol, size = 40, className = "" }: CoinLogoProps) {
  const hb9GlowId = `hb9-coin-glow-${useId().replace(/:/g, "")}`;
  const coin = normalizedSymbol(symbol);
  const style = { width: size, height: size };
  const common = `shrink-0 drop-shadow-[0_0_14px_rgba(34,211,238,0.22)] ${className}`;

  if (coin === "USDT") {
    return (
      <svg viewBox="0 0 64 64" style={style} className={common} aria-hidden="true" role="img">
        <circle cx="32" cy="32" r="31" fill="#26A17B" />
        <path fill="#fff" d="M49.6 16.5H14.4v8.3h13.2v5.8C16.9 31.1 8.8 33.2 8.8 35.8c0 2.7 8.1 4.8 18.8 5.3v15.7h8.8V41.1c10.7-.5 18.8-2.6 18.8-5.3 0-2.6-8.1-4.7-18.8-5.2v-5.8h13.2v-8.3ZM32 38c-11.5 0-20.8-1.6-20.8-3.5 0-1.7 7-3 16.4-3.4v5.4c1.4.1 2.9.2 4.4.2s3-.1 4.4-.2v-5.4c9.4.4 16.4 1.7 16.4 3.4C52.8 36.4 43.5 38 32 38Z" />
      </svg>
    );
  }

  if (coin === "BTC") {
    return (
      <svg viewBox="0 0 64 64" style={style} className={common} aria-hidden="true" role="img">
        <circle cx="32" cy="32" r="31" fill="#F7931A" />
        <circle cx="32" cy="32" r="25" fill="#F8B13D" opacity=".55" />
        <path fill="#fff" d="M42.9 27.9c.7-4.7-2.9-7.2-7.7-8.9l1.6-6.3-3.8-1-1.5 6.1c-1-.3-2-.5-3-.7l1.5-6.2-3.8-1-1.6 6.3-6.2-1.6-1 4.1s2.9.7 2.8.7c1.6.4 1.9 1.5 1.8 2.4l-4.3 17.1c-.2.5-.7 1.3-1.8 1 0 .1-2.8-.7-2.8-.7l-1.8 4.4 6.1 1.5-1.6 6.4 3.8 1 1.6-6.3c1 .3 2 .5 3 .8l-1.6 6.3 3.8 1 1.6-6.4c6.5 1.2 11.3.7 13.3-5.1 1.6-4.7-.1-7.4-3.5-9.2 2.5-.5 4.4-2.2 5.1-5.7Zm-9.1 12.4c-1.2 4.7-9.2 2.1-11.8 1.5l2.1-8.5c2.6.7 10.9 2 9.7 7Zm1.2-12.5c-1.1 4.3-7.8 2.1-10 1.5l1.9-7.7c2.2.6 9.2 1.7 8.1 6.2Z" />
      </svg>
    );
  }

  if (coin === "BNB") {
    return (
      <svg viewBox="0 0 64 64" style={style} className={common} aria-hidden="true" role="img">
        <circle cx="32" cy="32" r="31" fill="#0B0F19" />
        <circle cx="32" cy="32" r="25" fill="#151A24" />
        <path fill="#F3BA2F" d="m32 10.5 7.3 7.3-4.2 4.2-3.1-3.1-3.1 3.1-4.2-4.2 7.3-7.3Zm-14.2 14.2 4.2 4.2-3.1 3.1 3.1 3.1-4.2 4.2-7.3-7.3 7.3-7.3Zm28.4 0 7.3 7.3-7.3 7.3-4.2-4.2 3.1-3.1-3.1-3.1 4.2-4.2ZM32 24.7l7.3 7.3-7.3 7.3-7.3-7.3 7.3-7.3Zm-3.1 17.3 3.1 3.1 3.1-3.1 4.2 4.2-7.3 7.3-7.3-7.3 4.2-4.2Z" />
        <path fill="#F8D33A" d="m32 28.9 3.1 3.1-3.1 3.1-3.1-3.1 3.1-3.1Z" />
      </svg>
    );
  }

  if (coin === "HB9") {
    return (
      <svg viewBox="0 0 64 64" style={style} className={common} aria-hidden="true" role="img">
        <defs>
          <filter id={hb9GlowId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.04 0 0 0 0 0.75 0 0 0 0 1 0 0 0 0.85 0" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path fill="#38BDF8" d="M32 2.8 56.7 17v30L32 61.2 7.3 47V17L32 2.8Z" />
        <path fill="#155EEF" d="M32 6.7 53.2 19v25.9L32 57.3 10.8 44.9V19L32 6.7Z" />
        <path fill="#061426" d="M32 11.6 49 21.4v21.2l-17 9.8-17-9.8V21.4l17-9.8Z" />
        <path fill="#0B2440" d="M32 15.6 45.6 23.4v17.2L32 48.4l-13.6-7.8V23.4L32 15.6Z" />
        <path fill="#67E8F9" d="M18.5 21.5 32 13.7l13.5 7.8-2 3.4L32 18.2 20.5 24.9l-2-3.4ZM20.5 39.1 32 45.8l11.5-6.7 2 3.4L32 50.3l-13.5-7.8 2-3.4Z" opacity=".9" />
        <path fill="#38BDF8" d="M22.4 23.7 32 18.1l9.6 5.6v16.6L32 45.9l-9.6-5.6V23.7Z" opacity=".14" />
        <g filter={`url(#${hb9GlowId})`} fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif" textAnchor="middle">
          <text x="32" y="32.2" fill="#F8FEFF" fontSize="16.2" fontWeight="900" letterSpacing="1.2">HB</text>
          <text x="32" y="44.4" fill="#7DD3FC" fontSize="15.4" fontWeight="900" letterSpacing="0">9</text>
          <text x="32" y="32.2" fill="none" stroke="#67E8F9" strokeOpacity=".32" strokeWidth=".55" fontSize="16.2" fontWeight="900" letterSpacing="1.2">HB</text>
          <text x="32" y="44.4" fill="none" stroke="#38BDF8" strokeOpacity=".34" strokeWidth=".55" fontSize="15.4" fontWeight="900" letterSpacing="0">9</text>
        </g>
        <path fill="none" stroke="#67E8F9" strokeOpacity=".38" strokeWidth="1.2" d="M24.2 24.8 32 20.3l7.8 4.5M24.2 39.2 32 43.7l7.8-4.5" />
        <path fill="#38BDF8" d="M32 3.2 56.4 17.3v29.4L32 60.8 7.6 46.7V17.3L32 3.2Zm0 5.8L12.7 20.1v23.8L32 55l19.3-11.1V20.1L32 9Z" opacity=".45" />
      </svg>
    );
  }

  if (coin === "PEPE") {
    return (
      <svg viewBox="0 0 64 64" style={style} className={common} aria-hidden="true" role="img">
        <circle cx="32" cy="32" r="31" fill="#75B843" />
        <path fill="#4A8F2A" d="M8 39c2.4-15.6 12-27 24-27s21.6 11.4 24 27c-5.7 8.7-13.7 13-24 13S13.7 47.7 8 39Z" />
        <circle cx="21.5" cy="25.5" r="11.5" fill="#F7FFE8" />
        <circle cx="42.5" cy="25.5" r="11.5" fill="#F7FFE8" />
        <circle cx="25.5" cy="28" r="4" fill="#06131F" />
        <circle cx="38.5" cy="28" r="4" fill="#06131F" />
        <path fill="#163A1C" d="M17 42.2c7.2 4.6 22.8 4.6 30 0 1.2-.8 2.5.9 1.4 2-6.5 6.6-26.3 6.6-32.8 0-1.1-1.1.2-2.8 1.4-2Z" />
        <path fill="#A7E768" d="M22 48c5.4 1.8 14.6 1.8 20 0-3.2 3-16.8 3-20 0Z" />
      </svg>
    );
  }

  if (coin === "DOGE") {
    return (
      <svg viewBox="0 0 64 64" style={style} className={common} aria-hidden="true" role="img">
        <circle cx="32" cy="32" r="31" fill="#C2A633" />
        <circle cx="32" cy="32" r="25" fill="#E4C75F" />
        <path fill="#FFF4C7" d="M27 12h8.9C46.6 12 53 19.2 53 32S46.6 52 35.9 52H27V37.5h-5.2v-8.8H27V12Zm8 31.4c5.7 0 8.7-4.1 8.7-11.4S40.7 20.6 35 20.6h-1.6v8.1h6.7v8.8h-6.7v5.9H35Z" />
      </svg>
    );
  }

  if (coin === "SHIB") {
    return (
      <svg viewBox="0 0 64 64" style={style} className={common} aria-hidden="true" role="img">
        <circle cx="32" cy="32" r="31" fill="#F15A24" />
        <path fill="#F9A12B" d="M12 13l14 7-9 9L12 13Zm40 0L38 20l9 9 5-16Z" />
        <path fill="#F58220" d="M14 34c0-12.2 8-21 18-21s18 8.8 18 21c0 10.8-7.2 18-18 18s-18-7.2-18-18Z" />
        <path fill="#fff" d="M21 38c2.3 7 6.1 10.5 11 10.5S40.7 45 43 38c-5.6 2.6-16.4 2.6-22 0Z" />
        <path fill="#2B1205" d="M28 39.5h8L32 44l-4-4.5Z" />
        <circle cx="24" cy="30" r="4.5" fill="#fff" />
        <circle cx="40" cy="30" r="4.5" fill="#fff" />
        <circle cx="25.5" cy="31" r="2" fill="#2B1205" />
        <circle cx="38.5" cy="31" r="2" fill="#2B1205" />
      </svg>
    );
  }

  if (coin === "BTTC") {
    return (
      <svg viewBox="0 0 64 64" style={style} className={common} aria-hidden="true" role="img">
        <circle cx="32" cy="32" r="31" fill="#0EA5E9" />
        <circle cx="32" cy="32" r="24" fill="#155EEF" opacity=".78" />
        <path fill="#DFFBFF" d="M17 15h15.4c6.4 0 10.1 2.9 10.1 7.7 0 2.9-1.5 5.1-4.2 6.4 4.2 1.1 6.8 4.1 6.8 8.5 0 6.7-5.2 11.2-13 11.2H17V15Zm9.2 12.6h4.9c2.2 0 3.4-1 3.4-2.7s-1.2-2.6-3.4-2.6h-4.9v5.3Zm0 13.8h5.9c3 0 4.6-1.3 4.6-3.7s-1.6-3.7-4.6-3.7h-5.9v7.4Z" />
        <path fill="#8AF5FF" d="M44.4 16.8h5.2v8.8H55v5.5h-5.4v17.1h-7.1V31.1h-5v-5.5h5v-6.9l1.9-1.9Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 64" style={style} className={common} aria-hidden="true" role="img">
      <circle cx="32" cy="32" r="31" fill="#2563EB" />
      <circle cx="32" cy="32" r="4" fill="#fff" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <circle key={deg} cx="32" cy="14" r="2.4" fill="#fff" transform={`rotate(${deg} 32 32)`} />
      ))}
      {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((deg) => (
        <circle key={deg} cx="32" cy="21.5" r="1.6" fill="#BFDBFE" transform={`rotate(${deg} 32 32)`} />
      ))}
      {[0, 72, 144, 216, 288].map((deg) => (
        <circle key={deg} cx="32" cy="7.5" r="1.2" fill="#DBEAFE" transform={`rotate(${deg} 32 32)`} />
      ))}
    </svg>
  );
}
