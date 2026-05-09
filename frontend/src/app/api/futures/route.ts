import { NextRequest, NextResponse } from "next/server";
import { fetchStandings, fetchPlayoffSeries, ESPN_LEAGUES } from "@/lib/espn";
import type { TeamRecord, PlayoffSeries } from "@/lib/espn";

export const runtime = "nodejs";

// Wins needed to advance per league (best-of-7 = 4, single game = 1)
const SERIES_WINS: Record<string, number> = {
  NBA: 4, NHL: 4, MLB: 4, NFL: 1, NCAAB: 1, MLS: 1, EPL: 1,
};
// Playoff field size per conference (0 = standings-only league like EPL)
const PLAYOFF_SIZE: Record<string, number> = {
  NBA: 8, NHL: 8, MLB: 6, NFL: 7, NCAAB: 16, MLS: 8, EPL: 0,
};

// ─── Simulation math ──────────────────────────────────────────────────────────

// Per-game win probability for teamA, with optional home-court edge
function gameProb(a: TeamRecord, b: TeamRecord): number {
  const total = a.winPct + b.winPct;
  if (total < 0.01) return 0.5;
  return Math.min(0.93, Math.max(0.07, (a.winPct + 0.03) / (total + 0.03)));
}

// Memoised recursive series win probability: P(A wins | p, aW, bW, needed)
const _memo = new Map<string, number>();
function seriesWinProb(p: number, aw: number, bw: number, need: number): number {
  if (aw >= need) return 1;
  if (bw >= need) return 0;
  const k = `${Math.round(p * 1000)},${aw},${bw},${need}`;
  const hit = _memo.get(k);
  if (hit !== undefined) return hit;
  const v = p * seriesWinProb(p, aw + 1, bw, need) + (1 - p) * seriesWinProb(p, aw, bw + 1, need);
  _memo.set(k, v);
  return v;
}

// Simulate one best-of-N series from current state; return winner
function simSeries(a: TeamRecord, b: TeamRecord, aw: number, bw: number, need: number): TeamRecord {
  const p = gameProb(a, b);
  let ca = aw, cb = bw;
  while (ca < need && cb < need) {
    if (Math.random() < p) ca++; else cb++;
  }
  return ca >= need ? a : b;
}

// Simulate one full bracket run from current playoff state; return champion teamId
function simOneBracket(
  bracketTeams: TeamRecord[],
  activeSeries: PlayoffSeries[],
  allCompletedWinners: Set<string>,
  need: number,
  teamMap: Map<string, TeamRecord>,
): string {
  // Phase 1: resolve current active series
  const advancing = new Set<string>(allCompletedWinners);
  for (const s of activeSeries) {
    const a = teamMap.get(s.homeTeamId);
    const b = teamMap.get(s.awayTeamId);
    if (!a || !b) continue;
    const winner = simSeries(a, b, s.homeWins, s.awayWins, need);
    advancing.add(winner.id);
  }

  // Phase 2: simulate remaining rounds until champion
  let current: TeamRecord[] = advancing.size
    ? [...advancing].map((id) => teamMap.get(id)).filter(Boolean) as TeamRecord[]
    : [...bracketTeams];

  current.sort((a, b) => b.winPct - a.winPct);

  while (current.length > 1) {
    const next: TeamRecord[] = [];
    // Standard seeding: 1 vs last, 2 vs 2nd-to-last …
    const half = Math.floor(current.length / 2);
    for (let i = 0; i < half; i++) {
      next.push(simSeries(current[i], current[current.length - 1 - i], 0, 0, need));
    }
    // Odd team gets a bye (shouldn't happen in well-formed brackets, but handle gracefully)
    if (current.length % 2 === 1) next.push(current[Math.floor(current.length / 2)]);
    current = next.sort((a, b) => b.winPct - a.winPct);
  }

  return current[0]?.id ?? "";
}

// ─── Route handler ────────────────────────────────────────────────────────────

export interface FuturesPick {
  teamId: string;
  teamName: string;
  abbreviation: string;
  conference: string;
  wins: number;
  losses: number;
  winPct: number;
  champProb: number;
  confFinalsProb: number;
  eliminated: boolean;
  seriesRecord?: string;
  seriesLeading?: boolean;
  streak?: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const leagueKey = (searchParams.get("league") ?? "NBA").toUpperCase();

