import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTokenPrices } from "@/services/mockApi";
import { useTokenStore } from "@/store/tokenStore";
import type { TokenBalance } from "@/lib/types";
import type { WalletToken } from "@/types/wallet";

export function useWalletTokens(balances: TokenBalance) {
  const customTokens = useTokenStore((state) => state.customTokens);
  const hiddenSymbols = useTokenStore((state) => state.hiddenSymbols);
  const favorites = useTokenStore((state) => state.favorites);
  const search = useTokenStore((state) => state.search);

  const baseTokens = useMemo<WalletToken[]>(
    () => [
      {
        symbol: "BNB",
        name: "BNB Smart Chain",
        balance: balances.bnb,
        price: 612.35,
        fiatValue: Number(balances.bnb || 0) * 612.35,
        change24h: 1.84,
        favorite: favorites.includes("BNB"),
        color: "#f3ba2f"
      },
      {
        symbol: "USDT",
        name: "Tether USD",
        balance: balances.usdt,
        price: 1,
        fiatValue: Number(balances.usdt || 0),
        change24h: 0.01,
        favorite: favorites.includes("USDT"),
        color: "#31d0aa"
      },
      ...customTokens
    ],
    [balances.bnb, balances.usdt, customTokens, favorites]
  );

  const { data = baseTokens, isFetching } = useQuery({
    queryKey: ["token-prices", balances.bnb, balances.usdt, customTokens.length],
    queryFn: () => getTokenPrices(baseTokens),
    initialData: baseTokens
  });

  const tokens = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data
      .filter((token) => !hiddenSymbols.includes(token.symbol))
      .filter((token) => !query || token.symbol.toLowerCase().includes(query) || token.name.toLowerCase().includes(query))
      .sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)));
  }, [data, hiddenSymbols, search]);

  return { tokens, isFetching };
}
