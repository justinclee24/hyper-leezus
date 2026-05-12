const ESPN_SITE = "https://site.api.espn.com/apis/site/v2/sports";
const ESPN_V2 = "https://site.api.espn.com/apis/v2/sports";

export const ESPN_LEAGUES: Record<string, { sport: string; league: string; label: string }> = {
  NBA:   { sport: "basketball", league: "nba",                        label: "NBA"   },
  NFL:   { sport: "football",   league: "nfl",                        label: "NFL"   },
  NHL:   { sport: "hockey",     league: "nhl",                        label: "NHL"   },
  MLB:   { sport: "baseball",   league: "mlb",                        label: "MLB"   },
  NCAAB: { sport: "basketball", league: "mens-college-basketball",    label: "NCAAB" },
  MLS:   { sport: "soccer",     league: "usa.1",                      label: "MLS"   },
  EPL:   { sport: "soccer",     league: "eng.1",                      label: "EPL"   },
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TeamRecord {
  id: string;
  name: string;
  abbreviation: string;
  wins: number;
  losses: number;
  winPct: number;
  pointsFor: number;   // per game
  pointsAgainst: number;
  streak: string;      // "W4", "L2"
  homeRecord: string;  // "24-5"
  awayRecord: string;  // "21-10"
  conference: string;
  gamesBack: number;
}

export interface NewsItem {
  id: string;
  headline: string;
  description: string;
  published: string;
  url: string;
  teams: string[];
  source?: "ESPN" | "Reddit" | "NewsAPI";
  subreddit?: string;   // Reddit only
  score?: number;       // Reddit upvotes
  comments?: number;    // Reddit comment count
  outlet?: string;      // NewsAPI source name
}

// ─── Module-level cache (30-min TTL — ESPN is free, no quota) ─────────────────

const _cache = new Map<string, { data: unknown; expiry: number }>();
const TTL = 30 * 60 * 1000;

async function espnFetch<T>(url: string): Promise<T | null> {
  const hit = _cache.get(url);
  if (hit && Date.now() < hit.expiry) return hit.data as T;
  try {
    const resp = await fetch(url, { next: { revalidate: 1800 } });
    if (!resp.ok) return null;
    const data = await resp.json();
    _cache.set(url, { data, expiry: Date.now() + TTL });
    return data as T;
  } catch {
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function statVal(stats: any[], name: string): number {
  return stats?.find((s: any) => s.name === name)?.value ?? 0;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function statDisp(stats: any[], name: string): string {
  return stats?.find((s: any) => s.name === name)?.displayValue ?? "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseEntry(entry: any, conf: string): TeamRecord {
  const stats: any[] = entry.stats ?? [];
  const wins   = statVal(stats, "wins");
  const losses = statVal(stats, "losses");
  const gp     = statVal(stats, "gamesPlayed") || wins + losses || 1;

  // Prefer per-game averages; fall back to season totals ÷ games played
  const rawPtsFor     = statVal(stats, "pointsFor");
  const rawPtsAgainst = statVal(stats, "pointsAgainst");
  const ptsFor = statVal(stats, "avgPointsFor") || statVal(stats, "pointsScoredAvg")
    || (rawPtsFor > 0 ? rawPtsFor / gp : 0);
  const ptsAgainst = statVal(stats, "avgPointsAgainst") || statVal(stats, "pointsAllowedAvg")
    || (rawPtsAgainst > 0 ? rawPtsAgainst / gp : 0);

  return {
    id:            entry.team?.id ?? "",
    name:          entry.team?.displayName ?? entry.team?.name ?? "",
    abbreviation:  entry.team?.abbreviation ?? "",
    wins,
    losses,
    winPct:        statVal(stats, "winPercent") || (wins / gp),
    pointsFor:     ptsFor,
    pointsAgainst: ptsAgainst,
    streak:        statDisp(stats, "streak") || statDisp(stats, "streakSummary"),
    homeRecord:    statDisp(stats, "home")   || statDisp(stats, "homeRecord"),
    awayRecord:    statDisp(stats, "road")   || statDisp(stats, "awayRecord"),
    conference:    conf,
    gamesBack:     statVal(stats, "gamesBehind"),
  };
}

// ─── Streak computation from scoreboard (includes playoffs) ──────────────────

function fmtDate(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

async function fetchCurrentStreaks(sport: string, league: string): Promise<Record<string, string>> {
  const end = new Date();
  const start = new Date(end.getTime() - 14 * 24 * 60 * 60 * 1000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await espnFetch<any>(
    `${ESPN_SITE}/${sport}/${league}/scoreboard?dates=${fmtDate(start)}-${fmtDate(end)}&limit=200`,
  );
  if (!data) return {};

  // Build per-team ordered result history
  const history: Record<string, Array<{ ts: number; won: boolean }>> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const event of data.events ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comp = (event.competitions ?? [])[0] as any;
    if (!comp?.status?.type?.completed && comp?.status?.type?.name !== "STATUS_FINAL") continue;
    const ts = new Date(event.date).getTime();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const c of comp.competitors ?? []) {
      const id: string = c.team?.id ?? c.id;
      if (!id) continue;
      (history[id] ??= []).push({ ts, won: c.winner === true });
    }
  }

  const streaks: Record<string, string> = {};
  for (const [id, games] of Object.entries(history)) {
    games.sort((a, b) => b.ts - a.ts);
    if (!games.length) continue;
    const dir = games[0].won ? "W" : "L";
    let n = 0;
    for (const g of games) {
      if (g.won === (dir === "W")) n++;
      else break;
    }
    streaks[id] = `${dir}${n}`;
  }
  return streaks;
}

// ─── Public API ───────────────────────────────────────────────────────────────

// Recursively collect team entries from ESPN's standings response.
// ESPN nests standings differently per sport:
//   NBA/NFL/NHL: groups → conference → division.standings.entries  (2 levels)
//   MLB:         groups → league → conference → division.standings.entries (3 levels)
// This handles any depth up to 4 levels so future structure changes don't break parsing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectEntries(node: any, conf: string, depth: number, out: TeamRecord[]): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries: any[] = node.standings?.entries ?? node.entries ?? [];
  if (entries.length) {
    for (const e of entries) out.push(parseEntry(e, conf));
    return;
  }
  if (depth >= 4) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const children: any[] = node.children ?? node.groups ?? [];
  // Use this node's name as the new conference label when recursing deeper
  const childConf = (node.name ?? node.abbreviation ?? "").trim() || conf;
  for (const child of children) collectEntries(child, childConf, depth + 1, out);
}

export async function fetchStandings(leagueKey: string): Promise<TeamRecord[]> {
  const cfg = ESPN_LEAGUES[leagueKey.toUpperCase()];
  if (!cfg) return [];

  const [data, liveStreaks] = await Promise.all([
    // Try V2 standings first; fall back to site endpoint if V2 returns no groups (e.g. MLB)
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const v2 = await espnFetch<any>(`${ESPN_V2}/${cfg.sport}/${cfg.league}/standings`);
      if ((v2?.children ?? v2?.groups ?? []).length > 0) return v2;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return espnFetch<any>(`${ESPN_SITE}/${cfg.sport}/${cfg.league}/standings`);
    })(),
    fetchCurrentStreaks(cfg.sport, cfg.league),
  ]);
  if (!data) return [];

  const teams: TeamRecord[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groups: any[] = data.children ?? data.groups ?? [];
  for (const group of groups) {
    const confName: string = (group.name ?? group.abbreviation ?? "").trim();
    collectEntries(group, confName, 0, teams);
  }

  // Deduplicate, then overlay live streaks from scoreboard (includes playoffs)
  const seen = new Set<string>();
  return teams
    .filter((t) => { if (!t.id || seen.has(t.id)) return false; seen.add(t.id); return true; })
    .map((t) => liveStreaks[t.id] ? { ...t, streak: liveStreaks[t.id] } : t);
}

export async function fetchNews(leagueKey: string): Promise<NewsItem[]> {
  const cfg = ESPN_LEAGUES[leagueKey.toUpperCase()];
  if (!cfg) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await espnFetch<any>(
    `${ESPN_SITE}/${cfg.sport}/${cfg.league}/news?limit=10`,
  );
  if (!data) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.articles ?? []).slice(0, 10).map((a: any) => ({
    id:          a.dataSourceIdentifier ?? a.id ?? String(Math.random()),
    headline:    a.headline ?? "",
    description: a.description ?? a.story ?? "",
    published:   a.published ?? "",
    url:         a.links?.web?.href ?? a.links?.api?.news?.href ?? "",
    teams:       (a.categories ?? [])
                   // eslint-disable-next-line @typescript-eslint/no-explicit-any
                   .filter((c: any) => c.type === "team")
                   // eslint-disable-next-line @typescript-eslint/no-explicit-any
                   .map((c: any) => c.description ?? c.shortName ?? ""),
  }));
}

// ─── Playoff bracket ─────────────────────────────────────────────────────────

export interface PlayoffSeries {
  seriesUid: string;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  homeWins: number;
  awayWins: number;
  seriesWinner?: string; // team ID once series is complete
  homeSeed: number;
  awaySeed: number;
  homeTeamName?: string;
  homeTeamAbbr?: string;
  awayTeamName?: string;
  awayTeamAbbr?: string;
}

// Approximate start of the current playoff season per sport, so the historical scoreboard
// fetch targets the playoff window rather than wasting the request limit on regular season games.
// ESPN returns events oldest-first; a 120-day window fills the 500-event cap with regular season.
function playoffSeasonStart(sport: string, league: string): Date {
  const now = new Date();
  const yr = now.getFullYear();

  // Candidate start dates (no off-by-one needed — just needs to be before actual playoff tipoff)
  let candidate: Date;
  if (sport === "football" && league === "nfl") {
    candidate = new Date(yr, 0, 8); // NFL wild card ~Jan 11
  } else if (sport === "baseball" && league === "mlb") {
    candidate = new Date(yr, 9, 1); // MLB wild card ~Oct 1-4
  } else if (sport === "basketball" && league === "mens-college-basketball") {
    candidate = new Date(yr, 2, 14); // March Madness ~Mar 18
  } else if (sport === "soccer") {
    candidate = new Date(yr, 9, 14); // MLS/cup playoffs ~Oct-Nov
  } else {
    // NBA, NHL, any other league: April 12-ish
    candidate = new Date(yr, 3, 12);
  }

  // If the candidate is in the future, roll back one year (we're in off-season)
  if (candidate > now) candidate = new Date(candidate.getFullYear() - 1, candidate.getMonth(), candidate.getDate());
  return candidate;
}

// Expected maximum duration (days) of each league's playoff run.
// If today is beyond start + max days, the playoffs have ended and we return [] so the
// futures page falls back to regular-season standings projections instead of stale bracket data.
const PLAYOFF_MAX_DAYS: Record<string, number> = {
  nfl:                         45,  // wild card ~Jan 11 → Super Bowl ~Feb 13
  "mens-college-basketball":   30,  // First Four ~Mar 18 → championship ~Apr 7
  mlb:                         45,  // wild card ~Oct 1 → World Series ~Nov 4
  // NBA, NHL, soccer default: 90 days (April → late June/July)
};

export async function fetchPlayoffSeries(sport: string, league: string): Promise<PlayoffSeries[]> {
  // Dual-fetch strategy:
  //   historical — uses a sport-specific start date targeting the playoff window so we don't
  //                fill the request limit with regular season games (ESPN returns oldest-first).
  //                limit=750 is ESPN's effective cap; larger values produce garbage.
  //   current    — no date filter, returns today's games including in-progress ones.
  const end = new Date();
  const start = playoffSeasonStart(sport, league);

  // Off-season guard: if today is past the expected end of the playoff window, return [] so the
  // futures page shows current-season standings projections rather than last season's bracket.
  const maxDays = PLAYOFF_MAX_DAYS[league] ?? 90;
  if (end.getTime() > start.getTime() + maxDays * 24 * 60 * 60 * 1000) return [];
  const [historical, current] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    espnFetch<any>(`${ESPN_SITE}/${sport}/${league}/scoreboard?seasontype=3&dates=${fmtDate(start)}-${fmtDate(end)}&limit=750`),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    espnFetch<any>(`${ESPN_SITE}/${sport}/${league}/scoreboard?seasontype=3&limit=200`),
  ]);

  // Deduplicate events from both responses by event ID
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eventById = new Map<string, any>();
  for (const event of [...(historical?.events ?? []), ...(current?.events ?? [])]) {
    const key: string = event.id ?? event.uid ?? "";
    if (key && !eventById.has(key)) eventById.set(key, event);
  }
  if (!eventById.size) return [];

  // Track wins by TEAM ID (not home/away slot) using three triangulated sources:
  //   1. competitor.winner     — boolean flag, present on recent records
  //   2. score comparison      — homeScore > awayScore; present on nearly all records
  //   3. competitor.series.wins — cumulative series wins ESPN provides; take maximum seen
  // Taking the max across all sources gives us reliable win counts even for older game records
  // where competitor.winner may be absent.
  type PairData = {
    idA: string; idB: string;       // idA < idB (lexicographic) — stable across all games
    winsA: number; winsB: number;   // accumulated from per-game winner detection
    cumWinsA: number; cumWinsB: number; // max cumulative series wins seen from ESPN field
    nameA: string; abbrA: string;
    nameB: string; abbrB: string;
    seedA: number; seedB: number;
    espnWinner?: string;            // ESPN explicit series winner — most authoritative
    round: number;
    seriesUid: string;
    latestTs: number;
  };
  const pairs = new Map<string, PairData>();

  for (const event of eventById.values()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comp = (event.competitions ?? [])[0] as any;
    if (!comp) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const seriesData = comp.series as any;
    // Skip events without series data — these are regular season games, not playoffs
    if (!seriesData) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const competitors: any[] = comp.competitors ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const home = competitors.find((c: any) => c.homeAway === "home");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const away = competitors.find((c: any) => c.homeAway === "away");
    if (!home || !away) continue;

    const homeId: string = home.team?.id ?? home.id ?? "";
    const awayId: string = away.team?.id ?? away.id ?? "";
    if (!homeId || !awayId) continue;

    const [idA, idB] = homeId < awayId ? [homeId, awayId] : [awayId, homeId];
    const pairKey = `${idA}|${idB}`;
    const ts = new Date(event.date ?? 0).getTime();

    // Stable "A"/"B" labels based on sorted ID order — consistent across all games in series
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const teamA = homeId === idA ? home : away;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const teamB = homeId === idB ? home : away;

    const isCompleted: boolean =
      comp.status?.type?.completed === true || comp.status?.type?.name === "STATUS_FINAL";

    // Per-game winner: flag first, then score comparison
    const flagWinner: string | undefined = isCompleted
      ? home.winner === true ? homeId : away.winner === true ? awayId : undefined
      : undefined;
    const homeScore = parseInt(String(home.score ?? "-1"));
    const awayScore = parseInt(String(away.score ?? "-1"));
    const scoreWinner: string | undefined =
      isCompleted && homeScore >= 0 && awayScore >= 0 && homeScore !== awayScore
        ? homeScore > awayScore ? homeId : awayId
        : undefined;
    const gameWinnerId = flagWinner ?? scoreWinner;

    // Cumulative series wins from ESPN's series.competitors snapshot (most reliable source).
    // ESPN returns these as numbers, e.g. {id:"5", wins:4} — updated after every game.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const seriesComps: any[] = seriesData.competitors ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scA = seriesComps.find((c: any) => String(c.id) === idA);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scB = seriesComps.find((c: any) => String(c.id) === idB);
    const cumWinsA = Number(scA?.wins ?? 0);
    const cumWinsB = Number(scB?.wins ?? 0);

    // Series winner: ESPN sets series.completed=true when the series ends.
    // There is no series.winner.id field — determine winner from max cumulative wins.
    let espnWinner: string | undefined;
    if (seriesData.completed === true && seriesComps.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bestComp = seriesComps.reduce((best: any, c: any) =>
        Number(c.wins) > Number(best?.wins ?? -1) ? c : best, null);
      if (bestComp) {
        const wId = String(bestComp.id);
        if (wId === idA) espnWinner = idA;
        else if (wId === idB) espnWinner = idB;
        else {
          // Handle UID format "s:40~t:5" → "5"
          const m = wId.match(/~t:(\d+)$/) ?? wId.match(/^(\d+)$/);
          const extracted = m?.[1];
          if (extracted === idA) espnWinner = idA;
          else if (extracted === idB) espnWinner = idB;
        }
      }
    }

    const existing = pairs.get(pairKey);
    if (!existing) {
      pairs.set(pairKey, {
        idA, idB,
        winsA: gameWinnerId === idA ? 1 : 0,
        winsB: gameWinnerId === idB ? 1 : 0,
        cumWinsA, cumWinsB,
        nameA: teamA.team?.displayName ?? teamA.team?.name ?? "",
        abbrA: teamA.team?.abbreviation ?? "",
        nameB: teamB.team?.displayName ?? teamB.team?.name ?? "",
        abbrB: teamB.team?.abbreviation ?? "",
        seedA: parseInt(teamA.curatedRank?.current ?? "0") || 0,
        seedB: parseInt(teamB.curatedRank?.current ?? "0") || 0,
        espnWinner,
        round: seriesData?.round ?? comp.playoffSeries?.round ?? 1,
        seriesUid: seriesData?.uid ?? event.uid ?? event.id ?? "",
        latestTs: ts,
      });
    } else {
      if (gameWinnerId === idA) existing.winsA++;
      else if (gameWinnerId === idB) existing.winsB++;
      // Keep highest cumulative wins ever seen — most recent game has the most up-to-date snapshot
      if (cumWinsA > existing.cumWinsA) existing.cumWinsA = cumWinsA;
      if (cumWinsB > existing.cumWinsB) existing.cumWinsB = cumWinsB;
      if (!existing.espnWinner && espnWinner) existing.espnWinner = espnWinner;
      if (ts > existing.latestTs) {
        existing.latestTs = ts;
        existing.round = seriesData?.round ?? comp.playoffSeries?.round ?? existing.round;
        existing.seriesUid = seriesData?.uid ?? event.uid ?? event.id ?? existing.seriesUid;
        if (parseInt(teamA.curatedRank?.current ?? "0") > 0)
          existing.seedA = parseInt(teamA.curatedRank!.current);
        if (parseInt(teamB.curatedRank?.current ?? "0") > 0)
          existing.seedB = parseInt(teamB.curatedRank!.current);
        if (teamA.team?.displayName) existing.nameA = teamA.team.displayName;
        if (teamA.team?.abbreviation) existing.abbrA = teamA.team.abbreviation;
        if (teamB.team?.displayName) existing.nameB = teamB.team.displayName;
        if (teamB.team?.abbreviation) existing.abbrB = teamB.team.abbreviation;
      }
    }
  }

  // seriesWinner: set when series.completed===true (winner = competitor with max wins).
  // homeWins/awayWins = max(per-game accumulated, ESPN cumulative snapshot) for dual safety.
  return [...pairs.values()].map((p) => ({
    seriesUid: p.seriesUid,
    round: p.round,
    homeTeamId: p.idA,
    awayTeamId: p.idB,
    homeWins: Math.max(p.winsA, p.cumWinsA),
    awayWins: Math.max(p.winsB, p.cumWinsB),
    seriesWinner: p.espnWinner,
    homeSeed: p.seedA,
    awaySeed: p.seedB,
    homeTeamName: p.nameA,
    homeTeamAbbr: p.abbrA,
    awayTeamName: p.nameB,
    awayTeamAbbr: p.abbrB,
  }));
}

