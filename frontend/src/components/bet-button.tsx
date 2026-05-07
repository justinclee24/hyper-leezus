"use client";

import { Check, Plus } from "lucide-react";
import { useBets } from "@/hooks/useBets";
import type { BetRecommendation } from "@/lib/data";

export function TrackButton({ bet }: { bet: BetRecommendation }) {
  const { trackBet, isTracked, loaded } = useBets();

  if (!loaded) return <div className="h-5 w-14" />;

  if (isTracked(bet.gameId, bet.betType)) {
    return (
      <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
        <Check className="h-3 w-3" />
        Tracked
      </div>
    );
  }

  return (
    <button
      onClick={() =>
        trackBet({
          gameId: bet.gameId,
          matchup: bet.matchup,
          pick: bet.pick,
          betType: bet.betType,
          odds: bet.odds,
          edge: bet.edge,
          stake: 1,
          league: bet.league,
        })
      }
      className="flex items-center gap-1 rounded-md border border-orange-500/20 bg-orange-500/10 px-2 py-1 text-[10px] font-semibold text-orange-400 transition hover:bg-orange-500/20"
    >
      <Plus className="h-3 w-3" />
      Track
    </button>
  );
}
