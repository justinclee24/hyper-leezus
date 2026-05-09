import { NextRequest, NextResponse } from "next/server";
import { ESPN_LEAGUES } from "@/lib/espn";

export const runtime = "nodejs";

// Debug endpoint: returns raw ESPN scoreboard data so we can see what the API actually returns.
// Usage: GET /api/debug-playoff?league=NBA
export async function GET(req: NextRequest) {
  const league = (req.nextUrl.searchParams.get("league") ?? "NBA").toUpperCase();
  const cfg = ESPN_LEAGUES[league];
  if (!cfg) return NextResponse.json({ error: "Unknown league" });

  const base = `https://site.api.espn.com/apis/site/v2/sports/${cfg.sport}/${cfg.league}/scoreboard`;

  const now = new Date();
  const start = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

  const [histResp, currResp] = await Promise.all([
    fetch(`${base}?seasontype=3&dates=${fmt(start)}-${fmt(now)}&limit=500`),
    fetch(`${base}?seasontype=3&limit=200`),
  ]);

  const [hist, curr] = await Promise.all([
    histResp.ok ? histResp.json() : null,
    currResp.ok ? currResp.json() : null,
  ]);

  const histEvents = hist?.events ?? [];
  const currEvents = curr?.events ?? [];

  // Show first completed game from each source with full competitor data
  const firstHistCompleted = histEvents.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => e.competitions?.[0]?.status?.type?.completed || e.competitions?.[0]?.status?.type?.name === "STATUS_FINAL",
  );
  const firstCurrCompleted = currEvents.find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => e.competitions?.[0]?.status?.type?.completed || e.competitions?.[0]?.status?.type?.name === "STATUS_FINAL",
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function summariseEvent(e: any) {
    if (!e) return null;
    const comp = e.competitions?.[0];
    const competitors = comp?.competitors ?? [];
    return {
      id: e.id,
      date: e.date,
      status: comp?.status?.type,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      competitors: competitors.map((c: any) => ({
        id: c.id,
        teamId: c.team?.id,
        teamName: c.team?.displayName,
        abbr: c.team?.abbreviation,
        homeAway: c.homeAway,
        score: c.score,
        winner: c.winner,
        series: c.series,
        curatedRank: c.curatedRank,
      })),
      series: comp?.series,
      statusWinner: comp?.status?.winner,
    };
  }

  // Count events by status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const histCompleted = histEvents.filter((e: any) =>
    e.competitions?.[0]?.status?.type?.completed || e.competitions?.[0]?.status?.type?.name === "STATUS_FINAL",
  ).length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currCompleted = currEvents.filter((e: any) =>
    e.competitions?.[0]?.status?.type?.completed || e.competitions?.[0]?.status?.type?.name === "STATUS_FINAL",
  ).length;

  // Show all unique team pairs (series) from historical
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pairSummary: Record<string, { games: number; wins: Record<string, number>; cumWins: Record<string, string>; espnWinner?: string }> = {};
  for (const e of histEvents) {
    const comp = e.competitions?.[0];
    const [home, away] = [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      comp?.competitors?.find((c: any) => c.homeAway === "home"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      comp?.competitors?.find((c: any) => c.homeAway === "away"),
    ];
    if (!home || !away) continue;
    const hId = home.team?.id ?? home.id ?? "?";
    const aId = away.team?.id ?? away.id ?? "?";
    const [idA, idB] = hId < aId ? [hId, aId] : [aId, hId];
    const key = `${idA}|${idB}`;
    if (!pairSummary[key]) pairSummary[key] = { games: 0, wins: {}, cumWins: {}, espnWinner: comp?.series?.winner?.id };
    pairSummary[key].games++;
    const isCompleted = comp?.status?.type?.completed || comp?.status?.type?.name === "STATUS_FINAL";
    if (isCompleted) {
      const hScore = parseInt(String(home.score ?? "-1"));
      const aScore = parseInt(String(away.score ?? "-1"));
      const winnerId = home.winner === true ? hId : away.winner === true ? aId
        : (hScore >= 0 && aScore >= 0 && hScore !== aScore) ? (hScore > aScore ? hId : aId) : null;
      if (winnerId) pairSummary[key].wins[winnerId] = (pairSummary[key].wins[winnerId] ?? 0) + 1;
    }
    // Cumulative series wins
    const teamA = hId === idA ? home : away;
    const teamB = hId === idB ? home : away;
    if (teamA.series?.wins !== undefined) pairSummary[key].cumWins[idA] = String(teamA.series.wins);
    if (teamB.series?.wins !== undefined) pairSummary[key].cumWins[idB] = String(teamB.series.wins);
  }

  return NextResponse.json({
    league,
    histUrl: `${base}?seasontype=3&dates=${fmt(start)}-${fmt(now)}&limit=500`,
    currUrl: `${base}?seasontype=3&limit=200`,
    histEventCount: histEvents.length,
    currEventCount: currEvents.length,
    histCompletedCount: histCompleted,
    currCompletedCount: currCompleted,
    seriesPairs: pairSummary,
    sampleHistCompleted: summariseEvent(firstHistCompleted),
    sampleCurrCompleted: summariseEvent(firstCurrCompleted),
  });
}
