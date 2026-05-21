export const CHAIN_MODE = process.env.NEXT_PUBLIC_CHAIN_MODE === "testnet" ? "testnet" : "mainnet";
export const BSC_RPC_URL =
  process.env.NEXT_PUBLIC_BSC_RPC_URL ||
  (CHAIN_MODE === "testnet" ? "https://data-seed-prebsc-1-s1.binance.org:8545" : "https://bsc-dataseed.binance.org");
export const BSC_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || process.env.NEXT_PUBLIC_BSC_CHAIN_ID || (CHAIN_MODE === "testnet" ? 97 : 56));
export const USDT_CONTRACT =
  process.env.NEXT_PUBLIC_USDT_TOKEN_ADDRESS ||
  process.env.NEXT_PUBLIC_USDT_BEP20_ADDRESS ||
  process.env.NEXT_PUBLIC_USDT_CONTRACT ||
  "0x55d398326f99059fF775485246999027B3197955";
export const BSCSCAN_URL = process.env.NEXT_PUBLIC_BSCSCAN_URL || (CHAIN_MODE === "testnet" ? "https://testnet.bscscan.com" : "https://bscscan.com");
export const NETWORK_LABEL = CHAIN_MODE === "testnet" ? "BSC Testnet" : "BSC Mainnet";

export const USDT_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)"
];
