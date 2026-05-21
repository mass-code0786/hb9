export type DiscoverDapp = {
  name: string;
  icon: string;
  url: string;
  externalUrl?: string;
  category: "DeFi" | "NFT" | "Explorer" | "Business";
};

export const popularDapps: DiscoverDapp[] = [
  {
    name: "HB9",
    icon: "HB",
    url: "/halal-business",
    externalUrl: "https://example.com",
    category: "Business"
  },
  {
    name: "PancakeSwap",
    icon: "P",
    url: "https://pancakeswap.finance",
    category: "DeFi"
  },
  {
    name: "Uniswap",
    icon: "U",
    url: "https://app.uniswap.org",
    category: "DeFi"
  },
  {
    name: "OpenSea",
    icon: "O",
    url: "https://opensea.io",
    category: "NFT"
  },
  {
    name: "BscScan",
    icon: "B",
    url: "https://bscscan.com",
    category: "Explorer"
  },
  {
    name: "PolygonScan",
    icon: "P",
    url: "https://polygonscan.com",
    category: "Explorer"
  },
  {
    name: "TronScan",
    icon: "T",
    url: "https://tronscan.org",
    category: "Explorer"
  }
];
