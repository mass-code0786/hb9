import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://hb9.live"),
  title: "HB9 | Decentralized Business Identity",
  description: "Decentralized Business Identity and Product Activation Ecosystem with wallet-first onboarding, treasury visibility, referral distribution, and proof-based earning transparency.",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "HB9",
    description: "Decentralized Business Identity & Product Activation Ecosystem.",
    siteName: "HB9",
    type: "website",
    images: [{ url: "/icons/icon.svg", width: 512, height: 512, alt: "HB9" }]
  },
  twitter: {
    card: "summary",
    title: "HB9",
    description: "Wallet-first business identity, activation products, treasury visibility, and proof transparency."
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" }
    ],
    shortcut: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon.svg", type: "image/svg+xml" }]
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "HB9"
  }
};

export const viewport: Viewport = {
  themeColor: "#05070b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <PwaInstallPrompt />
        <PwaRegister />
      </body>
    </html>
  );
}
