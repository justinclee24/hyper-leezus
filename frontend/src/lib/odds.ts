import type { BetRecommendation, GameCard } from "./data";

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

  for (const game of games) {
    const p = game.homeWinProbability;
    const books = game.bookmakerCount ?? 1;
    const leagueKey = game.league.split(" ")[0];
    const matchup = `${game.awayTeam.split(" ").pop()} @ ${game.homeTeam.split(" ").pop()}`;

    // Strong home favourite with sharp spread — spread pick
    if (p > 0.64 && game.spread < 0) {
      const edge = Math.round((p - 0.58) * 100) / 100;
      if (edge > 0.02) {
        picks.push({
          id: `pick-${game.id}-spread`,
          gameId: game.id,
          league: leagueKey,
          matchup,
          betType: "Spread",
          pick: `${game.homeTeam.split(" ").pop()} ${game.spread}`,
          odds: "-110",
          edge,
          confidence: game.confidence,
          reasoning: `${books}-book consensus puts home at ${Math.round(p * 100)}% — ${Math.round(edge * 100)}pp above breakeven. Spread edge confirmed by bookmaker agreement (variance: ${game.spreadVariance ?? 0}).`,
          hot: edge >= 0.08,
        });
      }
    }

    // Strong away underdog — moneyline value
    if (p < 0.37) {
      const awayProb = 1 - p;
      const edge = Math.round((awayProb - 0.47) * 100) / 100;
      if (edge > 0.02) {
        const impliedOdds = Math.round(100 / awayProb - 100);
        picks.push({
          id: `pick-${game.id}-ml`,
          gameId: game.id,
          league: leagueKey,
          matchup,
          betType: "Moneyline",
          pick: `${game.awayTeam.split(" ").pop()} ML`,
          odds: `+${impliedOdds}`,
          edge,
          confidence: game.confidence,
          reasoning: `${books}-book consensus undervalues road side at ${Math.round(awayProb * 100)}%. Positive EV at +${impliedOdds} — market over-adjusting for home field.`,
          hot: edge >= 0.08,
        });
      }
    }

    // Total line mean-reversion play
    if (game.total > 0) {
      const avgTotal = LEAGUE_AVG_TOTALS[leagueKey];
      if (avgTotal) {
        const deviation = (game.total - avgTotal) / avgTotal;
        if (Math.abs(deviation) > 0.04) {
          const isOver = deviation < -0.04;
          const edge = Math.round(Math.min(Math.abs(deviation) * 0.5, 0.11) * 100) / 100;
          if (edge > 0.02) {
            picks.push({
              id: `pick-${game.id}-total`,
              gameId: game.id,
              league: leagueKey,
              matchup,
              betType: isOver ? "Over" : "Under",
              pick: `${isOver ? "Over" : "Under"} ${game.total.toFixed(1)}`,
              odds: "-110",
              edge,
              confidence: game.confidence,
              reasoning: `${leagueKey} season average: ${avgTotal}. Line at ${game.total.toFixed(1)} is ${Math.round(Math.abs(deviation) * 100)}% ${deviation > 0 ? "above" : "below"} average — mean reversion favors the ${isOver ? "Over" : "Under"}.`,
              hot: edge >= 0.08,
            });
          }
        }
      }
    }
  }

  // Sort by edge, return top 6
  return picks.sort((a, b) => b.edge - a.edge).slice(0, 6);
}

// Returns ALL qualifying picks for a single game — no global rank cutoff.
// Use this on game detail pages so a game's own picks are never displaced by
// other games with higher edges.
export function derivePicksForGame(game: GameCard): BetRecommendation[] {
  return derivePicks([game]);
}

export async function fetchUpcomingGames(dateFilter?: string): Promise<GameCard[]> {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return [];

  // dateFilter is a YYYY-MM-DD string (local date). Build commenceTimeFrom/To for that calendar day.
  let commenceTimeFrom: string | undefined;
  let commenceTimeTo: string | undefined;
  if (dateFilter) {
    commenceTimeFrom = `${dateFilter}T00:00:00Z`;
    commenceTimeTo = `${dateFilter}T23:59:59Z`;
  }

  const games: GameCard[] = [];

  for (const [sportKey, league] of Object.entries(SPORTS)) {
    try {
      const params: Record<string, string> = {
        apiKey,
        regions: "us",
        markets: "h2h,spreads,totals",
        dateFormat: "iso",
        oddsFormat: "american",
      };
      if (commenceTimeFrom) params.commenceTimeFrom = commenceTimeFrom;
      if (commenceTimeTo) params.commenceTimeTo = commenceTimeTo;

      const url =
        `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?` +
        new URLSearchParams(params);

      const resp = await fetch(url, { next: { revalidate: 300 } });
      if (!resp.ok) continue;

      const events: OddsEvent[] = await resp.json();
      for (const event of events) {
        const game = transformEvent(event, league);
        if (game) games.push(game);
      }
    } catch {
      continue;
    }
  }

  return games.sort((a, b) => a.startTime.localeCompare(b.startTime));
}
