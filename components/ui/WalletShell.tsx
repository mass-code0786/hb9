"use client";

import { motion } from "framer-motion";
import { BarChart3, Compass, Gift, Home, Repeat2 } from "lucide-react";
import type { AppTab } from "@/types/wallet";

const tabs: Array<{ id: AppTab; label: string; icon: React.ElementType }> = [
  { id: "home", label: "Home", icon: Home },
  { id: "markets", label: "Markets", icon: BarChart3 },
  { id: "trade", label: "Trade", icon: Repeat2 },
  { id: "rewards", label: "Rewards", icon: Gift },
  { id: "discover", label: "Discover", icon: Compass }
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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-x-hidden px-4 pb-36 pt-4 text-slate-50 md:max-w-6xl md:px-6">
      {header}
      <motion.section
        className="flex-1"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        {children}
      </motion.section>
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:max-w-2xl">
        <div className="grid grid-cols-5 rounded-[1.6rem] border border-white/10 bg-[#121722]/95 p-2 shadow-wallet backdrop-blur-xl">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`flex h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[11px] transition ${
                  active ? "bg-accent text-black" : "text-slate-400 hover:text-white"
                }`}
                onClick={() => onTabChange(tab.id)}
                type="button"
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
