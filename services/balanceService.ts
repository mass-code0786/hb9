import { getNetworkConfig, type NetworkKey } from "@/lib/networks";
import { getTokensForNetwork, type TokenConfig } from "@/lib/tokens";
import { getEvmBalances } from "@/services/evmService";
import { getTronBalances } from "@/services/tronService";

export type BalanceMap = Record<string, string>;

export async function getNetworkBalances(network: NetworkKey, address: string, customTokens: TokenConfig[] = []) {
  const config = getNetworkConfig(network);
  const tokens = [...getTokensForNetwork(network), ...customTokens.filter((token) => token.network === network)];
  if (config.kind !== "evm") {
    if (config.kind === "tron") return getTronBalances(address, tokens);
    return Object.fromEntries(tokens.map((token) => [token.id, "0"]));
  }
  return getEvmBalances(network, address, tokens);
}
