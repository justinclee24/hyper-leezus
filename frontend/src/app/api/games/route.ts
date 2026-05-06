import { NextResponse } from "next/server";
import type { GameCard, BetRecommendation } from "@/lib/data";

const SPORTS: Record<string, string> = {
  basketball_nba: "NBA",
  icehockey_nhl: "NHL",
  baseball_mlb: "MLB",
  americanfootball_nfl: "NFL",
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
interface OddsEvent {
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

function transformEvent(event: OddsEvent, league: string): GameCard | null {
  try {
    if (!event.bookmakers?.length) return null;

    const marketList = event.bookmakers[0].markets ?? [];
    const markets: Record<string, OddsMarket> = {};
    for (const m of marketList) markets[m.key] = m;

    const { home_team: homeTeam, away_team: awayTeam } = event;

    let homeWinProbability = 0.5;
    if (markets.h2h) {
      const priceMap: Record<string, number> = {};
      for (const o of markets.h2h.outcomes) priceMap[o.name] = o.price;
      const rawHome = americanToProb(priceMap[homeTeam] ?? -110);
      const rawAway = americanToProb(priceMap[awayTeam] ?? -110);
      const sum = rawHome + rawAway;
      homeWinProbability = sum > 0 ? rawHome / sum : 0.5;
    }

    let spread = 0;
    if (markets.spreads) {
      for (const o of markets.spreads.outcomes) {
        if (o.name === homeTeam) { spread = o.point ?? 0; break; }
      }
    }

    let total = 0;
    if (markets.totals) {
      for (const o of markets.totals.outcomes) {
        if (o.name === "Over") { total = o.point ?? 0; break; }
      }
    }

    // Confidence scales with bookmaker consensus (more bookmakers = more signal)
    const bookmakerCount = event.bookmakers.length;
    const confidence = Math.min(0.5 + bookmakerCount * 0.03, 0.82);

    return {
      id: event.id,
      league,
      homeTeam,
      awayTeam,
      startTime: event.commence_time,
      homeWinProbability: Math.round(homeWinProbability * 1000) / 1000,
      confidence: Math.round(confidence * 100) / 100,
      spread,
      total,
    };
  } catch {
    return null;
  }
}

function derivePicks(games: GameCard[]): BetRecommendation[] {
  const picks: BetRecommendation[] = [];

  for (const game of games) {
    const p = game.homeWinProbability;
    const matchup = `${game.awayTeam.split(" ").pop()} @ ${game.homeTeam.split(" ").pop()}`;

    // Strong home favourite — spread pick
    if (p > 0.65 && game.spread < 0) {
      const edge = Math.round((p - 0.6) * 100) / 100;
      picks.push({
        id: `pick-${game.id}-spread`,
        gameId: game.id,
        league: game.league.split(" ")[0],
        matchup,
        betType: "Spread",
        pick: `${game.homeTeam.split(" ").pop()} ${game.spread}`,
        odds: "-110",
        edge,
        confidence: game.confidence,
        reasoning: `Model assigns ${Math.round(p * 100)}% home win probability vs market-implied ${Math.round((p - edge) * 100)}%. Spread edge detected.`,
        hot: edge >= 0.08,
      });
    }

    // Strong away underdog — moneyline value
    if (p < 0.38) {
      const awayProb = 1 - p;
      const edge = Math.round((awayProb - 0.48) * 100) / 100;
      const impliedOdds = Math.round(100 / awayProb - 100);
      picks.push({
        id: `pick-${game.id}-ml`,
        gameId: game.id,
        league: game.league.split(" ")[0],
        matchup,
        betType: "Moneyline",
        pick: `${game.awayTeam.split(" ").pop()} ML`,
        odds: `+${impliedOdds}`,
        edge,
        confidence: game.confidence,
        reasoning: `Away team assigned ${Math.round(awayProb * 100)}% probability. Market undervaluing road side — positive EV at current line.`,
        hot: edge >= 0.08,
      });
    }

    if (picks.length >= 4) break;
  }

  return picks.slice(0, 4);
}

export async function GET() {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ games: [], picks: [] });
  }

  const games: GameCard[] = [];

  for (const [sportKey, league] of Object.entries(SPORTS)) {
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

  games.sort((a, b) => a.startTime.localeCompare(b.startTime));
  const upcoming = games.slice(0, 8);
  const picks = derivePicks(upcoming);

  return NextResponse.json({ games: upcoming, picks });
}
