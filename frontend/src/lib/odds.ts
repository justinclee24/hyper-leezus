import type { BetRecommendation, GameCard, TeamStats } from "./data";
import { getOddsCache, setOddsCache } from "./db";
import { fetchStandings, matchTeam, type TeamRecord } from "./espn";

export const SPORTS: Record<string, string> = {
  basketball_nba: "NBA",
  icehockey_nhl: "NHL",
  baseball_mlb: "MLB",
  americanfootball_nfl: "NFL",
  basketball_ncaab: "NCAAB",
  soccer_usa_mls: "MLS",
  soccer_epl: "EPL",
  mma_mixed_martial_arts: "MMA",
};

// Months (0=Jan) each sport has active games. Fetching off-season sports wastes API credits.
const SPORT_ACTIVE_MONTHS: Record<string, number[]> = {
  basketball_nba:          [0,1,2,3,4,5,9,10,11],  // Oct–Jun
  icehockey_nhl:           [0,1,2,3,4,5,9,10,11],  // Oct–Jun
  baseball_mlb:            [2,3,4,5,6,7,8,9],       // Mar–Oct
  americanfootball_nfl:    [0,1,8,9,10,11],          // Sep–Feb
  basketball_ncaab:        [0,1,2,3,10,11],          // Nov–Apr
  soccer_usa_mls:          [1,2,3,4,5,6,7,8,9,10],  // Feb–Nov
  soccer_epl:              [0,1,2,3,4,7,8,9,10,11], // Aug–May
  mma_mixed_martial_arts:  [0,1,2,3,4,5,6,7,8,9,10,11], // year-round
};

/** Returns the subset of SPORTS keys that are in-season right now. */
export function activeSeasonSports(): Record<string, string> {
  const m = new Date().getMonth();
  return Object.fromEntries(
    Object.entries(SPORTS).filter(([key]) => SPORT_ACTIVE_MONTHS[key]?.includes(m) ?? true),
  );
}

// Historical league season averages used for total line edge detection
const LEAGUE_AVG_TOTALS: Record<string, number> = {
  NBA: 228,
  NHL: 5.8,
  MLB: 8.7,
  NFL: 47,
  NCAAB: 148,
  MLS: 3.0,
  EPL: 2.8,
};

function parseRecord(s: string): { wins: number; losses: number } {
  const [w, l] = (s ?? "").split("-").map(Number);
  return { wins: w || 0, losses: l || 0 };
}

function recordWinPct(record: string): number {
  const { wins, losses } = parseRecord(record);
  const total = wins + losses;
  return total > 0 ? wins / total : 0;
}

function parseStreak(s: string): number {
  if (!s) return 0;
  const dir = s.charAt(0);
  const n = parseInt(s.slice(1)) || 0;
  return dir === "W" ? n : -n;
}

function toTeamStats(r: TeamRecord): TeamStats {
  return {
    ppg:        Math.round(r.pointsFor * 10) / 10,
    dppg:       Math.round(r.pointsAgainst * 10) / 10,
    winPct:     Math.round(r.winPct * 1000) / 1000,
    homeWinPct: Math.round(recordWinPct(r.homeRecord) * 1000) / 1000,
    awayWinPct: Math.round(recordWinPct(r.awayRecord) * 1000) / 1000,
    streak:     parseStreak(r.streak),
  };
}

interface OddsOutcome {
  name: string;
  price: number;
  point?: number;
}
interface OddsMarket {
  key: string;
  outcomes: OddsOutcome[];
}
interface OddsBookmaker {
  markets: OddsMarket[];
}
export interface OddsEvent {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
}

function americanToProb(odds: number): number {
  if (odds < 0) return Math.abs(odds) / (Math.abs(odds) + 100);
  return 100 / (odds + 100);
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length);
}

