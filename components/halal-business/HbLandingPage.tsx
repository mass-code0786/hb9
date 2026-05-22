"use client";

import { useEffect, useMemo, useState } from "react";
import { HalalBusinessLogo } from "@/components/brand/HalalBusinessLogo";
import { buildDefaultHbPackageProducts, HbPackageProductCard, money } from "@/components/halal-business/HbPackageCards";
import { ExternalWalletConnect } from "@/components/wallet/ExternalWalletConnect";
import { fetchHbSponsorPreview, type HbProduct, type HbSponsorPreview, type HbUser } from "@/services/halalBusinessService";

type HbLandingPageProps = {
  referralCode: string;
  onAuthenticated: (token: string, user: HbUser) => void;
};

const heroDetails = [
  "HB9 gives users instant access to digital products, decentralized activation systems, and transparent business infrastructure through wallet-connected identity.",
  "Every activation is connected to proof-based accounting, treasury visibility, and blockchain-linked distribution architecture.",
  "Digital products are delivered within seconds after successful activation, creating a fast and seamless onboarding experience for users worldwide.",
  "The ecosystem is designed for transparency, speed, decentralized access, and modern digital business operations."
];

export function HbLandingPage({ referralCode, onAuthenticated }: HbLandingPageProps) {
  const [sponsorPreview, setSponsorPreview] = useState<HbSponsorPreview>(null);

  useEffect(() => {
    if (!referralCode) {
      setSponsorPreview(null);
      return;
    }
    fetchHbSponsorPreview(referralCode)
      .then((result) => setSponsorPreview(result.sponsor))
      .catch(() => setSponsorPreview(null));
  }, [referralCode]);

  return (
    <section id="top" className="hb-premium-shell relative isolate -mx-3 min-h-screen overflow-x-hidden px-3 pb-[110px] pt-3 text-white sm:-mx-4 sm:px-4 md:-mx-6 md:px-6">
      <div className="hb-orbit hb-orbit-a" />
      <div className="hb-grid-glow" />
      <div className="hb-particles" aria-hidden="true"><span /><span /><span /></div>

      <nav className="sticky top-2 z-40 mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[#06111f]/62 px-3 py-2.5 shadow-[0_20px_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl">
        <div className="flex min-w-0 items-center gap-2.5">
          <HalalBusinessLogo size="sm" showText />
        </div>
        <div className="w-[9.8rem] shrink-0 sm:w-auto">
          <ExternalWalletConnect compact minimal authenticate referralCode={referralCode} onAuthenticated={onAuthenticated} />
        </div>
      </nav>

      <div className="relative z-10 mx-auto max-w-6xl">
        <HeroSection referralCode={referralCode} sponsorPreview={sponsorPreview} onAuthenticated={onAuthenticated} />
        <PackageEcosystemSection referralCode={referralCode} onAuthenticated={onAuthenticated} />
      </div>
    </section>
  );
}

function HeroSection({ referralCode, sponsorPreview, onAuthenticated }: {
  referralCode: string;
  sponsorPreview: HbSponsorPreview;
  onAuthenticated: (token: string, user: HbUser) => void;
}) {
  return (
    <header className="relative mx-auto flex min-h-[calc(100dvh-5.75rem)] max-w-4xl flex-col items-center justify-center px-1 py-10 text-center sm:py-14">
      <div className="absolute inset-x-6 top-16 -z-10 mx-auto h-72 max-w-xl rounded-full bg-cyan-300/10 blur-3xl" aria-hidden="true" />
      <div className="w-full max-w-3xl">
        <h1 className="mx-auto max-w-[20rem] text-5xl font-semibold leading-[0.96] tracking-normal text-white sm:max-w-2xl sm:text-5xl sm:leading-[0.95]">
          Decentralized Ecosystem
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-sky-100/72 sm:mt-5 sm:text-lg">
          A decentralized digital product ecosystem powered by blockchain-connected infrastructure.
        </p>
        {(sponsorPreview || referralCode) ? (
          <div className="mx-auto mt-5 max-w-sm rounded-2xl border border-cyan-200/10 bg-white/[0.035] px-4 py-3 text-sm text-sky-100/62">
            Sponsor: <span className="font-semibold text-cyan-50">{sponsorPreview?.displayName || sponsorPreview?.referralCode || referralCode}</span>
          </div>
        ) : null}
        <div className="mx-auto mt-6 flex w-full max-w-xs flex-col items-center gap-3 sm:mt-7 sm:max-w-sm">
          <div className="w-full">
            <ExternalWalletConnect minimal hero authenticate referralCode={referralCode} onAuthenticated={onAuthenticated} />
          </div>
          <div className="w-full">
            <ExternalWalletConnect minimal hero heroTone="secondary" authenticate referralCode={referralCode} buttonLabel="Sign Up" onAuthenticated={onAuthenticated} />
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-white/[0.08] bg-[#06111f]/46 p-4 text-left shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-2xl sm:mt-9 sm:p-5">
          <div className="space-y-3 text-sm leading-6 text-sky-100/64 sm:text-base sm:leading-7">
            {heroDetails.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

function PackageEcosystemSection({ referralCode, onAuthenticated }: {
  referralCode: string;
  onAuthenticated: (token: string, user: HbUser) => void;
}) {
  const [selectedPackage, setSelectedPackage] = useState<HbProduct | null>(null);
  const packages = useMemo(() => buildDefaultHbPackageProducts(), []);

  function startBuy(product: HbProduct) {
    setSelectedPackage(product);
  }

  return (
    <section className="relative pb-12 sm:pb-16" aria-label="HB9 package products">
      <div className="hb-package-orb hb-package-orb-a" aria-hidden="true" />
      <div className="hb-package-orb hb-package-orb-b" aria-hidden="true" />

      <div className="mb-4 flex items-end justify-between gap-3 px-1">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-100/55">HB9 Premium</p>
          <h2 className="mt-1 text-2xl font-black text-white">Available Packages</h2>
        </div>
        <span className="shrink-0 rounded-full border border-cyan-200/12 bg-cyan-300/8 px-2.5 py-1 text-[10px] font-bold text-cyan-100/75">All 6 packages</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {packages.map((product) => (
          <HbPackageProductCard key={product.id} product={product} cta="Buy Now" onBuy={() => startBuy(product)} compact />
        ))}
      </div>

      {selectedPackage ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 px-3 pb-3 backdrop-blur-sm">
          <div className="w-full max-w-[430px] rounded-[1.6rem] border border-cyan-200/15 bg-[#071827]/95 p-4 shadow-[0_0_40px_rgba(34,211,238,0.18)] backdrop-blur-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">Buy package</p>
            <h2 className="mt-2 text-2xl font-semibold">{money(selectedPackage.package_price)} {selectedPackage.package_name}</h2>
            <p className="mt-2 text-sm leading-6 text-sky-100/62">Connect or verify your wallet to continue with this HB9 package.</p>
            <div className="mt-4">
              <ExternalWalletConnect minimal hero authenticate referralCode={referralCode} buttonLabel="Connect Wallet" onAuthenticated={onAuthenticated} />
            </div>
            <button className="mt-3 w-full rounded-2xl border border-cyan-200/18 bg-cyan-300/10 px-4 py-3 text-sm font-bold text-cyan-100" onClick={() => setSelectedPackage(null)} type="button">Cancel</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
