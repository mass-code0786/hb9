import { create } from "zustand";
import type { RechargeOrder, TokenSymbol } from "@/types/wallet";

type RechargeState = {
  country: string;
  operatorId: string;
  operator: string;
  mobile: string;
  productId: string;
  cryptoAsset: TokenSymbol;
  history: RechargeOrder[];
  setField: (field: "country" | "operatorId" | "operator" | "mobile" | "productId", value: string) => void;
  setCryptoAsset: (asset: TokenSymbol) => void;
  addOrder: (order: RechargeOrder) => void;
  updateOrder: (order: RechargeOrder) => void;
};

export const useRechargeStore = create<RechargeState>((set) => ({
  country: "IN",
  operatorId: "in-airtel",
  operator: "Airtel",
  mobile: "",
  productId: "in-airtel-199",
  cryptoAsset: "USDT",
  history: [],
  setField: (field, value) => set({ [field]: value } as Pick<RechargeState, typeof field>),
  setCryptoAsset: (cryptoAsset) => set({ cryptoAsset }),
  addOrder: (order) => set((state) => ({ history: [order, ...state.history.filter((item) => item.id !== order.id)] })),
  updateOrder: (order) => set((state) => ({ history: state.history.map((item) => (item.id === order.id ? order : item)) }))
}));
