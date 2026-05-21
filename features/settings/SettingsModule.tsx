"use client";

import { HelpCircle, Info, FileText } from "lucide-react";
import { Panel, Select } from "@/components/ui/Primitives";
import { BrandLogo } from "@/components/BrandLogo";
import { useSettingsStore } from "@/store/settingsStore";

export function SettingsModule({ onNavigate }: { onNavigate: (screen: "about" | "help" | "terms") => void }) {
  const settings = useSettingsStore();
  return (
    <div className="space-y-4">
      <Panel data-testid="settings-screen">
        <div className="flex items-center gap-3">
          <BrandLogo size="sm" showText />
          <div>
            <h1 className="text-2xl font-semibold">Settings</h1>
            <p className="text-sm text-slate-400">Account preferences and support</p>
          </div>
        </div>
      </Panel>
      <Panel className="space-y-3">
        <div>
          <div className="mb-2 text-sm text-slate-400">Currency</div>
          <Select value={settings.currency} onChange={(event) => settings.setCurrency(event.target.value)}>
            <option>USD</option>
            <option>INR</option>
            <option>AED</option>
            <option>GBP</option>
          </Select>
        </div>
        <div>
          <div className="mb-2 text-sm text-slate-400">Language</div>
          <Select value={settings.language} onChange={(event) => settings.setLanguage(event.target.value)}>
            <option>English</option>
            <option>Hindi</option>
            <option>Arabic</option>
            <option>Urdu</option>
          </Select>
        </div>
        <button className="settings-row" onClick={() => onNavigate("about")} type="button"><Info size={18} /> About HB9</button>
        <button className="settings-row" onClick={() => onNavigate("help")} type="button"><HelpCircle size={18} /> Help center</button>
        <button className="settings-row" onClick={() => onNavigate("terms")} type="button"><FileText size={18} /> Terms</button>
      </Panel>
    </div>
  );
}

export function StaticInfoPage({ title }: { title: string }) {
  return (
    <Panel>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-400">
        HB9 shows a business wallet interface for HB9 balances. External wallet connection is used only for BSC proof, USDT BEP20 approvals, and contract interaction.
      </p>
    </Panel>
  );
}
