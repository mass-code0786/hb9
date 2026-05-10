import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WalletToken } from "@/types/wallet";

type TokenState = {
  search: string;
  selectedToken: WalletToken | null;
  customTokens: WalletToken[];
  hiddenSymbols: string[];
  favorites: string[];
  setSearch: (search: string) => void;
  setSelectedToken: (token: WalletToken | null) => void;
  addCustomToken: (token: WalletToken) => void;
  toggleHidden: (symbol: string) => void;
  toggleFavorite: (symbol: string) => void;
};

export const useTokenStore = create<TokenState>()(
  persist(
    (set) => ({
      search: "",
      selectedToken: null,
      customTokens: [],
      hiddenSymbols: [],
      favorites: ["bsc:BNB", "bsc:USDT", "bsc:USDC", "ethereum:ETH", "ethereum:USDT", "polygon:MATIC", "polygon:USDT", "tron:TRX", "tron:USDT", "bitcoin:BTC"],
      setSearch: (search) => set({ search }),
      setSelectedToken: (selectedToken) => set({ selectedToken }),
      addCustomToken: (token) =>
        set((state) => ({
          customTokens: [...state.customTokens.filter((item) => item.id !== token.id), token]
        })),
      toggleHidden: (symbol) =>
        set((state) => ({
          hiddenSymbols: state.hiddenSymbols.includes(symbol)
            ? state.hiddenSymbols.filter((item) => item !== symbol)
            : [...state.hiddenSymbols, symbol]
        })),
      toggleFavorite: (symbol) =>
        set((state) => ({
          favorites: state.favorites.includes(symbol)
            ? state.favorites.filter((item) => item !== symbol)
            : [...state.favorites, symbol]
        }))
    }),
    {
      name: "bitzenx-token-management",
      partialize: (state) => ({
        customTokens: state.customTokens,
        hiddenSymbols: state.hiddenSymbols,
        favorites: state.favorites
      })
    }
  )
);