  const cfg = ESPN_LEAGUES[leagueKey];
  const need = SERIES_WINS[leagueKey] ?? 4;
  const playoffSize = PLAYOFF_SIZE[leagueKey] ?? 8;

  if (!cfg) return NextResponse.json({ picks: [], isPlayoffs: false, message: "Unknown league" });
  if (playoffSize === 0) {
    return NextResponse.json({ picks: [], isPlayoffs: false, message: "This league has no playoff format — see standings for title race." });
  }

  const [standings, allSeries] = await Promise.all([
    fetchStandings(leagueKey),
    fetchPlayoffSeries(cfg.sport, cfg.league),
  ]);

  if (!standings.length) {
    return NextResponse.json({ picks: [], isPlayoffs: false, message: "No standings data — league may be in off-season." });
  }

  const teamMap = new Map<string, TeamRecord>(standings.map((t) => [t.id, t]));
  // Fallback lookup maps for when IDs differ between standings and scoreboard APIs
  const teamByAbbr = new Map<string, TeamRecord>(
    standings.map((t) => [t.abbreviation.toLowerCase(), t]),
  );
  const teamByName = new Map<string, TeamRecord>(
    standings.map((t) => [t.name.toLowerCase(), t]),
  );

  function lookupTeam(id: string, name?: string, abbr?: string): TeamRecord | undefined {
    if (teamMap.has(id)) return teamMap.get(id);
    if (abbr) {
      const byAbbr = teamByAbbr.get(abbr.toLowerCase());
      if (byAbbr) return byAbbr;
    }
    if (name) {
      const byName = teamByName.get(name.toLowerCase());
      if (byName) return byName;
      // Partial match: e.g. "Detroit Pistons" matches entry keyed by "pistons"
      const nameLc = name.toLowerCase();
      for (const [k, v] of teamByName) {
        if (nameLc.includes(k) || k.includes(nameLc)) return v;
      }
    }
    return undefined;
  }

  const isPlayoffs = allSeries.length > 0;

  // Resolve IDs from playoff series to canonical IDs in teamMap (handles ID mismatches)
  function resolveId(rawId: string, name?: string, abbr?: string): string {
    const team = lookupTeam(rawId, name, abbr);
    return team?.id ?? rawId;
  }

  // Re-key completed/active series using canonical IDs
  const resolvedAllSeries = allSeries.map((s) => ({
    ...s,
    homeTeamId: resolveId(s.homeTeamId, s.homeTeamName, s.homeTeamAbbr),
    awayTeamId: resolveId(s.awayTeamId, s.awayTeamName, s.awayTeamAbbr),
    seriesWinner: s.seriesWinner
      ? resolveId(
          s.seriesWinner,
          s.seriesWinner === s.homeTeamId ? s.homeTeamName : s.awayTeamName,
          s.seriesWinner === s.homeTeamId ? s.homeTeamAbbr : s.awayTeamAbbr,
        )
      : undefined,
  }));
  const resolvedCompleted = resolvedAllSeries.filter((s) => s.seriesWinner);
  const resolvedActive = resolvedAllSeries.filter((s) => !s.seriesWinner);

  // Eliminated = teams that lost a completed series
  const eliminated = new Set<string>(
    resolvedCompleted.map((s) => (s.seriesWinner === s.homeTeamId ? s.awayTeamId : s.homeTeamId)),
  );
  // Already-advanced = winners of completed series
  const advancedWinners = new Set<string>(resolvedCompleted.map((s) => s.seriesWinner!));