export function transformEvent(event: OddsEvent, league: string): GameCard | null {
  try {
    if (!event.bookmakers?.length) return null;
    const { home_team: homeTeam, away_team: awayTeam } = event;

    // Aggregate across ALL bookmakers for consensus pricing
    const h2hReadings: number[] = [];
    const spreadReadings: number[] = [];
    const totalReadings: number[] = [];

    for (const bm of event.bookmakers) {
      const markets: Record<string, OddsMarket> = {};
      for (const m of bm.markets ?? []) markets[m.key] = m;

      if (markets.h2h) {
        const price: Record<string, number> = {};
        for (const o of markets.h2h.outcomes) price[o.name] = o.price;
        const rawHome = americanToProb(price[homeTeam] ?? -110);
        const rawAway = americanToProb(price[awayTeam] ?? -110);
        const sum = rawHome + rawAway;
        if (sum > 0) h2hReadings.push(rawHome / sum);
      }

      if (markets.spreads) {
        for (const o of markets.spreads.outcomes) {
          if (o.name === homeTeam && o.point !== undefined) {
            spreadReadings.push(o.point);
            break;
          }
        }
      }

      if (markets.totals) {
        for (const o of markets.totals.outcomes) {
          if (o.name === "Over" && o.point !== undefined) {
            totalReadings.push(o.point);
            break;
          }
        }
      }
    }

    const homeWinProbability = h2hReadings.length > 0 ? mean(h2hReadings) : 0.5;
    const spread = spreadReadings.length > 0 ? mean(spreadReadings) : 0;
    const total = totalReadings.length > 0 ? mean(totalReadings) : 0;

    const bookmakerCount = event.bookmakers.length;
    const spreadVariance = Math.round(stdDev(spreadReadings) * 100) / 100;
    const totalVariance = Math.round(stdDev(totalReadings) * 100) / 100;

    // Confidence: more bookmaker agreement = more signal
    const baseConf = Math.min(0.5 + bookmakerCount * 0.025, 0.78);
    const variancePenalty = Math.min((spreadVariance + totalVariance) * 0.04, 0.1);
    const confidence = Math.max(0.4, Math.round((baseConf - variancePenalty) * 100) / 100);

    return {
      id: event.id,
      league,
      homeTeam,
      awayTeam,
      startTime: event.commence_time,
      homeWinProbability: Math.round(homeWinProbability * 1000) / 1000,
      confidence,
      spread: Math.round(spread * 2) / 2,
      total: Math.round(total * 2) / 2,
      bookmakerCount,
      spreadVariance,
      totalVariance,
    };
  } catch {
    return null;
  }
}

