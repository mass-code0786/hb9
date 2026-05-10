import { create } from "zustand";
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

export const useTokenStore = create<TokenState>((set) => ({
  search: "",
  selectedToken: null,
  customTokens: [],
  hiddenSymbols: [],
  favorites: ["BNB", "USDT"],
  setSearch: (search) => set({ search }),
  setSelectedToken: (selectedToken) => set({ selectedToken }),
  addCustomToken: (token) => set((state) => ({ customTokens: [...state.customTokens, token] })),
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
}));
