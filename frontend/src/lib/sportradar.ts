const SR_BASE = "https://api.sportradar.com";
const ACCESS = () => process.env.SPORTRADAR_ACCESS_LEVEL ?? "trial";
const LANG = () => process.env.SPORTRADAR_LANGUAGE_CODE ?? "en";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TeamStats {
  id: string;
  name: string;
  alias: string;
  wins: number;
  losses: number;
  ties?: number;       // NFL
  otLosses?: number;   // NHL
  winPct: number;
  gamesPlayed: number;
  pointsFor: number;   // per game
  pointsAgainst: number;
  conference?: string;
  division?: string;
}

export interface InjuredPlayer {
  id: string;
  name: string;
  position?: string;
  status: "out" | "doubtful" | "questionable" | "probable";
  description?: string;
  impactScore: number; // 1.0=out, 0.75=doubtful, 0.45=questionable, 0.15=probable
}

export interface TeamInjuryReport {
  teamId: string;
  teamName: string;
  players: InjuredPlayer[];
}

// ─── Cache ────────────────────────────────────────────────────────────────────

const _cache = new Map<string, { data: unknown; expiry: number }>();

async function srFetch<T>(url: string, ttlMs: number): Promise<T | null> {
  const apiKey = process.env.SPORTRADAR_API_KEY;
  if (!apiKey) return null;

  const hit = _cache.get(url);
  if (hit && Date.now() < hit.expiry) return hit.data as T;

  try {
    const resp = await fetch(url, {
      headers: { "x-api-key": apiKey },
      cache: "no-store",
    });
    if (!resp.ok) {
      console.error(`[sportradar] ${resp.status} ${resp.statusText} — ${url}`);
      return null;
    }
    const data = await resp.json();
    _cache.set(url, { data, expiry: Date.now() + ttlMs });
    return data as T;
  } catch (err) {
    console.error("[sportradar] fetch error:", err);
    return null;
  }
}

