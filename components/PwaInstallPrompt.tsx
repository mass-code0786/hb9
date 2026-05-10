"use client";

import { Download, ShieldCheck, Smartphone, Zap, X } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useSettingsStore } from "@/store/settingsStore";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstallPrompt() {
  const visible = useSettingsStore((state) => state.installPromptVisible);
  const dismiss = useSettingsStore((state) => state.dismissInstallPrompt);
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible || !prompt) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-[1.35rem] border border-white/10 bg-[#111722]/95 p-4 shadow-wallet backdrop-blur-xl"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-accent p-3 text-black"><Download size={18} /></div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Install BitzenX Wallet</div>
          <div className="mt-3 grid gap-2 text-xs leading-5 text-slate-300">
            <span className="flex items-center gap-2"><Zap size={14} className="text-accent" /> Faster access</span>
            <span className="flex items-center gap-2"><ShieldCheck size={14} className="text-accent" /> Secure local wallet</span>
            <span className="flex items-center gap-2"><Smartphone size={14} className="text-accent" /> Mobile app-like experience</span>
          </div>
        </div>
        <button className="rounded-xl bg-white/10 p-2 text-slate-300" onClick={dismiss} type="button" aria-label="Dismiss install prompt"><X size={16} /></button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-slate-100" onClick={dismiss} type="button">Dismiss</button>
        <button className="rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-black" onClick={async () => { await prompt.prompt(); dismiss(); }} type="button">Install</button>
      </div>
    </motion.div>
  );
}
