import { create } from "zustand";
import type { WalletTransaction } from "@/types/wallet";

type TransactionState = {
  transactions: WalletTransaction[];
  addTransaction: (transaction: WalletTransaction) => void;
  setTransactions: (transactions: WalletTransaction[]) => void;
};

export const useTransactionStore = create<TransactionState>((set) => ({
  transactions: [],
  addTransaction: (transaction) => set((state) => ({ transactions: [transaction, ...state.transactions] })),
  setTransactions: (transactions) => set({ transactions })
}));
