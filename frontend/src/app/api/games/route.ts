import { NextResponse } from "next/server";
import { derivePicks, fetchUpcomingGames } from "@/lib/odds";
import type { GameCard } from "@/lib/data";

const PREDICTION_API_URL = process.env.PREDICTION_API_URL ?? "";
const PREDICTION_API_TOKEN = process.env.PREDICTION_API_TOKEN ?? "";

interface MLPrediction {
  win_probability_home: number;
  confidence: number;
  spread_home: number;
  total_points: number;
}

async function fetchMLPrediction(game: GameCard): Promise<MLPrediction | null> {
  if (!PREDICTION_API_URL || !PREDICTION_API_TOKEN) return null;
  try {
    const resp = await fetch(`${PREDICTION_API_URL}/predict`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${PREDICTION_API_TOKEN}`,
      },
      body: JSON.stringify({
        context: {
          league: game.league.split(" ")[0].toLowerCase(),
          game_id: game.id,
          home_team: game.homeTeam,
          away_team: game.awayTeam,
          start_time: game.startTime,
          neutral_site: false,
          is_playoff: game.league.toLowerCase().includes("playoff"),
        },
        features: {
          market_implied_home: game.homeWinProbability,
          projected_total: game.total,
          power_rating_diff: 0.0,
          spread: game.spread,
          bookmaker_count: game.bookmakerCount ?? 1,
          spread_variance: game.spreadVariance ?? 0,
          total_variance: game.totalVariance ?? 0,
        },
        include_explanations: false,
      }),
      // Short timeout — don't let a slow prediction API block the page
      signal: AbortSignal.timeout(3000),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

export async function GET() {
  const hasKey = !!(process.env.ODDS_API_KEY);
  const games = await fetchUpcomingGames();
  if (!games.length) {
    const reason = hasKey ? "api_error_or_quota" : "no_key";
    console.error(`[games] returning empty games list — reason: ${reason}`);
    return NextResponse.json({ games: [], picks: [], reason });
  }

  // If prediction API is configured, augment probabilities in parallel
  if (PREDICTION_API_URL && PREDICTION_API_TOKEN) {
    const predictions = await Promise.all(games.map(fetchMLPrediction));
    for (let i = 0; i < games.length; i++) {
      const p = predictions[i];
      if (!p) continue;
      // Adaptive blend: model weight scales with its own confidence (0.4–0.75).
      // A coin-flip prediction (confidence≈0.5) gets low weight; a strong call
      // (confidence≈0.9) gets higher weight. Market odds act as a calibrated floor.
      const modelWeight = Math.min(0.75, 0.4 + 0.35 * p.confidence);
      const marketWeight = 1 - modelWeight;
      games[i] = {
        ...games[i],
        homeWinProbability: Math.round(
          (p.win_probability_home * modelWeight + games[i].homeWinProbability * marketWeight) * 1000,
        ) / 1000,
        confidence: Math.round(p.confidence * 100) / 100,
      };
    }
  }

  const picks = derivePicks(games);
  return NextResponse.json({ games, picks });
}
