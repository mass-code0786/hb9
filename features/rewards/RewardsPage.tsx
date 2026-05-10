"use client";

import { CalendarCheck, Gift, ReceiptText, Users } from "lucide-react";
import { Panel, PrimaryButton } from "@/components/ui/Primitives";

export function RewardsPage() {
  return (
    <div className="space-y-4" data-testid="rewards-screen">
      <Panel>
        <h1 className="text-xl font-semibold">Cashback Rewards</h1>
        <p className="mt-2 text-sm text-slate-400">Earn tracked rewards from referrals, recharge cashback, and daily activity.</p>
      </Panel>
      <RewardCard icon={Users} title="Referral rewards" value="$0.00" detail="Invite friends and track pending referral bonuses." />
      <RewardCard icon={ReceiptText} title="Recharge cashback" value="0.0%" detail="Cashback campaigns will appear here after provider activation." />
      <Panel>
        <div className="flex items-center gap-3"><CalendarCheck className="text-accent" /><h2 className="text-lg font-semibold">Daily check-in</h2></div>
        <div className="mt-4 grid grid-cols-7 gap-2">
          {Array.from({ length: 7 }, (_, index) => <div key={index} className="rounded-xl bg-white/[0.045] py-3 text-center text-xs text-slate-300">D{index + 1}</div>)}
        </div>
        <PrimaryButton className="mt-4 w-full" disabled>Check-in Coming Soon</PrimaryButton>
      </Panel>
      <Panel>
        <div className="flex items-center gap-3"><Gift className="text-accent" /><h2 className="text-lg font-semibold">Reward history</h2></div>
        <div className="mt-4 rounded-2xl bg-white/[0.045] p-4 text-sm text-slate-400">No rewards yet.</div>
      </Panel>
    </div>
  );
}

function RewardCard({ icon: Icon, title, value, detail }: { icon: React.ElementType; title: string; value: string; detail: string }) {
  return (
    <Panel>
      <div className="flex items-start gap-3">
        <span className="rounded-2xl bg-accent/15 p-3 text-accent"><Icon size={20} /></span>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <div className="mt-2 text-3xl font-semibold">{value}</div>
          <p className="mt-2 text-sm text-slate-400">{detail}</p>
        </div>
      </div>
    </Panel>
  );
}
