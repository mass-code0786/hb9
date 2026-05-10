"use client";

import { Fingerprint, LockKeyhole, ShieldCheck } from "lucide-react";
import { Panel, Select } from "@/components/ui/Primitives";
import { useSettingsStore } from "@/store/settingsStore";

export function SecurityCenter({ address }: { address: string }) {
  const settings = useSettingsStore();
  return (
    <div className="space-y-4">
      <Panel>
        <h1 className="text-2xl font-semibold">Security Center</h1>
        <p className="mt-2 text-sm text-slate-400">Sensitive wallet data remains encrypted locally with Web Crypto.</p>
      </Panel>
      <Panel className="space-y-3">
        <SecurityRow icon={LockKeyhole} title="App lock PIN" value={settings.pinEnabled ? "Enabled" : "Disabled"} onClick={settings.togglePin} />
        <SecurityRow icon={Fingerprint} title="Biometric unlock" value={settings.biometricEnabled ? "Enabled" : "Placeholder"} onClick={settings.toggleBiometric} />
        <div className="rounded-2xl bg-white/[0.045] p-3">
          <div className="mb-2 text-sm text-slate-400">Auto-lock timer</div>
          <Select value={settings.autoLockMinutes} onChange={(event) => settings.setAutoLockMinutes(Number(event.target.value))}>
            <option value={1}>1 minute</option>
            <option value={5}>5 minutes</option>
            <option value={15}>15 minutes</option>
            <option value={60}>1 hour</option>
          </Select>
        </div>
        <div className="rounded-2xl border border-accent/30 bg-accent/10 p-4 text-sm text-yellow-100">Backup phrase reminder: verify your offline recovery phrase before adding significant funds.</div>
        <div className="rounded-2xl bg-white/[0.045] p-3 text-sm">
          <div className="flex items-center gap-2 font-semibold"><ShieldCheck size={18} /> Device session</div>
          <div className="mt-2 break-all text-slate-400">{address || "Locked wallet"} | Current browser session</div>
        </div>
      </Panel>
    </div>
  );
}

function SecurityRow({ icon: Icon, title, value, onClick }: { icon: React.ElementType; title: string; value: string; onClick: () => void }) {
  return (
    <button className="flex w-full items-center justify-between rounded-2xl bg-white/[0.045] p-3 text-left" onClick={onClick} type="button">
      <span className="flex items-center gap-3"><Icon size={20} /> {title}</span>
      <span className="text-sm text-slate-400">{value}</span>
    </button>
  );
}