export function derivePicks(games: GameCard[]): BetRecommendation[] {
  const picks: BetRecommendation[] = [];

  // Net-rating threshold before it's a meaningful edge (low-scoring sports need smaller thresholds)
  const NET_THRESHOLD: Record<string, number> = { NHL: 0.4, MLS: 0.3, EPL: 0.3 };

  for (const game of games) {
    const p = game.homeWinProbability;
    const books = game.bookmakerCount ?? 1;
    const leagueKey = game.league;
    const homeName = game.homeTeam.split(" ").pop()!;
    const awayName = game.awayTeam.split(" ").pop()!;
    const matchup = `${awayName} @ ${homeName}`;
    const hStat = game.homeStats;
    const aStat = game.awayStats;
    const netThresh = NET_THRESHOLD[leagueKey] ?? 3;

    // ── Side picks (Spread / Moneyline) ──────────────────────────────────────
    // sideScore > 0 = signals favor home; < 0 = signals favor away
    const sideSignals: string[] = [];
    let sideScore = 0;

    // Signal 1: Market probability vs -110 breakeven (52.4%)
    const mktEdge = p - 0.524;
    if (Math.abs(mktEdge) > 0.03) {
      sideScore += mktEdge > 0 ? 1 : -1;
      const pct = Math.round(Math.max(p, 1 - p) * 100);
      sideSignals.push(`${books}-book consensus ${pct}% → ${mktEdge > 0 ? homeName : awayName}`);
    }

    if (hStat && aStat) {
      // Signal 2: Situational win% (home team's home record vs away team's road record)
      const hAdj = hStat.homeWinPct > 0 ? hStat.homeWinPct : hStat.winPct;
      const aAdj = aStat.awayWinPct > 0 ? aStat.awayWinPct : aStat.winPct;
      const wDiff = hAdj - aAdj;
      if (Math.abs(wDiff) > 0.08) {
        sideScore += wDiff > 0 ? 1 : -1;
        const favName = wDiff > 0 ? homeName : awayName;
        const pct = Math.round((wDiff > 0 ? hAdj : aAdj) * 100);
        sideSignals.push(`${favName} ${wDiff > 0 ? "home" : "road"} win% ${pct}%`);
      }

      // Signal 3: Streak momentum (3+ game threshold)
      if (hStat.streak >= 3)  { sideScore += 1; sideSignals.push(`${homeName} W${hStat.streak} streak`); }
      else if (hStat.streak <= -3) { sideScore -= 1; sideSignals.push(`${homeName} L${Math.abs(hStat.streak)} skid`); }
      if (aStat.streak >= 3)  { sideScore -= 1; sideSignals.push(`${awayName} W${aStat.streak} streak`); }
      else if (aStat.streak <= -3) { sideScore += 1; sideSignals.push(`${awayName} L${Math.abs(aStat.streak)} skid`); }

      // Signal 4: Net scoring rating differential
      const hNet = hStat.ppg - hStat.dppg;
      const aNet = aStat.ppg - aStat.dppg;
      const netDiff = hNet - aNet;
      if (Math.abs(netDiff) > netThresh) {
        sideScore += netDiff > 0 ? 1 : -1;
        const better = netDiff > 0 ? homeName : awayName;
        sideSignals.push(`${better} +${Math.abs(netDiff).toFixed(1)} net rating`);
      }
    }

    // Require 2+ signals to agree before generating a side pick
    if (Math.abs(sideScore) >= 2) {
      const baseEdge = Math.abs(sideScore) * 0.022 + Math.abs(mktEdge) * 0.35;
      const edge = Math.round(Math.min(baseEdge, 0.12) * 100) / 100;
      if (edge > 0.02) {
        const adjConf = Math.min(game.confidence + Math.abs(sideScore) * 0.025, 0.92);
        const hot = Math.abs(sideScore) >= 3 && edge >= 0.06;
        const reasoning = sideSignals.slice(0, 3).join(" · ");
        const favorHome = sideScore > 0;

        if (favorHome && game.spread < 0) {
          picks.push({
            id: `pick-${game.id}-spread`,
            gameId: game.id, league: leagueKey, matchup,
            betType: "Spread",
            pick: `${homeName} ${game.spread}`,
            odds: "-110", edge, confidence: adjConf, reasoning, hot,
          });
        } else if (!favorHome) {
          const awayProb = 1 - p;
          const impliedOdds = Math.round(100 / awayProb - 100);
          if (impliedOdds > 0) {
            picks.push({
              id: `pick-${game.id}-ml`,
              gameId: game.id, league: leagueKey, matchup,
              betType: "Moneyline",
              pick: `${awayName} ML`,
              odds: `+${impliedOdds}`,
              edge, confidence: adjConf, reasoning, hot,
            });
          }
        }
      }
    }

    // ── Total picks ───────────────────────────────────────────────────────────
    if (game.total > 0) {
      const totSignals: string[] = [];
      let totScore = 0; // > 0 = lean Over, < 0 = lean Under

      // Signal A: Season average mean-reversion
      const avgTotal = LEAGUE_AVG_TOTALS[leagueKey];
      if (avgTotal) {
        const dev = (game.total - avgTotal) / avgTotal;
        if (Math.abs(dev) > 0.04) {
          totScore += dev < 0 ? 1 : -1;
          totSignals.push(`Line ${Math.round(Math.abs(dev) * 100)}% ${dev > 0 ? "above" : "below"} ${leagueKey} avg (${avgTotal})`);
        }
      }

      // Signal B: Pace model — (home_ppg + away_dppg + away_ppg + home_dppg) / 2
      if (hStat && aStat && hStat.ppg > 0 && aStat.ppg > 0) {
        const paceEst = (hStat.ppg + aStat.dppg + aStat.ppg + hStat.dppg) / 2;
        const paceDev = (paceEst - game.total) / game.total;
        if (Math.abs(paceDev) > 0.03) {
          totScore += paceDev > 0 ? 1 : -1;
          const dir = paceDev > 0 ? "over" : "under";
          totSignals.push(`Pace model ${paceEst.toFixed(1)} pts (${dir} by ${Math.abs(paceEst - game.total).toFixed(1)})`);
        }
      }

      // Signal C: Combined offense/defense tendency
      if (hStat && aStat && avgTotal) {
        const halfAvg = avgTotal / 2;
        const offAvg = (hStat.ppg + aStat.ppg) / 2;
        const defAvg = (hStat.dppg + aStat.dppg) / 2;
        const tendThresh = ["NHL", "MLS", "EPL"].includes(leagueKey) ? 0.3 : 2;
        if (offAvg - halfAvg > tendThresh) {
          totScore += 0.5;
          totSignals.push(`Both teams above-avg offense (${offAvg.toFixed(1)} ppg)`);
        } else if (halfAvg - defAvg > tendThresh) {
          totScore -= 0.5;
          totSignals.push(`Both teams stingy defense (${defAvg.toFixed(1)} allowed)`);
        }
      }

      if (Math.abs(totScore) >= 1) {
        const isOver = totScore > 0;
        const edge = Math.round(Math.min(Math.abs(totScore) * 0.033 + 0.01, 0.11) * 100) / 100;
        if (edge > 0.02) {
          picks.push({
            id: `pick-${game.id}-total`,
            gameId: game.id, league: leagueKey, matchup,
            betType: isOver ? "Over" : "Under",
            pick: `${isOver ? "Over" : "Under"} ${game.total.toFixed(1)}`,
            odds: "-110", edge,
            confidence: Math.min(game.confidence + Math.abs(totScore) * 0.02, 0.92),
            reasoning: totSignals.join(" · "),
            hot: Math.abs(totScore) >= 2 && edge >= 0.06,
          });
        }
      }
    }
  }

  // One best pick per active league first, then fill to cap with remaining
  const ranked = picks.sort((a, b) => b.edge - a.edge);
  const seen = new Set<string>();
  const result: BetRecommendation[] = [];
  for (const pk of ranked) {
    if (!seen.has(pk.league)) { seen.add(pk.league); result.push(pk); }
  }
  for (const pk of ranked) {
    if (result.length >= 8) break;
    if (!result.includes(pk)) result.push(pk);
  }
  return result.sort((a, b) => b.edge - a.edge);
}

