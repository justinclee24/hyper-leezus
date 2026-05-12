import { NextResponse } from "next/server";
import {
  fetchStandings, fetchNews, fetchNextScheduledGames, fetchInjuries,
  ESPN_LEAGUES,
  type TeamRecord, type TeamInjuryReport,
} from "@/lib/espn";
import { fetchRedditContent } from "@/lib/reddit";
import { fetchNewsApiContent } from "@/lib/newsapi";
import { fetchMLBPitchers } from "@/lib/mlb";
import { fetchNHLStats, type NHLTeamStats } from "@/lib/nhl";

const _cache = new Map<string, { payload: unknown; expiry: number }>();
const CACHE_TTL = 30 * 60 * 1000;

// ─── Insight generation ───────────────────────────────────────────────────────

function generateInsights(
  league: string,
  standings: TeamRecord[],
  injuries: TeamInjuryReport[],
  nhlStats?: Map<string, NHLTeamStats>,
): string[] {
  const insights: string[] = [];

  if (standings.length > 0) {
    const byWin = [...standings].sort((a, b) => b.winPct - a.winPct);

    // League leader
    const best = byWin[0];
    if (best?.wins > 0) {
      insights.push(`${best.name} leads ${league} with a ${(best.winPct * 100).toFixed(1)}% win rate (${best.wins}–${best.losses})`);
    }

    // Hot streak (5+ wins)
    const hotTeam = standings.find((t) => t.streak?.startsWith("W") && parseInt(t.streak.slice(1)) >= 5);
    if (hotTeam) {
      insights.push(`${hotTeam.name} is on a ${hotTeam.streak} winning streak — one of ${league}'s hottest teams right now`);
    }

    // Cold streak (4+ losses)
    const coldTeam = standings.find((t) => t.streak?.startsWith("L") && parseInt(t.streak.slice(1)) >= 4);
    if (coldTeam) {
      insights.push(`${coldTeam.name} has dropped ${coldTeam.streak} straight — among ${league}'s coldest teams`);
    }

    // Scoring leader
    const offLeader = [...standings].filter((t) => t.pointsFor > 0).sort((a, b) => b.pointsFor - a.pointsFor)[0];
    if (offLeader) {
      const unit = ["NHL", "MLS", "EPL"].includes(league) ? "goals" : "points";
      insights.push(`${offLeader.name} paces ${league} in scoring at ${offLeader.pointsFor.toFixed(1)} ${unit}/game`);
    }

    // Best defense
    const defLeader = [...standings].filter((t) => t.pointsAgainst > 0).sort((a, b) => a.pointsAgainst - b.pointsAgainst)[0];
    if (defLeader) {
      const unit = ["NHL", "MLS", "EPL"].includes(league) ? "goals" : "points";
      insights.push(`${defLeader.name} is the stingiest defense in ${league}, allowing just ${defLeader.pointsAgainst.toFixed(1)} ${unit}/game`);
    }

    // Biggest gap between leader and last place
    const worst = byWin[byWin.length - 1];
    if (worst && best && best !== worst) {
      const gap = Math.round((best.winPct - worst.winPct) * 100);
      if (gap >= 30) {
        insights.push(`${gap}pp gap between ${best.abbreviation} (best) and ${worst.abbreviation} (worst) — one of the most uneven fields in ${league}`);
      }
    }

    // Near-.500 competitive tier — teams within 5% of .500
    const nearFifty = standings.filter((t) => t.wins + t.losses > 10 && Math.abs(t.winPct - 0.5) < 0.05);
    if (nearFifty.length >= 3) {
      insights.push(`${nearFifty.length} teams are within 5pp of .500 — ${league}'s middle tier is extremely competitive`);
    }
  }

  // Injury alerts
  const teams = injuries
    .map((t) => ({ ...t, outCount: t.players.filter((p) => p.status === "Out").length }))
    .filter((t) => t.outCount >= 2)
    .sort((a, b) => b.outCount - a.outCount);

  for (const t of teams.slice(0, 2)) {
    insights.push(`${t.teamName} is without ${t.outCount} players listed Out — watch their lines closely`);
  }

  // NHL special teams nuggets
  if (league === "NHL" && nhlStats && nhlStats.size > 0) {
    const sorted = [...nhlStats.values()].filter((t) => t.powerPlayPct > 0).sort((a, b) => b.powerPlayPct - a.powerPlayPct);
    const ppLeader = sorted[0];
    const ppWorst  = sorted[sorted.length - 1];
    if (ppLeader) {
      insights.push(`${ppLeader.teamName} has ${league}'s top power play at ${ppLeader.powerPlayPct.toFixed(1)}% — a major weapon on the man advantage`);
    }
    if (ppWorst && ppWorst !== ppLeader) {
      insights.push(`${ppWorst.teamName} has struggled on the power play (${ppWorst.powerPlayPct.toFixed(1)}%) — one of the league's weakest special teams units`);
    }
    // High-scoring teams
    const goalLeader = [...nhlStats.values()].sort((a, b) => b.goalsForPerGame - a.goalsForPerGame)[0];
    if (goalLeader) {
      insights.push(`${goalLeader.teamName} averages a league-best ${goalLeader.goalsForPerGame.toFixed(2)} goals/game — strong lean toward Overs`);
    }
  }

  return insights.slice(0, 10);
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const league = new URL(req.url).searchParams.get("league")?.toUpperCase() ?? "NBA";
  if (!ESPN_LEAGUES[league]) {
    return NextResponse.json({ error: "Unsupported league" }, { status: 400 });
  }

  const cached = _cache.get(league);
  if (cached && Date.now() < cached.expiry) {
    return NextResponse.json(cached.payload);
  }

  const isMLB = league === "MLB";
  const isNHL = league === "NHL";

  const [standings, espnNews, redditItems, newsApiItems, nextGames, injuries, mlbPitchers, nhlStats] =
    await Promise.all([
      fetchStandings(league).catch(() => []),
      fetchNews(league).catch(() => []),
      fetchRedditContent(league).catch(() => []),
      fetchNewsApiContent(league).catch(() => []),
      fetchNextScheduledGames(league).catch(() => []),
      fetchInjuries(league).catch(() => []),
      (isMLB ? fetchMLBPitchers() : Promise.resolve(null)).catch(() => null),
      (isNHL ? fetchNHLStats()    : Promise.resolve(null)).catch(() => null),
    ]);

  const news = [
    ...espnNews.map((n) => ({ ...n, source: "ESPN" as const })),
    ...redditItems,
    ...newsApiItems,
  ].sort((a, b) => {
    const ta = a.published ? new Date(a.published).getTime() : 0;
    const tb = b.published ? new Date(b.published).getTime() : 0;
    return tb - ta;
  });

  const insights = generateInsights(
    league,
    standings,
    injuries,
    nhlStats ?? undefined,
  );

  // Serialise pitcher map → array for JSON
  const pitcherMatchups = mlbPitchers
    ? [...mlbPitchers.entries()].map(([team, p]) => ({ team, ...p }))
    : null;

  // Serialise NHL stats → ranked array for JSON
  const specialTeams = nhlStats
    ? [...nhlStats.values()].sort((a, b) => b.powerPlayPct - a.powerPlayPct)
    : null;

  const payload = {
    league,
    standings,
    news,
    nextGames,
    injuries,
    insights,
    pitcherMatchups,
    specialTeams,
    hasData: standings.length > 0 || news.length > 0,
    updatedAt: new Date().toISOString(),
  };
  if (payload.hasData) {
    _cache.set(league, { payload, expiry: Date.now() + CACHE_TTL });
  }
  return NextResponse.json(payload);
}
