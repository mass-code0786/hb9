import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 rounded-3xl bg-white/10 p-5">
        <WifiOff size={34} />
      </div>
      <h1 className="text-3xl font-semibold">Offline</h1>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        BitzenX can open offline, but balances, gas estimates, sends, markets, and recharge status need network access.
      </p>
    </main>
  );
}