// ─── Head-to-Head ─────────────────────────────────────────────────────────────

export interface H2HMeeting {
  date: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  winner: "home" | "away";
  homeAbbr: string;
  awayAbbr: string;
}

export async function fetchHeadToHead(
  homeTeamId: string,
  awayTeamId: string,
  sport: string,
  league: string,
  limit = 5,
): Promise<H2HMeeting[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await espnFetch<any>(
    `${ESPN_SITE}/${sport}/${league}/teams/${homeTeamId}/schedule`,
  );
  if (!data) return [];

  const meetings: H2HMeeting[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events = [...(data.events ?? [])].reverse(); // most recent first

  for (const event of events) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comp = (event.competitions ?? [])[0] as any;
    if (!comp?.status?.type?.completed) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const competitors: any[] = comp.competitors ?? [];
    const hasOpponent = competitors.some((c: any) => c.team?.id === awayTeamId);
    if (!hasOpponent) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const homeComp = competitors.find((c: any) => c.homeAway === "home");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const awayComp = competitors.find((c: any) => c.homeAway === "away");
    if (!homeComp || !awayComp) continue;

    meetings.push({
      date: event.date ?? "",
      homeTeamId: homeComp.team?.id ?? "",
      awayTeamId: awayComp.team?.id ?? "",
      homeScore: parseInt(homeComp.score ?? "0") || 0,
      awayScore: parseInt(awayComp.score ?? "0") || 0,
      winner: homeComp.winner === true ? "home" : "away",
      homeAbbr: homeComp.team?.abbreviation ?? "",
      awayAbbr: awayComp.team?.abbreviation ?? "",
    });

    if (meetings.length >= limit) break;
  }
  return meetings;
}

