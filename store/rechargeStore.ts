import { create } from "zustand";
import type { RechargeOrder, TokenSymbol } from "@/types/wallet";

type RechargeState = {
  country: string;
  operator: string;
  mobile: string;
  amount: string;
  cryptoAsset: TokenSymbol;
  history: RechargeOrder[];
  setField: (field: "country" | "operator" | "mobile" | "amount", value: string) => void;
  setCryptoAsset: (asset: TokenSymbol) => void;
  addOrder: (order: RechargeOrder) => void;
};

export const useRechargeStore = create<RechargeState>((set) => ({
  country: "IN",
  operator: "Jio",
  mobile: "",
  amount: "",
  cryptoAsset: "USDT",
  history: [],
  setField: (field, value) => set({ [field]: value } as Pick<RechargeState, typeof field>),
  setCryptoAsset: (cryptoAsset) => set({ cryptoAsset }),
  addOrder: (order) => set((state) => ({ history: [order, ...state.history] }))
}));
