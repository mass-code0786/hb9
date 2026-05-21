import { WifiOff } from "lucide-react";
import { HB9Logo } from "@/components/brand/HB9Logo";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <HB9Logo size="lg" showText className="mb-5" />
      <div className="proof-pulse mb-5 rounded-3xl border border-cyan-300/15 bg-[#0b1728]/75 p-5 shadow-[0_0_28px_rgba(34,211,238,0.12)]">
        <WifiOff size={34} />
      </div>
      <h1 className="text-3xl font-semibold">Offline</h1>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        HB9 can open offline, but balances, wallet connection, package purchases, and recharge status need network access.
      </p>
      <div className="mt-6 grid w-full gap-3 text-left">
        <div className="premium-surface rounded-2xl p-4">
          <div className="text-sm font-semibold text-white">Cached app shell ready</div>
          <div className="mt-1 text-xs text-slate-400">Reconnect to refresh proofs, treasury status, and wallet data.</div>
        </div>
      </div>
    </main>
  );
}
