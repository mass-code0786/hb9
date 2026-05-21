import type { WalletToken, WalletTransaction } from "@/types/wallet";

const delay = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getMarketSnapshot() {
  await delay();
  return [
    { symbol: "BNB", name: "BNB", price: 612.35, change24h: 1.84 },
    { symbol: "USDT", name: "Tether USD", price: 1, change24h: 0.01 },
    { symbol: "BTC", name: "Bitcoin", price: 64220.9, change24h: 2.16 }
  ];
}

export async function getTokenPrices(tokens: WalletToken[]) {
  await delay();
  return tokens.map((token) => ({
    ...token,
    fiatValue: Number(token.balance || 0) * token.price
  }));
}

export async function getMockTransactions(): Promise<WalletTransaction[]> {
  await delay();
  return [
    {
      id: "tx-recharge-demo",
      type: "recharge",
      title: "Mobile recharge",
      asset: "USDT",
      amount: "-5.00",
      status: "success",
      gasFee: "0.00018 BNB",
      createdAt: new Date(Date.now() - 1000 * 60 * 14).toISOString()
    },
    {
      id: "tx-receive-demo",
      type: "receive",
      title: "USDT deposit",
      asset: "USDT",
      amount: "+25.00",
      status: "success",
      gasFee: "NOWPayments",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString()
    }
  ];
}
