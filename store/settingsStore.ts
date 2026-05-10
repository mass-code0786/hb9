import { create } from "zustand";

type SettingsState = {
  darkMode: boolean;
  currency: string;
  language: string;
  pinEnabled: boolean;
  biometricEnabled: boolean;
  autoLockMinutes: number;
  installPromptVisible: boolean;
  setCurrency: (currency: string) => void;
  setLanguage: (language: string) => void;
  togglePin: () => void;
  toggleBiometric: () => void;
  setAutoLockMinutes: (minutes: number) => void;
  dismissInstallPrompt: () => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  darkMode: true,
  currency: "USD",
  language: "English",
  pinEnabled: false,
  biometricEnabled: false,
  autoLockMinutes: 5,
  installPromptVisible: true,
  setCurrency: (currency) => set({ currency }),
  setLanguage: (language) => set({ language }),
  togglePin: () => set((state) => ({ pinEnabled: !state.pinEnabled })),
  toggleBiometric: () => set((state) => ({ biometricEnabled: !state.biometricEnabled })),
  setAutoLockMinutes: (autoLockMinutes) => set({ autoLockMinutes }),
  dismissInstallPrompt: () => set({ installPromptVisible: false })
}));
