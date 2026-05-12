const NHL_API = "https://api-web.nhle.com/v1";

const _cache = new Map<string, { data: unknown; expiry: number }>();
const TTL = 60 * 60 * 1000; // 1 hour

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function nhlFetch<T>(url: string): Promise<T | null> {
  const hit = _cache.get(url);
  if (hit && Date.now() < hit.expiry) return hit.data as T;
  try {
    const resp = await fetch(url, { next: { revalidate: 3600 } });
    if (!resp.ok) return null;
    const data = await resp.json();
    _cache.set(url, { data, expiry: Date.now() + TTL });
    return data as T;
  } catch {
    return null;
  }
}

export interface NHLTeamStats {
  teamAbbr: string;
  teamName: string;
  powerPlayPct: number;    // e.g. 23.5
  penaltyKillPct: number;  // e.g. 82.1
  goalsForPerGame: number;
  goalsAgainstPerGame: number;
  shotsForPerGame: number;
  shotsAgainstPerGame: number;
}

/** Returns a map of UPPERCASE team abbreviation → NHLTeamStats. */
export async function fetchNHLStats(): Promise<Map<string, NHLTeamStats>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await nhlFetch<any>(`${NHL_API}/standings/now`);
  const result = new Map<string, NHLTeamStats>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const team of (data as any)?.standings ?? []) {
    const abbr: string = (team.teamAbbrev?.default ?? "").toUpperCase();
    if (!abbr) continue;
    const gp = team.gamesPlayed || 1;
    result.set(abbr, {
      teamAbbr: abbr,
      teamName: team.teamName?.default ?? team.teamCommonName?.default ?? abbr,
      powerPlayPct:        team.powerPlayPct      ?? 0,
      penaltyKillPct:      team.penaltyKillPct    ?? 0,
      goalsForPerGame:     team.goalsFor          ? team.goalsFor     / gp : 0,
      goalsAgainstPerGame: team.goalsAgainst      ? team.goalsAgainst / gp : 0,
      shotsForPerGame:     team.shotsForPerGame   ?? 0,
      shotsAgainstPerGame: team.shotsAgainstPerGame ?? 0,
    });
  }
  return result;
}

/** Fuzzy-match an Odds API team name to an NHL team in the stats map. */
export function matchNHLTeam(
  oddsTeamName: string,
  nhlStats: Map<string, NHLTeamStats>,
): NHLTeamStats | undefined {
  const n = oddsTeamName.toLowerCase();
  const last = n.split(" ").pop() ?? n;
  for (const [, stats] of nhlStats) {
    const sn = stats.teamName.toLowerCase();
    if (sn === n || sn.includes(n) || n.includes(sn) || sn.includes(last) || last.includes(stats.teamAbbr.toLowerCase())) {
      return stats;
    }
  }
  return undefined;
}