// ─── Normalizers ──────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeNFLTeam(team: any, conf: string, div: string): TeamStats {
  const gp = (team.wins ?? 0) + (team.losses ?? 0) + (team.ties ?? 0);
  return {
    id: team.id,
    name: team.name,
    alias: team.alias,
    wins: team.wins ?? 0,
    losses: team.losses ?? 0,
    ties: team.ties ?? 0,
    winPct: team.win_pct ?? (gp > 0 ? (team.wins ?? 0) / gp : 0),
    gamesPlayed: gp,
    pointsFor: gp > 0 ? Math.round(((team.points_for ?? 0) / gp) * 10) / 10 : 0,
    pointsAgainst: gp > 0 ? Math.round(((team.points_against ?? 0) / gp) * 10) / 10 : 0,
    conference: conf,
    division: div,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeBasketballTeam(team: any, conf: string): TeamStats {
  const gp = (team.wins ?? 0) + (team.losses ?? 0);
  return {
    id: team.id,
    name: team.name,
    alias: team.alias,
    wins: team.wins ?? 0,
    losses: team.losses ?? 0,
    winPct: team.win_pct ?? (gp > 0 ? (team.wins ?? 0) / gp : 0),
    gamesPlayed: gp,
    pointsFor: team.points_for_avg ?? (gp > 0 ? Math.round(((team.points_scored ?? 0) / gp) * 10) / 10 : 0),
    pointsAgainst: team.points_against_avg ?? (gp > 0 ? Math.round(((team.points_allowed ?? 0) / gp) * 10) / 10 : 0),
    conference: conf,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeHockeyTeam(team: any, conf: string, div: string): TeamStats {
  const gp = (team.wins ?? 0) + (team.losses ?? 0) + (team.ot_losses ?? 0);
  return {
    id: team.id,
    name: team.name,
    alias: team.alias,
    wins: team.wins ?? 0,
    losses: team.losses ?? 0,
    otLosses: team.ot_losses ?? 0,
    winPct: team.win_pct ?? (gp > 0 ? (team.wins ?? 0) / gp : 0),
    gamesPlayed: gp,
    pointsFor: gp > 0 ? Math.round(((team.goals_for ?? 0) / gp) * 10) / 10 : 0,
    pointsAgainst: gp > 0 ? Math.round(((team.goals_against ?? 0) / gp) * 10) / 10 : 0,
    conference: conf,
    division: div,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeBaseballTeam(team: any, league: string, div: string): TeamStats {
  const gp = (team.wins ?? 0) + (team.losses ?? 0);
  return {
    id: team.id,
    name: team.name,
    alias: team.alias,
    wins: team.wins ?? 0,
    losses: team.losses ?? 0,
    winPct: team.win_pct ?? (gp > 0 ? (team.wins ?? 0) / gp : 0),
    gamesPlayed: gp,
    pointsFor: gp > 0 ? Math.round(((team.runs_scored ?? 0) / gp) * 10) / 10 : 0,
    pointsAgainst: gp > 0 ? Math.round(((team.runs_allowed ?? 0) / gp) * 10) / 10 : 0,
    conference: league,
    division: div,
  };
}

const IMPACT: Record<string, number> = { out: 1.0, doubtful: 0.75, questionable: 0.45, probable: 0.15 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractInjuries(data: any): TeamInjuryReport[] {
  const reports: TeamInjuryReport[] = [];
  for (const team of data?.teams ?? []) {
    const players: InjuredPlayer[] = [];
    for (const p of team?.players ?? []) {
      if (!p?.injury) continue;
      const status = (p.injury.status ?? "").toLowerCase() as InjuredPlayer["status"];
      if (!IMPACT[status]) continue;
      players.push({
        id: p.id ?? "",
        name: p.full_name ?? p.name ?? "Unknown",
        position: p.primary_position ?? p.position ?? undefined,
        status,
        description: p.injury.desc ?? p.injury.type ?? undefined,
        impactScore: IMPACT[status],
      });
    }
    if (players.length > 0) {
      reports.push({ teamId: team.id ?? "", teamName: team.name ?? "", players });
    }
  }
  return reports;
}

// ─── Public API ───────────────────────────────────────────────────────────────

const FOUR_HOURS = 4 * 60 * 60 * 1000;
const THIRTY_MIN = 30 * 60 * 1000;

export async function fetchStandings(league: string): Promise<TeamStats[]> {
  const a = ACCESS();
  const l = LANG();
  let url: string;

  switch (league.toUpperCase()) {
    case "NFL":
      url = `${SR_BASE}/nfl/official/${a}/v7/${l}/seasons/2025/REG/standings/season.json`;
      break;
    case "NBA":
      url = `${SR_BASE}/nba/${a}/v8/${l}/seasons/2024/REG/standings.json`;
      break;
    case "NHL":
      url = `${SR_BASE}/nhl/${a}/v7/${l}/seasons/20242025/REG/standings.json`;
      break;
    case "MLB":
      url = `${SR_BASE}/mlb/${a}/v7/${l}/seasons/2026/REG/standings.json`;
      break;
    default:
      return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await srFetch<any>(url, FOUR_HOURS);
  if (!data) return [];

  const teams: TeamStats[] = [];

  if (league.toUpperCase() === "NFL") {
    for (const conf of data.conferences ?? []) {
      for (const div of conf.divisions ?? []) {
        for (const t of div.teams ?? []) {
          teams.push(normalizeNFLTeam(t, conf.alias ?? conf.name ?? "", div.alias ?? div.name ?? ""));
        }
      }
    }
  } else if (league.toUpperCase() === "NBA") {
    for (const conf of data.conferences ?? []) {
      for (const t of conf.teams ?? []) {
        teams.push(normalizeBasketballTeam(t, conf.alias ?? conf.name ?? ""));
      }
    }
  } else if (league.toUpperCase() === "NHL") {
    for (const conf of data.conferences ?? []) {
      for (const div of conf.divisions ?? []) {
        for (const t of div.teams ?? []) {
          teams.push(normalizeHockeyTeam(t, conf.alias ?? conf.name ?? "", div.alias ?? div.name ?? ""));
        }
      }
    }
  } else if (league.toUpperCase() === "MLB") {
    for (const lg of data.leagues ?? []) {
      for (const div of lg.divisions ?? []) {
        for (const t of div.teams ?? []) {
          teams.push(normalizeBaseballTeam(t, lg.alias ?? lg.name ?? "", div.alias ?? div.name ?? ""));
        }
      }
    }
  }

  return teams;
}

export async function fetchInjuries(league: string): Promise<TeamInjuryReport[]> {
  const a = ACCESS();
  const l = LANG();

  const year = process.env.NFL_SEASON_YEAR ?? "2025";
  const type = process.env.NFL_SEASON_TYPE ?? "REG";
  const week = process.env.NFL_WEEK ?? "1";

  let url: string;
  switch (league.toUpperCase()) {
    case "NFL":
      url = `${SR_BASE}/nfl/official/${a}/v7/${l}/seasons/${year}/${type}/${week}/injuries.json`;
      break;
    case "NBA":
      url = `${SR_BASE}/nba/${a}/v8/${l}/league/injuries.json`;
      break;
    case "NHL":
      url = `${SR_BASE}/nhl/${a}/v7/${l}/league/injuries.json`;
      break;
    case "MLB":
      url = `${SR_BASE}/mlb/${a}/v8/${l}/league/injuries.json`;
      break;
    default:
      return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await srFetch<any>(url, THIRTY_MIN);
  if (!data) return [];
  return extractInjuries(data);
}

// Fuzzy-match a team name from the Odds API to a SportRadar TeamStats entry
export function matchTeam(oddsName: string, srTeams: TeamStats[]): TeamStats | undefined {
  const n = oddsName.toLowerCase();
  return (
    srTeams.find((t) => t.name.toLowerCase() === n) ??
    srTeams.find((t) => n.includes(t.name.toLowerCase()) || t.name.toLowerCase().includes(n)) ??
    srTeams.find((t) => n.includes(t.alias.toLowerCase()))
  );
}
