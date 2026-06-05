import type { Metadata } from "next";
import { HbPremiumMobileDashboard } from "@/features/halal-business/HbPremiumMobileDashboard";

const title = "Join HB9 — The Future of Decentralized Business";
const description = "AI powered business packages, blockchain technology, HB9 token utility, global community growth, daily opportunities, and a decentralized ecosystem.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/halal-business"
  },
  openGraph: {
    title,
    description,
    url: "/halal-business",
    siteName: "HB9",
    type: "website",
    images: [
      {
        url: "/halal-business/opengraph-image",
        width: 1200,
        height: 630,
        alt: "HB9 decentralized business ecosystem"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/halal-business/opengraph-image"]
  }
};

export default function HalalBusinessPage() {
  return <HbPremiumMobileDashboard />;
}
