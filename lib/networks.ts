export type NetworkKind = "evm" | "tron" | "bitcoin" | "solana";

export type NetworkKey =
  | "bsc"
  | "ethereum"
  | "polygon"
  | "tron"
  | "arbitrum"
  | "optimism"
  | "avalanche"
  | "solana"
  | "bitcoin";

export type NetworkConfig = {
  key: NetworkKey;
  kind: NetworkKind;
  name: string;
  shortName: string;
  nativeSymbol: string;
  chainId?: number;
  rpcUrl?: string;
  explorerUrl?: string;
  addressLabel: string;
  placeholder?: boolean;
};

export const NETWORKS: Record<NetworkKey, NetworkConfig> = {
  bsc: {
    key: "bsc",
    kind: "evm",
    name: "BNB Smart Chain",
    shortName: "BSC",
    nativeSymbol: "BNB",
    chainId: Number(process.env.NEXT_PUBLIC_BSC_CHAIN_ID || 56),
    rpcUrl: process.env.NEXT_PUBLIC_BSC_RPC_URL || "https://bsc-dataseed.binance.org",
    explorerUrl: process.env.NEXT_PUBLIC_BSCSCAN_URL || "https://bscscan.com",
    addressLabel: ""
  },
  ethereum: {
    key: "ethereum",
    kind: "evm",
    name: "Ethereum",
    shortName: "ETH",
    nativeSymbol: "ETH",
    chainId: 1,
    rpcUrl: process.env.NEXT_PUBLIC_ETH_RPC_URL || "https://ethereum.publicnode.com",
    explorerUrl: "https://etherscan.io",
    addressLabel: ""
  },
  polygon: {
    key: "polygon",
    kind: "evm",
    name: "Polygon",
    shortName: "Polygon",
    nativeSymbol: "MATIC",
    chainId: 137,
    rpcUrl: process.env.NEXT_PUBLIC_POLYGON_RPC_URL || "https://polygon-rpc.com",
    explorerUrl: "https://polygonscan.com",
    addressLabel: ""
  },
  tron: {
    key: "tron",
    kind: "tron",
    name: "TRON",
    shortName: "TRON",
    nativeSymbol: "TRX",
    rpcUrl: process.env.NEXT_PUBLIC_TRON_RPC_URL || "https://api.trongrid.io",
    explorerUrl: "https://tronscan.org",
    addressLabel: "TRON wallet address"
  },
  arbitrum: {
    key: "arbitrum",
    kind: "evm",
    name: "Arbitrum",
    shortName: "Arbitrum",
    nativeSymbol: "ETH",
    chainId: 42161,
    rpcUrl: process.env.NEXT_PUBLIC_ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
    explorerUrl: "https://arbiscan.io",
    addressLabel: ""
  },
  optimism: {
    key: "optimism",
    kind: "evm",
    name: "Optimism",
    shortName: "Optimism",
    nativeSymbol: "ETH",
    chainId: 10,
    rpcUrl: process.env.NEXT_PUBLIC_OPTIMISM_RPC_URL || "https://mainnet.optimism.io",
    explorerUrl: "https://optimistic.etherscan.io",
    addressLabel: ""
  },
  avalanche: {
    key: "avalanche",
    kind: "evm",
    name: "Avalanche",
    shortName: "Avalanche",
    nativeSymbol: "AVAX",
    chainId: 43114,
    rpcUrl: process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
    explorerUrl: "https://snowtrace.io",
    addressLabel: ""
  },
  solana: {
    key: "solana",
    kind: "solana",
    name: "Solana",
    shortName: "Solana",
    nativeSymbol: "SOL",
    addressLabel: "Solana receive address unavailable",
    placeholder: true
  },
  bitcoin: {
    key: "bitcoin",
    kind: "bitcoin",
    name: "Bitcoin",
    shortName: "Bitcoin",
    nativeSymbol: "BTC",
    explorerUrl: "https://mempool.space",
    addressLabel: "Bitcoin receive address unavailable",
    placeholder: true
  }
};

export const NETWORK_OPTIONS = [
  NETWORKS.bsc,
  NETWORKS.polygon,
  NETWORKS.arbitrum,
  NETWORKS.optimism,
  NETWORKS.avalanche,
  NETWORKS.tron,
  NETWORKS.bitcoin,
  NETWORKS.solana
];

export function getNetworkConfig(network: NetworkKey) {
  return NETWORKS[network];
}

export function explorerAddressUrl(network: NetworkKey, address: string) {
  const config = getNetworkConfig(network);
  if (!config.explorerUrl || !address || config.placeholder) return "";
  if (network === "tron") return `${config.explorerUrl}/#/address/${address}`;
  return `${config.explorerUrl}/address/${address}`;
}

export function explorerTxUrl(network: NetworkKey, hash: string) {
  const config = getNetworkConfig(network);
  if (!config.explorerUrl || !hash || config.placeholder) return "";
  if (network === "tron") return `${config.explorerUrl}/#/transaction/${hash}`;
  return `${config.explorerUrl}/tx/${hash}`;
}