// Returns ALL qualifying picks for a single game — no global rank cutoff.
// Use this on game detail pages so a game's own picks are never displaced by
// other games with higher edges.
export function derivePicksForGame(game: GameCard): BetRecommendation[] {
  return derivePicks([game]);
}

// Two-layer cache to survive Render free-tier cold starts:
//   L1: module-level memory  — fast, lost on restart
//   L2: database             — persistent across restarts
//
// Free tier: 500 req/month. We only fetch in-season sports (typically 4-6 of 8).
// 12-hour TTL = 2 cycles/day × ~5 sports × 30 days ≈ 300 req/month — within budget.
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const DB_CACHE_KEY = "upcoming_games";

let _cachedGames: GameCard[] | null = null;
let _cacheExpiry = 0;

export async function fetchUpcomingGames(): Promise<GameCard[]> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return [];

  const now = Date.now();

  // L1: in-process memory cache
  if (_cachedGames && now < _cacheExpiry) return _cachedGames;

  // L2: database cache (survives cold starts)
  const dbCache = await getOddsCache(DB_CACHE_KEY);
  if (dbCache && now - dbCache.fetchedAt.getTime() < CACHE_TTL_MS) {
    const games = dbCache.payload as GameCard[];
    _cachedGames = games;
    _cacheExpiry = dbCache.fetchedAt.getTime() + CACHE_TTL_MS;
    return games;
  }

  const games: GameCard[] = [];
  let remaining: string | null = null;

  for (const [sportKey, league] of Object.entries(activeSeasonSports())) {
    try {
      const url =
        `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?` +
        new URLSearchParams({
          apiKey,
          regions: "us",
          markets: "h2h,spreads,totals",
          dateFormat: "iso",
          oddsFormat: "american",
        });

      const resp = await fetch(url, { cache: "no-store" });
      if (!resp.ok) {
        console.error(`[odds] ${league} fetch failed: HTTP ${resp.status} ${resp.statusText}`);
        continue;
      }

      // Track quota — logged once per refresh cycle
      remaining = resp.headers.get("x-requests-remaining") ?? remaining;

      const events: OddsEvent[] = await resp.json();
      for (const event of events) {
        const game = transformEvent(event, league);
        if (game) games.push(game);
      }
    } catch {
      continue;
    }
  }

  if (remaining !== null) {
    console.log(`[odds] requests remaining this month: ${remaining}`);
  }

  const sorted = games.sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Enrich games with ESPN team stats (free — no quota impact)
  if (sorted.length > 0) {
    const leagues = [...new Set(sorted.map((g) => g.league))];
    const standingsArrays = await Promise.all(leagues.map((l) => fetchStandings(l)));
    const byLeague = new Map<string, TeamRecord[]>(
      leagues.map((l, i) => [l, standingsArrays[i]])
    );
    for (const game of sorted) {
      const records = byLeague.get(game.league) ?? [];
      if (!records.length) continue;
      const hr = matchTeam(game.homeTeam, records);
      const ar = matchTeam(game.awayTeam, records);
      if (hr) game.homeStats = toTeamStats(hr);
      if (ar) game.awayStats = toTeamStats(ar);
    }
  }

  if (sorted.length > 0) {
    // Write both cache layers
    _cachedGames = sorted;
    _cacheExpiry = now + CACHE_TTL_MS;
    await setOddsCache(DB_CACHE_KEY, sorted);
  }

  return sorted;
}
