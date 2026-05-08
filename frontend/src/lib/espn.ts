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
  const gp     = wins + losses || 1;
  return {
    id:           entry.team?.id ?? "",
    name:         entry.team?.displayName ?? entry.team?.name ?? "",
    abbreviation: entry.team?.abbreviation ?? "",
    wins,
    losses,
    winPct:       statVal(stats, "winPercent") || (wins / gp),
    pointsFor:    statVal(stats, "pointsFor")  || statVal(stats, "avgPointsFor")  || statVal(stats, "pointsScoredAvg"),
    pointsAgainst: statVal(stats, "pointsAgainst") || statVal(stats, "avgPointsAgainst") || statVal(stats, "pointsAllowedAvg"),
    streak:       statDisp(stats, "streak") || statDisp(stats, "streakSummary"),
    homeRecord:   statDisp(stats, "home")   || statDisp(stats, "homeRecord"),
    awayRecord:   statDisp(stats, "road")   || statDisp(stats, "awayRecord"),
    conference:   conf,
    gamesBack:    statVal(stats, "gamesBehind"),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function fetchStandings(leagueKey: string): Promise<TeamRecord[]> {
  const cfg = ESPN_LEAGUES[leagueKey.toUpperCase()];
  if (!cfg) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await espnFetch<any>(
    `${ESPN_V2}/${cfg.sport}/${cfg.league}/standings`,
  );
  if (!data) return [];

  const teams: TeamRecord[] = [];
  // ESPN wraps in groups/children at multiple nesting levels
  const groups: any[] = data.children ?? data.groups ?? [];
  for (const group of groups) {
    const confName: string = group.name ?? group.abbreviation ?? "";
    const inner: any[] = group.children ?? group.standings?.entries ?? [];
    // Handle two-level nesting (conference → division)
    for (const sub of inner) {
      const entries: any[] = sub.standings?.entries ?? sub.entries ?? (Array.isArray(sub) ? sub : []);
      if (entries.length) {
        for (const entry of entries) teams.push(parseEntry(entry, confName));
      } else {
        // sub is itself a group-level entry
        teams.push(parseEntry(sub, confName));
      }
    }
    // Flat entries directly on group
    const direct: any[] = group.standings?.entries ?? [];
    for (const entry of direct) teams.push(parseEntry(entry, confName));
  }
  return teams.filter((t) => t.id);
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

// Generate betting-relevant tidbits from two team records
export function buildTidbits(away: TeamRecord, home: TeamRecord): string[] {
  const tips: string[] = [];

  // Streak
  const homeStreak  = parseInt(home.streak?.slice(1) ?? "0");
  const awayStreak  = parseInt(away.streak?.slice(1) ?? "0");
  const homeStreakDir = home.streak?.charAt(0);
  const awayStreakDir = away.streak?.charAt(0);
  if (homeStreak >= 3)  tips.push(`${home.name} is on a ${homeStreakDir}${homeStreak} streak`);
  if (awayStreak >= 3)  tips.push(`${away.name} is on a ${awayStreakDir}${awayStreak} streak`);

  // Scoring edge
  if (home.pointsFor > 0 && away.pointsFor > 0) {
    const diff = home.pointsFor - away.pointsFor;
    if (Math.abs(diff) >= 3) {
      const better = diff > 0 ? home : away;
      tips.push(`${better.name} averages ${Math.abs(diff).toFixed(1)} more points per game`);
    }
  }

  // Defensive edge
  if (home.pointsAgainst > 0 && away.pointsAgainst > 0) {
    const diff = away.pointsAgainst - home.pointsAgainst;
    if (Math.abs(diff) >= 3) {
      const better = diff > 0 ? home : away;
      tips.push(`${better.name} allows ${Math.abs(diff).toFixed(1)} fewer points per game`);
    }
  }

  // Home/away record context
  if (home.homeRecord)  tips.push(`${home.name} at home: ${home.homeRecord}`);
  if (away.awayRecord)  tips.push(`${away.name} on the road: ${away.awayRecord}`);

  // Win% edge
  const wDiff = home.winPct - away.winPct;
  if (Math.abs(wDiff) >= 0.1) {
    const better = wDiff > 0 ? home : away;
    tips.push(`${better.name} has a ${Math.round(Math.abs(wDiff) * 100)}pp win rate advantage`);
  }

  return tips.slice(0, 4);
}