  // Determine bracket field
  let bracketTeams: TeamRecord[];
  if (isPlayoffs) {
    const allPlayoffIds = new Set(resolvedAllSeries.flatMap((s) => [s.homeTeamId, s.awayTeamId]));
    bracketTeams = [...allPlayoffIds]
      .filter((id) => !eliminated.has(id))
      .map((id) => teamMap.get(id))
      .filter(Boolean) as TeamRecord[];
    // Fallback: if ID resolution still missed teams, use sorted standings
    if (!bracketTeams.length) {
      const sortedStandings = [...standings].sort((a, b) => b.winPct - a.winPct);
      bracketTeams = sortedStandings.slice(0, playoffSize * 2);
    }
  } else {
    // Pre-playoffs: project top-N per conference
    const conferences = [...new Set(standings.map((t) => t.conference))].filter(Boolean);
    if (conferences.length >= 2) {
      bracketTeams = [];
      for (const conf of conferences) {
        const confTeams = standings
          .filter((t) => t.conference === conf)
          .sort((a, b) => {
            // Sort by win% first; fall back to raw wins if win% is 0 (e.g. early season)
            const byPct = b.winPct - a.winPct;
            return byPct !== 0 ? byPct : b.wins - a.wins;
          })
          .slice(0, playoffSize);
        bracketTeams.push(...confTeams);
      }
    } else {
      const sorted = [...standings].sort((a, b) => b.winPct - a.winPct || b.wins - a.wins);
      bracketTeams = sorted.slice(0, playoffSize * 2);
    }
  }

  // Monte Carlo championship simulation
  const N = 4000;
  const champCounts: Record<string, number> = {};
  const confFinalsCounts: Record<string, number> = {};
  for (const t of bracketTeams) {
    champCounts[t.id] = 0;
    confFinalsCounts[t.id] = 0;
  }

  for (let i = 0; i < N; i++) {
    _memo.clear(); // clear memoization between sims (probabilities vary by matchup)
    const champId = simOneBracket(bracketTeams, resolvedActive, advancedWinners, need, teamMap);
    if (champId in champCounts) champCounts[champId]++;
  }

  // Also compute "semi-final" (conference finals / final 4) probability analytically
  // P(team reaches final N/2) using seriesWinProb over projected matchups
  for (const t of bracketTeams) {
    if (eliminated.has(t.id)) continue;
    const p = t.winPct;
    const avgOppWinPct = bracketTeams
      .filter((o) => o.id !== t.id)
      .reduce((sum, o) => sum + o.winPct, 0) / Math.max(bracketTeams.length - 1, 1);
    const perGame = p / (p + avgOppWinPct + 0.001);
    // Approximate: probability of winning 2 rounds (before Finals)
    confFinalsCounts[t.id] = Math.round(seriesWinProb(perGame, 0, 0, need) ** 2 * 1000);
  }

  // Build results
  const activePicks: FuturesPick[] = bracketTeams.map((t) => {
    const activeSerie = resolvedActive.find((s) => s.homeTeamId === t.id || s.awayTeamId === t.id);
    let seriesRecord: string | undefined;
    let seriesLeading: boolean | undefined;
    if (activeSerie) {
      const isHome = activeSerie.homeTeamId === t.id;
      const myW = isHome ? activeSerie.homeWins : activeSerie.awayWins;
      const theirW = isHome ? activeSerie.awayWins : activeSerie.homeWins;
      seriesRecord = `${myW}–${theirW}`;
      seriesLeading = myW > theirW;
    }

    return {
      teamId: t.id,
      teamName: t.name,
      abbreviation: t.abbreviation,
      conference: t.conference,
      wins: t.wins,
      losses: t.losses,
      winPct: t.winPct,
      champProb: (champCounts[t.id] ?? 0) / N,
      confFinalsProb: Math.min(0.99, confFinalsCounts[t.id] / 1000),
      eliminated: false,
      seriesRecord,
      seriesLeading,
      streak: t.streak,
    };
  });

  const eliminatedPicks: FuturesPick[] = [...eliminated]
    .map((id) => teamMap.get(id))
    .filter(Boolean)
    .map((t) => ({
      teamId: t!.id,
      teamName: t!.name,
      abbreviation: t!.abbreviation,
      conference: t!.conference,
      wins: t!.wins,
      losses: t!.losses,
      winPct: t!.winPct,
      champProb: 0,
      confFinalsProb: 0,
      eliminated: true,
      streak: t!.streak,
    }));

  const picks = [...activePicks.sort((a, b) => b.champProb - a.champProb), ...eliminatedPicks];

  return NextResponse.json({
    picks,
    isPlayoffs,
    leagueKey,
    simulations: N,
    bracketSize: bracketTeams.length,
    activeSeriesCount: resolvedActive.length,
  });
}