export interface ScheduledGame {
  date: string;
  home: string;
  away: string;
  homeAbbr: string;
  awayAbbr: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseScheduledGamesFromData(data: any, limit: number, nowMs: number): ScheduledGame[] {
  if (!data) return [];
  const games: ScheduledGame[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const event of data.events ?? []) {
    if (games.length >= limit) break;
    const eventMs = new Date(event.date ?? "").getTime();
    if (!isNaN(eventMs) && eventMs < nowMs) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comp = (event.competitions ?? [])[0] as any;
    if (!comp || comp.status?.type?.completed) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const competitors: any[] = comp.competitors ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const home = competitors.find((c: any) => c.homeAway === "home");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const away = competitors.find((c: any) => c.homeAway === "away");
    if (!home || !away) continue;
    games.push({
      date: event.date ?? "",
      home: home.team?.displayName ?? home.team?.name ?? "",
      away: away.team?.displayName ?? away.team?.name ?? "",
      homeAbbr: home.team?.abbreviation ?? "",
      awayAbbr: away.team?.abbreviation ?? "",
    });
  }
  return games;
}

async function fetchNextGamesViaTeamSchedule(sport: string, league: string, limit: number): Promise<ScheduledGame[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teamsData = await espnFetch<any>(`${ESPN_SITE}/${sport}/${league}/teams?limit=50`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const teams: any[] = teamsData?.sports?.[0]?.leagues?.[0]?.teams ?? teamsData?.teams ?? [];
  if (!teams.length) return [];

  const nowMs = Date.now();
  const yr = new Date().getFullYear();
  const month = new Date().getMonth();

  // NBA/NHL seasons start in Oct and are named by start year (e.g. 2025-26 season = season=2025).
  // In Jan-Sep we're in the previous year's season. All other sports use current calendar year.
  const isOctStart = (sport === "basketball" && league === "nba") || (sport === "hockey" && league === "nhl");
  const seasonYear = isOctStart && month < 9 ? yr - 1 : yr;

  const games: ScheduledGame[] = [];
  const seen = new Set<string>();

  for (const teamEntry of teams) {
    if (games.length >= limit) break;
    const teamId: string = teamEntry.team?.id ?? teamEntry.id ?? "";
    if (!teamId) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const schedData = await espnFetch<any>(
      `${ESPN_SITE}/${sport}/${league}/teams/${teamId}/schedule?season=${seasonYear}`,
    );
    if (!schedData) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const event of schedData.events ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const comp = (event.competitions ?? [])[0] as any;
      if (!comp || comp.status?.type?.completed) continue;
      const eventMs = new Date(event.date ?? "").getTime();
      if (isNaN(eventMs) || eventMs < nowMs) continue;

      const key: string = event.id ?? "";
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const competitors: any[] = comp.competitors ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const home = competitors.find((c: any) => c.homeAway === "home");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const away = competitors.find((c: any) => c.homeAway === "away");
      if (!home || !away) continue;

      games.push({
        date: event.date ?? "",
        home: home.team?.displayName ?? home.team?.name ?? "",
        away: away.team?.displayName ?? away.team?.name ?? "",
        homeAbbr: home.team?.abbreviation ?? "",
        awayAbbr: away.team?.abbreviation ?? "",
      });
      if (games.length >= limit) break;
    }
  }

  games.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return games.slice(0, limit);
}

export async function fetchNextScheduledGames(leagueKey: string, limit = 5): Promise<ScheduledGame[]> {
  const cfg = ESPN_LEAGUES[leagueKey.toUpperCase()];
  if (!cfg) return [];

  const now = new Date();
  const nowMs = now.getTime();
  const far = new Date(nowMs + 120 * 24 * 60 * 60 * 1000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await espnFetch<any>(
    `${ESPN_SITE}/${cfg.sport}/${cfg.league}/scoreboard?dates=${fmtDate(now)}-${fmtDate(far)}&limit=100`,
  );

  const games = parseScheduledGamesFromData(data, limit, nowMs);
  if (games.length > 0) return games;

  // Scoreboard returned nothing — try individual team schedules with the correct season year
  const fromTeams = await fetchNextGamesViaTeamSchedule(cfg.sport, cfg.league, limit);
  if (fromTeams.length > 0) return fromTeams;

  // Last resort: ask ESPN for week 1 of the upcoming regular season directly.
  // This works for sports that use week-based scheduling (NFL, NCAAB, NCAAF).
  const yr = now.getFullYear();
  const month = now.getMonth();
  const isOctStart = (cfg.sport === "basketball" && cfg.league === "nba") || (cfg.sport === "hockey" && cfg.league === "nhl");
  const seasonYear = isOctStart && month < 9 ? yr - 1 : yr;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const week1Data = await espnFetch<any>(
    `${ESPN_SITE}/${cfg.sport}/${cfg.league}/scoreboard?seasontype=2&week=1&season=${seasonYear}`,
  );
  // Pass nowMs=0 so we include Week 1 games even if the season hasn't started yet —
  // showing the opener date is useful context for off-season visitors.
  return parseScheduledGamesFromData(week1Data, limit, 0);
}

// ─── Injuries ────────────────────────────────────────────────────────────────

export interface InjuredPlayer {
  name: string;
  position: string;
  status: string;       // "Out", "Doubtful", "Questionable", "Day-To-Day"
  injuryType: string;
}

export interface TeamInjuryReport {
  teamId: string;
  teamName: string;
  teamAbbr: string;
  players: InjuredPlayer[];
}

export async function fetchInjuries(leagueKey: string): Promise<TeamInjuryReport[]> {
  const cfg = ESPN_LEAGUES[leagueKey.toUpperCase()];
  if (!cfg) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await espnFetch<any>(`${ESPN_SITE}/${cfg.sport}/${cfg.league}/injuries`);
  if (!data) return [];

  const reports: TeamInjuryReport[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const entry of (data.injuries ?? []) as any[]) {
    const team = entry.team ?? {};
    const players: InjuredPlayer[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const inj of (entry.injuries ?? []) as any[]) {
      const status: string = inj.status ?? inj.fantasyStatus?.description ?? "";
      if (!status || ["Active", "Active-Game Time Decision"].includes(status)) continue;
      players.push({
        name:        inj.athlete?.displayName ?? inj.athlete?.shortName ?? "",
        position:    inj.athlete?.position?.abbreviation ?? "",
        status,
        injuryType:  inj.details?.type ?? inj.type?.abbreviation ?? inj.shortComment ?? "",
      });
    }
    if (players.length > 0) {
      reports.push({
        teamId:   team.id ?? "",
        teamName: team.displayName ?? team.name ?? "",
        teamAbbr: team.abbreviation ?? "",
        players,
      });
    }
  }
  return reports;
}

/** Returns the most recent completed game date per ESPN team ID over the past 14 days. */
export async function fetchLastGameDates(sport: string, league: string): Promise<Map<string, Date>> {
  const end   = new Date();
  const start = new Date(end.getTime() - 14 * 24 * 60 * 60 * 1000);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await espnFetch<any>(
    `${ESPN_SITE}/${sport}/${league}/scoreboard?dates=${fmtDate(start)}-${fmtDate(end)}&limit=200`,
  );
  if (!data) return new Map();

  const lastGame = new Map<string, Date>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const event of (data.events ?? []) as any[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comp = (event.competitions ?? [])[0] as any;
    const completed =
      comp?.status?.type?.completed === true || comp?.status?.type?.name === "STATUS_FINAL";
    if (!completed) continue;
    const gameDate = new Date(event.date ?? "");
    if (isNaN(gameDate.getTime())) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const c of (comp.competitors ?? []) as any[]) {
      const id: string = c.team?.id ?? c.id ?? "";
      if (!id) continue;
      const existing = lastGame.get(id);
      if (!existing || gameDate > existing) lastGame.set(id, gameDate);
    }
  }
  return lastGame;
}

// ─── Fuzzy-match ──────────────────────────────────────────────────────────────

// Fuzzy-match an Odds API team name to a TeamRecord
export function matchTeam(oddsName: string, teams: TeamRecord[]): TeamRecord | undefined {
  const n = oddsName.toLowerCase();
  const last = n.split(" ").pop() ?? n;
  return (
    teams.find((t) => t.name.toLowerCase() === n) ??
    teams.find((t) => n.includes(t.name.toLowerCase()) || t.name.toLowerCase().includes(n)) ??
    teams.find((t) => t.name.toLowerCase().includes(last) || last.includes(t.abbreviation.toLowerCase()))
  );
}

// PPG difference threshold at which a scoring/defensive edge is worth calling out
const PPG_THRESHOLD: Record<string, number> = {
  NHL: 0.4, MLS: 0.3, EPL: 0.3,
};

// Generate betting-relevant tidbits from two team records
export function buildTidbits(away: TeamRecord, home: TeamRecord, league?: string): string[] {
  const tips: string[] = [];
  const ptsThreshold = PPG_THRESHOLD[league?.toUpperCase() ?? ""] ?? 3;
  const scoringLabel = ["NHL"].includes(league?.toUpperCase() ?? "") ? "goals" : ["MLS", "EPL"].includes(league?.toUpperCase() ?? "") ? "goals" : "points";

  // Streak (require 3+ game streak to mention it)
  const homeStreak   = parseInt(home.streak?.slice(1) ?? "0");
  const awayStreak   = parseInt(away.streak?.slice(1) ?? "0");
  const homeStreakDir = home.streak?.charAt(0);
  const awayStreakDir = away.streak?.charAt(0);
  if (homeStreak >= 3) tips.push(`${home.name} on a ${homeStreak}-game ${homeStreakDir === "W" ? "win" : "losing"} streak`);
  if (awayStreak >= 3) tips.push(`${away.name} on a ${awayStreak}-game ${awayStreakDir === "W" ? "win" : "losing"} streak`);

  // Scoring edge
  if (home.pointsFor > 0 && away.pointsFor > 0) {
    const diff = home.pointsFor - away.pointsFor;
    if (Math.abs(diff) >= ptsThreshold) {
      const better = diff > 0 ? home : away;
      tips.push(`${better.name} averages ${Math.abs(diff).toFixed(1)} more ${scoringLabel} per game`);
    }
  }

  // Defensive edge
  if (home.pointsAgainst > 0 && away.pointsAgainst > 0) {
    const diff = away.pointsAgainst - home.pointsAgainst;
    if (Math.abs(diff) >= ptsThreshold) {
      const better = diff > 0 ? home : away;
      tips.push(`${better.name} allows ${Math.abs(diff).toFixed(1)} fewer ${scoringLabel} per game`);
    }
  }

  // Home/away record context
  if (home.homeRecord) tips.push(`${home.name} at home: ${home.homeRecord}`);
  if (away.awayRecord) tips.push(`${away.name} on the road: ${away.awayRecord}`);

  // Win% edge
  const wDiff = home.winPct - away.winPct;
  if (Math.abs(wDiff) >= 0.1) {
    const better = wDiff > 0 ? home : away;
    tips.push(`${better.name} has a ${Math.round(Math.abs(wDiff) * 100)}pp win rate advantage`);
  }

  return tips.slice(0, 4);
}
