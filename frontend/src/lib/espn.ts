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

export async function fetchStandings(leagueKey: string): Promise<TeamRecord[]> {
  const cfg = ESPN_LEAGUES[leagueKey.toUpperCase()];
  if (!cfg) return [];

  const [data, liveStreaks] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    espnFetch<any>(`${ESPN_V2}/${cfg.sport}/${cfg.league}/standings`),
    fetchCurrentStreaks(cfg.sport, cfg.league),
  ]);
  if (!data) return [];

  const teams: TeamRecord[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groups: any[] = data.children ?? data.groups ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const group of groups) {
    const confName: string = group.name ?? group.abbreviation ?? "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const divisions: any[] = group.children ?? [];
    if (divisions.length) {
      for (const div of divisions) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const entries: any[] = div.standings?.entries ?? div.entries ?? [];
        for (const entry of entries) teams.push(parseEntry(entry, confName));
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entries: any[] = group.standings?.entries ?? group.entries ?? [];
      for (const entry of entries) teams.push(parseEntry(entry, confName));
    }
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
