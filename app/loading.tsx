import { BrandLogo } from "@/components/BrandLogo";

export default function Loading() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(circle_at_50%_35%,rgba(34,211,238,0.18),transparent_15rem),linear-gradient(145deg,#06111f,#071426_58%,#020617)]">
      <div className="w-full max-w-sm px-6 text-center">
      <div className="animate-logo-glow">
        <BrandLogo size="lg" showText />
      </div>
        <div className="mt-8 space-y-3" aria-label="Loading HB9">
          <div className="shimmer-card mx-auto h-4 w-48 rounded-full" />
          <div className="shimmer-card h-14 rounded-2xl border border-cyan-300/10" />
          <div className="grid grid-cols-2 gap-3">
            <div className="shimmer-card h-20 rounded-2xl border border-cyan-300/10" />
            <div className="shimmer-card h-20 rounded-2xl border border-cyan-300/10" />
          </div>
        </div>
      </div>
    </main>
  );
}
