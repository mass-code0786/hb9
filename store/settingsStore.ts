import { create } from "zustand";
import { persist } from "zustand/middleware";

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
  toggleBiometric: () => void;
  setAutoLockMinutes: (minutes: number) => void;
  dismissInstallPrompt: () => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      darkMode: true,
      currency: "USD",
      language: "English",
      pinEnabled: false,
      biometricEnabled: false,
      autoLockMinutes: 5,
      installPromptVisible: true,
      setCurrency: (currency) => set({ currency }),
      setLanguage: (language) => set({ language }),
      toggleBiometric: () => set((state) => ({ biometricEnabled: !state.biometricEnabled })),
      setAutoLockMinutes: (autoLockMinutes) => set({ autoLockMinutes }),
      dismissInstallPrompt: () => set({ installPromptVisible: false })
    }),
    {
      name: "bitzenx-settings",
      partialize: (state) => ({
        darkMode: state.darkMode,
        currency: state.currency,
        language: state.language,
        biometricEnabled: state.biometricEnabled,
        autoLockMinutes: state.autoLockMinutes,
        installPromptVisible: state.installPromptVisible
      })
    }
  )
);
