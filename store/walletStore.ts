import { create } from "zustand";
import type { EncryptedVault, TokenBalance, TxStatus } from "@/lib/types";
import type { AppTab, WalletScreen } from "@/types/wallet";

type WalletState = {
  screen: WalletScreen;
  activeTab: AppTab;
  vault: EncryptedVault | null;
  sessionMnemonic: string;
  activeAddress: string;
  balances: TokenBalance;
  loadingBalance: boolean;
  balanceVisible: boolean;
  network: "BSC Mainnet" | "BSC Testnet";
  tx: TxStatus;
  setScreen: (screen: WalletScreen) => void;
  setActiveTab: (tab: AppTab) => void;
  setVault: (vault: EncryptedVault | null) => void;
  setSessionMnemonic: (mnemonic: string) => void;
  setActiveAddress: (address: string) => void;
  setBalances: (balances: TokenBalance) => void;
  setLoadingBalance: (loading: boolean) => void;
  toggleBalanceVisible: () => void;
  setNetwork: (network: WalletState["network"]) => void;
  setTx: (tx: TxStatus) => void;
};

export const initialTx: TxStatus = { state: "idle", message: "" };

export const useWalletStore = create<WalletState>((set) => ({
  screen: "landing",
  activeTab: "home",
  vault: null,
  sessionMnemonic: "",
  activeAddress: "",
  balances: { bnb: "0", usdt: "0" },
  loadingBalance: false,
  balanceVisible: true,
  network: "BSC Mainnet",
  tx: initialTx,
  setScreen: (screen) => set({ screen }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setVault: (vault) => set({ vault }),
  setSessionMnemonic: (sessionMnemonic) => set({ sessionMnemonic }),
  setActiveAddress: (activeAddress) => set({ activeAddress }),
  setBalances: (balances) => set({ balances }),
  setLoadingBalance: (loadingBalance) => set({ loadingBalance }),
  toggleBalanceVisible: () => set((state) => ({ balanceVisible: !state.balanceVisible })),
  setNetwork: (network) => set({ network }),
  setTx: (tx) => set({ tx })
}));
