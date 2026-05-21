"use client";

import { createConfig, http } from "wagmi";
import { bsc } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

export const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

export const wagmiConfig = createConfig({
  chains: [bsc],
  connectors: [
    injected({ shimDisconnect: true }),
    ...(walletConnectProjectId
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            showQrModal: true,
            metadata: {
              name: "HB9",
              description: "HB9 decentralized business identity",
              url: process.env.NEXT_PUBLIC_APP_URL || "https://hb9.live",
              icons: [`${process.env.NEXT_PUBLIC_APP_URL || "https://hb9.live"}/icons/icon.svg`]
            }
          })
        ]
      : [])
  ],
  ssr: true,
  transports: {
    [bsc.id]: http(process.env.NEXT_PUBLIC_BSC_RPC_URL || "https://bsc-dataseed.binance.org")
  }
});
