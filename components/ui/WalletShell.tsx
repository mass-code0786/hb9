"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Banknote, PackageCheck, Users, WalletCards, Home } from "lucide-react";
import type { AppTab } from "@/types/wallet";

const tabs: Array<{ id: AppTab; label: string; icon: React.ElementType }> = [
  { id: "home", label: "Home", icon: Home },
  { id: "products", label: "Products", icon: PackageCheck },
  { id: "team", label: "Team", icon: Users },
  { id: "income", label: "Income", icon: Banknote },
  { id: "wallet", label: "Wallet", icon: WalletCards }
];

export function WalletShell({
  children,
  activeTab,
  onTabChange,
  header
}: {
  children: React.ReactNode;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  header: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col overflow-y-auto overflow-x-hidden px-4 pb-[140px] pt-4 text-white [touch-action:pan-y] [overscroll-behavior-y:auto] [-webkit-overflow-scrolling:touch] md:max-w-6xl md:px-6">
      {header}
      <AnimatePresence mode="wait">
        <motion.section
          key={activeTab}
          className="flex-1"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
        >
          {children}
        </motion.section>
      </AnimatePresence>
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:max-w-2xl" data-testid="bottom-nav">
        <div className="grid grid-cols-5 rounded-full border border-cyan-300/25 bg-[#06111f]/90 p-2 shadow-[0_0_36px_rgba(34,211,238,0.24),0_18px_70px_rgba(14,165,233,0.18),0_14px_48px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <motion.button
                key={tab.id}
                whileTap={{ scale: 0.95 }}
                className={`flex h-14 flex-col items-center justify-center gap-1 rounded-full text-[11px] transition ${
                  active ? "bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 text-[#03111f] shadow-[0_0_28px_rgba(34,211,238,0.48)]" : "text-sky-100/75 hover:bg-cyan-400/[0.12] hover:text-white"
                }`}
                onClick={() => onTabChange(tab.id)}
                type="button"
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </motion.button>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
