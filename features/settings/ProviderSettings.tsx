"use client";

import { Activity, QrCode, RadioTower } from "lucide-react";
import { Panel } from "@/components/ui/Primitives";

export function ProviderSettings() {
  return (
    <div className="space-y-4" data-testid="provider-settings-screen">
      <Panel>
        <h1 className="text-2xl font-semibold">Provider Settings</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Review service availability for recharge and QR payments.
        </p>
      </Panel>
      <ProviderCard icon={RadioTower} title="Recharge" provider="Mobile top-up service" status="Ready" />
      <ProviderCard icon={QrCode} title="QR Payments" provider="Wallet payment requests" status="Ready" />
    </div>
  );
}

function ProviderCard({ icon: Icon, title, provider, status }: { icon: React.ElementType; title: string; provider: string; status: string }) {
  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-accent/15 p-3 text-accent"><Icon size={22} /></div>
          <div>
            <h2 className="font-semibold">{title}</h2>
            <p className="text-xs text-slate-400">{provider}</p>
          </div>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-mint/10 px-3 py-1 text-xs text-mint"><Activity size={13} /> {status}</span>
      </div>
    </Panel>
  );
}
