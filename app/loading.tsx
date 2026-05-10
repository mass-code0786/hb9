import { BrandLogo } from "@/components/BrandLogo";

export default function Loading() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[radial-gradient(circle_at_50%_35%,rgba(49,208,170,0.14),transparent_15rem),linear-gradient(145deg,#05070b,#10141d_58%,#05070b)]">
      <div className="animate-logo-glow">
        <BrandLogo size="lg" />
      </div>
    </main>
  );
}
