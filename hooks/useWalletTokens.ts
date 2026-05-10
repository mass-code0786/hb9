import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTokenPrices } from "@/services/mockApi";
import { useTokenStore } from "@/store/tokenStore";
import { getNetworkConfig, type NetworkKey } from "@/lib/networks";
import { DEFAULT_TOKENS, type TokenConfig } from "@/lib/tokens";
import type { TokenBalance } from "@/lib/types";
import type { WalletToken } from "@/types/wallet";

function tokenConfigToWalletToken(token: TokenConfig, balances: TokenBalance, favorites: string[]): WalletToken {
  const network = getNetworkConfig(token.network);
  const balance = balances[token.id] || "0";
  return {
    id: token.id,
    symbol: token.symbol,
    name: token.name,
    balance,
    price: token.price,
    fiatValue: Number(balance || 0) * token.price,
    change24h: token.change24h,
    address: token.contractAddress,
    decimals: token.decimals,
    network: token.network,
    networkName: network.shortName,
    placeholder: token.placeholder,
    favorite: favorites.includes(token.id),
    color: token.color
  };
}

export function useWalletTokens(balances: TokenBalance, network: NetworkKey) {
  const customTokens = useTokenStore((state) => state.customTokens);
  const hiddenSymbols = useTokenStore((state) => state.hiddenSymbols);
  const favorites = useTokenStore((state) => state.favorites);
  const search = useTokenStore((state) => state.search);

  const baseTokens = useMemo<WalletToken[]>(
    () => [
      ...DEFAULT_TOKENS.filter((token) => token.network === network).map((token) => tokenConfigToWalletToken(token, balances, favorites)),
      ...customTokens.filter((token) => token.network === network).map((token) => ({
        ...token,
        balance: balances[token.id || `${token.network}:${token.symbol}`] || token.balance || "0",
        fiatValue: Number(balances[token.id || `${token.network}:${token.symbol}`] || token.balance || 0) * token.price,
        favorite: favorites.includes(token.id || token.symbol)
      }))
    ],
    [balances, customTokens, favorites, network]
  );

  const { data = baseTokens, isFetching } = useQuery({
    queryKey: ["token-prices", network, balances, customTokens.length],
    queryFn: () => getTokenPrices(baseTokens),
    initialData: baseTokens
  });

  const tokens = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data
      .filter((token) => !hiddenSymbols.includes(token.id || token.symbol))
      .filter((token) => !query || token.symbol.toLowerCase().includes(query) || token.name.toLowerCase().includes(query) || token.networkName?.toLowerCase().includes(query))
      .sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)));
  }, [data, hiddenSymbols, search]);

  return { tokens, isFetching };
}
