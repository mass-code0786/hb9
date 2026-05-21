import { useEffect, useState } from "react";
import { getTokenFallback, getTokenIcon } from "@/lib/tokenIcons";
import type { WalletToken } from "@/types/wallet";

export function TokenIcon({ token, size = "md" }: { token: WalletToken; size?: "md" | "lg" }) {
  const registryItem = getTokenIcon(token.symbol, token.network);
  const fallback = registryItem?.fallback || getTokenFallback(token.symbol, token.color);
  const [imageFailed, setImageFailed] = useState(false);
  const sizeClass = size === "lg" ? "h-14 w-14" : "h-10 w-10";
  const textClass = size === "lg" ? "text-[0.82rem]" : "text-[0.66rem]";

  useEffect(() => {
    setImageFailed(false);
  }, [registryItem?.icon]);

  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-950 shadow-[0_0_22px_rgba(5,196,107,0.20),inset_0_1px_0_rgba(255,255,255,0.20)] ring-1 ring-white/10 ${sizeClass}`}
      aria-label={`${token.symbol} token icon`}
    >
      {registryItem && !imageFailed ? (
        <img
          className="h-full w-full rounded-full object-contain"
          src={registryItem.icon}
          alt=""
          aria-hidden="true"
          draggable={false}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span
          className={`flex h-full w-full items-center justify-center rounded-full font-extrabold leading-none ${textClass}`}
          style={{
            background: `radial-gradient(circle at 30% 20%, rgba(255,255,255,0.32), transparent 0.72rem), ${fallback.background}`,
            color: fallback.foreground
          }}
        >
          {fallback.label}
        </span>
      )}
    </span>
  );
}
