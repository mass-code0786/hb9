"use client";

import { useEffect, useState } from "react";
import { HalalBusinessLogo } from "@/components/brand/HalalBusinessLogo";
import { PackageIllustration, type PackageIllustrationType } from "@/components/packages/PackageIllustration";
import { ExternalWalletConnect } from "@/components/wallet/ExternalWalletConnect";
import { fetchHbSponsorPreview, type HbSponsorPreview, type HbUser } from "@/services/halalBusinessService";
import {
  BrainCircuit,
  Check,
  MessageCircle,
  Network,
  Rocket,
  Sparkles,
  WalletCards
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

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

const packageCards = [
  {
    price: "$4 Package",
    badge: "Starter Access",
    theme: "startup",
    illustration: "starter",
    icon: Rocket,
    features: ["4 Business Idea Books", "Digital Startup Guides", "Instant Product Delivery"]
  },
  {
    price: "$20 Package",
    badge: "Growth Access",
    theme: "growth",
    illustration: "growth",
    icon: WalletCards,
    features: ["20 Business Idea Books", "Money Management Books", "Social Media Growth Kit", "700 Social Media Followers", "Instant Delivery"]
  },
  {
    price: "$100 Package",
    badge: "Creator Expansion",
    theme: "creator",
    illustration: "creator",
    icon: Sparkles,
    features: ["100 Story Templates", "Business Idea Collection", "Money Management Books", "Branding Resources", "4000 Social Media Followers"]
  },
  {
    price: "$500 Package",
    badge: "Automation Suite",
    theme: "automation",
    illustration: "whatsapp",
    icon: MessageCircle,
    features: ["All $100 Features", "WhatsApp Automatic Message Software", "CRM-style Messaging System", "Automation Features"]
  },
  {
    price: "$2500 Package",
    badge: "AI Business Suite",
    theme: "ai",
    illustration: "ai_ads",
    icon: BrainCircuit,
    features: ["All $500 Features", "AI Calling Agent Software", "Meta Auto Ads Run AI Software", "AI Automation Ecosystem"]
  },
  {
    price: "$12500 Package",
    badge: "Enterprise Access",
    theme: "enterprise",
    illustration: "enterprise",
    icon: Network,
    features: ["All $2500 Features", "3 Custom Software Projects", "Centralized or Decentralized Solutions", "Premium Business Infrastructure", "Custom Development Support"]
  }
] satisfies Array<{
  price: string;
  badge: string;
  theme: string;
  illustration: PackageIllustrationType;
  icon: LucideIcon;
  features: string[];
}>;

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
    <section id="top" className="hb-premium-shell relative isolate -mx-3 min-h-dvh overflow-hidden px-3 pb-8 pt-3 text-white sm:-mx-4 sm:px-4 md:-mx-6 md:px-6">
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
        <PackageEcosystemSection />
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

function PackageEcosystemSection() {
  const [message, setMessage] = useState("");

  function showActivationMessage() {
    setMessage("Package activation coming soon");
  }

  return (
    <section className="relative pb-12 sm:pb-16" aria-label="HB9 package products">
      <div className="hb-package-orb hb-package-orb-a" aria-hidden="true" />
      <div className="hb-package-orb hb-package-orb-b" aria-hidden="true" />

      <div className="packages-grid">
        {packageCards.map((card) => (
          <article key={card.price} className={`package-card hb-package-card hb-product-card hb-product-card-${card.theme}`}>
            <div className="hb-package-media">
              <div className="hb-product-visual">
                <PackageIllustration type={card.illustration} />
              </div>
            </div>

            <div className="hb-package-content">
              <div className="mb-3 flex items-start justify-between gap-3">
                <h3 className="text-2xl font-semibold tracking-normal text-white">{card.price}</h3>
                <div className="hb-product-icon" aria-hidden="true">
                  <card.icon className="h-6 w-6" />
                </div>
              </div>

              <ul className="space-y-2.5">
                {card.features.map((feature) => (
                  <li key={feature} className="flex gap-2 text-sm leading-5 text-sky-50/72">
                    <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cyan-300/14 text-cyan-100 ring-1 ring-cyan-200/20">
                      <Check className="h-3 w-3" />
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button onClick={showActivationMessage} className="hb-package-cta relative z-10 mt-5 text-center" type="button">
                Activate Package
              </button>
            </div>
          </article>
        ))}
      </div>
      {message ? <div className="mx-auto mt-4 max-w-sm text-center text-xs leading-5 text-yellow-100">{message}</div> : null}
    </section>
  );
}
