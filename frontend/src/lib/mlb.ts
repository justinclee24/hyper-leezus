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
  if (!s) return null;
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

// ─── Home plate umpire ────────────────────────────────────────────────────────

export interface UmpireInfo {
  name: string;
  paceFactor: number;  // negative = pitcher-friendly/lean Under, positive = hitter-friendly/lean Over
}

// Historical home plate umpire tendencies (zone size → run-scoring impact).
// Large zone → more Ks, fewer walks → fewer baserunners → lean Under.
// Small/inconsistent zone → more walks, longer counts → lean Over.
const UMP_TENDENCIES: Record<string, number> = {
  // Hitter-friendly / lean Over
  "CB Bucknor":          +0.25,
  "Alfonso Marquez":     +0.20,
  "Angel Hernandez":     +0.20,
  "Laz Diaz":            +0.15,
  "Dan Bellino":         +0.15,
  "Vic Carapazza":       +0.10,
  // Pitcher-friendly / lean Under
  "Phil Cuzzi":          -0.25,
  "Hunter Wendelstedt":  -0.20,
  "Dan Iassogna":        -0.20,
  "Mark Carlson":        -0.15,
  "Mike Everitt":        -0.15,
  "Adam Hamari":         -0.10,
  "Marvin Hudson":       -0.10,
};

/** Returns a map of mlbHomeTeamName.toLowerCase() → UmpireInfo for today's games. */
export async function fetchMLBUmpires(date?: string): Promise<Map<string, UmpireInfo>> {
  const d = date ?? new Date().toISOString().slice(0, 10);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await mlbFetch<any>(
    `${MLB_API}/schedule?sportId=1&startDate=${d}&endDate=${d}&hydrate=officials,team`,
  );

  const result = new Map<string, UmpireInfo>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const games: any[] = data?.dates?.[0]?.games ?? [];

  for (const game of games) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const officials: any[] = game.officials ?? [];
    const hp = officials.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (o: any) => (o.officialType ?? "").toLowerCase().includes("plate") || o.officialType === "Home Plate",
    );
    if (!hp?.official?.fullName) continue;
    const name: string = hp.official.fullName;
    const homeTeamName: string = game.teams?.home?.team?.name ?? "";
    if (homeTeamName) {
      result.set(homeTeamName.toLowerCase(), {
        name,
        paceFactor: UMP_TENDENCIES[name] ?? 0,
      });
    }
  }
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

/** Fuzzy-match an Odds API home team name to an umpire assignment. */
export function matchMLBUmpire(
  oddsTeamName: string,
  umpireMap: Map<string, UmpireInfo>,
): UmpireInfo | undefined {
  const n = oddsTeamName.toLowerCase();
  const last = n.split(" ").pop() ?? n;
  for (const [key, val] of umpireMap) {
    if (key === n || key.includes(n) || n.includes(key) || key.includes(last)) return val;
  }
  return undefined;
}
