"use client";

import { Download } from "lucide-react";
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
    <div className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-md rounded-[1.4rem] border border-white/10 bg-panel/95 p-4 shadow-wallet backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-accent p-3 text-black"><Download size={18} /></div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Install BitzenX</div>
          <div className="text-xs text-slate-400">Add the wallet to your home screen.</div>
        </div>
        <button className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-black" onClick={async () => { await prompt.prompt(); dismiss(); }} type="button">Install</button>
        <button className="rounded-xl bg-white/10 px-3 py-2 text-sm" onClick={dismiss} type="button">Later</button>
      </div>
    </div>
  );
}
