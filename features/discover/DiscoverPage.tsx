"use client";

import Link from "next/link";
import { BriefcaseBusiness } from "lucide-react";
import { Panel } from "@/components/ui/Primitives";

export function DiscoverPage() {
  return (
    <div className="space-y-4" data-testid="hb-entry-screen">
      <Panel>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-accent p-3 text-black"><BriefcaseBusiness size={22} /></div>
          <div>
            <h1 className="text-xl font-semibold">HB9</h1>
            <p className="mt-1 text-sm text-slate-400">Open the HB9 dashboard.</p>
          </div>
        </div>
        <Link className="mt-5 flex w-full items-center justify-center rounded-2xl bg-accent px-4 py-3 font-semibold text-black" href="/halal-business">
          Open HB
        </Link>
      </Panel>
    </div>
  );
}
