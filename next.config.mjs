/** @type {import('next').NextConfig} */
const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
const bscRpcUrl = process.env.NEXT_PUBLIC_BSC_RPC_URL || "https://bsc-dataseed.binance.org";
const devConnectSources = process.env.NODE_ENV === "production" ? [] : ["http://localhost:4000", "http://127.0.0.1:4000"];
const connectSources = Array.from(new Set([
  "'self'",
  ...devConnectSources,
  "https://api.hb9.live",
  "https://hb9.live",
  "wss://api.hb9.live",
  "https://bsc-dataseed.binance.org",
  "https://*.walletconnect.com",
  "wss://*.walletconnect.com",
  "https://*.walletconnect.org",
  "wss://*.walletconnect.org",
  ...(apiBaseUrl ? [apiBaseUrl] : []),
  bscRpcUrl
]));

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      `connect-src ${connectSources.join(" ")}`,
      "frame-ancestors 'none'"
    ].join("; ")
  }
];

const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  env: {
    HB9_DEV_DASHBOARD_BYPASS: process.env.HB9_DEV_DASHBOARD_BYPASS || "false",
    HB9_DEV_DIRECT_DASHBOARD: process.env.HB9_DEV_DIRECT_DASHBOARD || "false"
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders
      }
    ];
  }
};

export default nextConfig;
