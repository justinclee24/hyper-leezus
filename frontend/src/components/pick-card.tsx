"use client";

import { useEffect, useState } from "react";
import { BetActions } from "@/components/bet-actions";
import type { BetRecommendation } from "@/lib/data";
import type { PolymarketMarket } from "@/lib/polymarket";

export function PickCard({ bet }: { bet: BetRecommendation }) {
  const [pmMarket, setPmMarket] = useState<PolymarketMarket | undefined>();

  useEffect(() => {
    // Only fetch PM for Moneyline/Spread — Over/Under have no team to match
    if (bet.betType === "Over" || bet.betType === "Under") return;
    const teamPart = bet.pick.split(/\s+/)[0];
    if (!teamPart || teamPart.length < 4) return;
    fetch(`/api/polymarket?team=${encodeURIComponent(teamPart)}&sport=${encodeURIComponent(bet.league)}`)
      .then((r) => r.json())
      .then((res) => { if (res.markets?.[0]) setPmMarket(res.markets[0]); })
      .catch(() => {});
  }, [bet.pick, bet.betType, bet.league]);

  return (
    <div className="rounded-xl border border-orange-500/25 bg-orange-500/[0.06] p-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wider text-orange-400">
          {bet.betType}
        </div>
        {bet.hot && (
          <span className="rounded-md bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-400">
            Hot
          </span>
        )}
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
      <div className="mt-3 border-t border-white/[0.05] pt-2.5">
        <BetActions bet={bet} pmMarket={pmMarket} />
      </div>
    </div>
  );
}
