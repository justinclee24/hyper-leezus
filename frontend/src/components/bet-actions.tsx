"use client";

import { useState } from "react";
import { Check, ExternalLink, Plus } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useBets } from "@/hooks/useBets";
import type { BetRecommendation } from "@/lib/data";
import type { PolymarketMarket } from "@/lib/polymarket";

export const DK_LINKS: Record<string, string> = {
  NBA:   "https://sportsbook.draftkings.com/leagues/basketball/nba",
  NFL:   "https://sportsbook.draftkings.com/leagues/football/nfl",
  NHL:   "https://sportsbook.draftkings.com/leagues/hockey/nhl",
  MLB:   "https://sportsbook.draftkings.com/leagues/baseball/mlb",
  NCAAB: "https://sportsbook.draftkings.com/leagues/basketball/college-basketball",
  MLS:   "https://sportsbook.draftkings.com/leagues/soccer/mls",
  EPL:   "https://sportsbook.draftkings.com/leagues/soccer/epl",
};

export function BetActions({
  bet,
  pmMarket,
}: {
  bet: BetRecommendation;
  pmMarket?: PolymarketMarket;
}) {
  const { trackBet, isTracked, loaded, authenticated, plan } = useBets();
  const router = useRouter();
  const pathname = usePathname();
  const [justTracked, setJustTracked] = useState(false);

  if (!loaded) return <div className="h-5 w-24" />;

  const tracked = isTracked(bet.gameId, bet.betType) || justTracked;
  const dkUrl = DK_LINKS[bet.league.toUpperCase()];

  function doTrack(): boolean {
    if (!authenticated) {
      router.push(`/login?from=${encodeURIComponent(pathname)}`);
      return false;
    }
    if (plan !== "pro" && plan !== "admin") {
      router.push("/upgrade");
      return false;
    }
    if (!tracked) {
      trackBet({
        gameId: bet.gameId,
        matchup: bet.matchup,
        pick: bet.pick,
        betType: bet.betType,
        odds: bet.odds,
        edge: bet.edge,
        stake: 1,
        league: bet.league,
        gameDate: bet.gameDate,
      });
      setJustTracked(true);
    }
    return true;
  }

  function handleDK(e: React.MouseEvent) {
    e.preventDefault();
    doTrack();
    if (dkUrl) window.open(dkUrl, "_blank", "noopener,noreferrer");
  }

  function handlePM(e: React.MouseEvent) {
    e.preventDefault();
    doTrack();
    if (pmMarket) window.open(pmMarket.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tracked ? (
        <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
          <Check className="h-3 w-3" />
          Tracked
        </div>
      ) : (
        <button
          onClick={() => doTrack()}
          className="flex items-center gap-1 rounded-md border border-orange-500/20 bg-orange-500/10 px-2 py-1 text-[10px] font-semibold text-orange-400 transition hover:bg-orange-500/20"
        >
          <Plus className="h-3 w-3" />
          Track
        </button>
      )}

      {dkUrl && (
        <button
          onClick={handleDK}
          title={`Track & bet on DraftKings`}
          className="flex items-center gap-1 rounded-md border border-orange-500/20 bg-orange-500/10 px-2 py-1 text-[10px] font-semibold text-orange-400 transition hover:bg-orange-500/20"
        >
          <ExternalLink className="h-2.5 w-2.5" />
          DK
        </button>
      )}

      {pmMarket && (
        <button
          onClick={handlePM}
          title={pmMarket.question}
          className="flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-1 text-[10px] font-semibold text-purple-400 transition hover:bg-purple-500/20"
        >
          <ExternalLink className="h-2.5 w-2.5" />
          PM {Math.round(pmMarket.probability * 100)}%
        </button>
      )}
    </div>
  );
}
