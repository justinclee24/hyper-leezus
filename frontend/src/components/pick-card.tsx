"use client";

import { TrackButton } from "@/components/bet-button";
import type { BetRecommendation } from "@/lib/data";

export function PickCard({ bet }: { bet: BetRecommendation }) {
  return (
    <div className="rounded-xl border border-orange-500/25 bg-orange-500/[0.06] p-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-orange-400">
          {bet.betType}
        </div>
        <div className="flex items-center gap-2">
          {bet.hot && (
            <span className="rounded-md bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-400">
              Hot
            </span>
          )}
          <TrackButton bet={bet} />
        </div>
      </div>
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-bold text-white">{bet.pick}</span>
        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-sm text-slate-400">
          {bet.odds}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <div className="flex-1">
          <div className="mb-1 flex justify-between text-[11px]">
            <span className="text-slate-500">Edge</span>
            <span className="text-orange-400">{Math.round(bet.edge * 100)}%</span>
          </div>
          <div className="h-1 rounded-full bg-white/5">
            <div
              className="h-1 rounded-full bg-orange-500"
              style={{ width: `${Math.min(bet.edge * 700, 100)}%` }}
            />
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500">Confidence</div>
          <div className="text-sm font-semibold">{Math.round(bet.confidence * 100)}%</div>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">{bet.reasoning}</p>
    </div>
  );
}
