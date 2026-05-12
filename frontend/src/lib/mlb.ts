const MLB_API = "https://statsapi.mlb.com/api/v1";

const _cache = new Map<string, { data: unknown; expiry: number }>();
const TTL = 60 * 60 * 1000; // 1 hour

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function mlbFetch<T>(url: string): Promise<T | null> {
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

export interface PitcherInfo {
  name: string;
  era: number;
  whip: number;
  k9: number;
  wins: number;
  losses: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchPitcherStats(personId: number): Promise<Omit<PitcherInfo, "name"> | null> {
  const data = await mlbFetch<any>(
    `${MLB_API}/people/${personId}?hydrate=stats(group=[pitching],type=[season])`,
  );
  if (!data) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const person = (data as any).people?.[0];
  if (!person) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statBlock = (person.stats ?? []).find((s: any) =>
    s.type?.displayName === "season" && s.group?.displayName === "pitching",
  );
  if (!statBlock) return null;
  const s = statBlock.stats;
  return {
    era:    parseFloat(s.era    ?? "0") || 0,
    whip:   parseFloat(s.whip   ?? "0") || 0,
    k9:     parseFloat(s.strikeoutsPer9Inn ?? "0") || 0,
    wins:   Number(s.wins   ?? 0),
    losses: Number(s.losses ?? 0),
  };
}

/**
 * Returns a map of lowercase team name → PitcherInfo for today's probable starters.
 * Pass an ISO date string (YYYY-MM-DD) to override today.
 */
export async function fetchMLBPitchers(date?: string): Promise<Map<string, PitcherInfo>> {
  const d = date ?? new Date().toISOString().slice(0, 10);
  const data = await mlbFetch<any>(
    `${MLB_API}/schedule?sportId=1&startDate=${d}&endDate=${d}&hydrate=probablePitcher,team`,
  );

  const result = new Map<string, PitcherInfo>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const games: any[] = (data as any)?.dates?.[0]?.games ?? [];

  await Promise.all(
    games.flatMap((game: any) =>
      (["home", "away"] as const).map(async (side) => {
        const teamData = game.teams?.[side];
        if (!teamData) return;
        const teamName: string = teamData.team?.name ?? "";
        const pitcher = teamData.probablePitcher;
        if (!pitcher?.id) return;
        const stats = await fetchPitcherStats(pitcher.id);
        if (stats) {
          result.set(teamName.toLowerCase(), {
            name: pitcher.fullName ?? pitcher.lastName ?? "",
            ...stats,
          });
        }
      }),
    ),
  );

  return result;
}

/** Fuzzy-match an Odds API team name to a probable pitcher. */
export function matchMLBPitcher(
  oddsTeamName: string,
  pitcherMap: Map<string, PitcherInfo>,
): PitcherInfo | undefined {
  const n = oddsTeamName.toLowerCase();
  const last = n.split(" ").pop() ?? n;
  for (const [key, val] of pitcherMap) {
    if (key === n || key.includes(n) || n.includes(key) || key.includes(last)) return val;
  }
  return undefined;
}
