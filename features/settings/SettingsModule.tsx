"use client";

import { HelpCircle, Info, Shield, FileText } from "lucide-react";
import { Panel, Select } from "@/components/ui/Primitives";
import { useSettingsStore } from "@/store/settingsStore";

export function SettingsModule({ onNavigate }: { onNavigate: (screen: "security" | "about" | "help" | "terms") => void }) {
  const settings = useSettingsStore();
  return (
    <div className="space-y-4">
      <Panel>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-2 text-sm text-slate-400">Wallet preferences and support</p>
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
        <button className="settings-row" onClick={() => onNavigate("security")} type="button"><Shield size={18} /> Security center</button>
        <button className="settings-row" onClick={() => onNavigate("about")} type="button"><Info size={18} /> About BitzenX</button>
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
        This production-ready placeholder keeps routing and UI structure ready for final legal, support, and product content.
      </p>
    </Panel>
  );
}
