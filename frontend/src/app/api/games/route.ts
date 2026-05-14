import { NextResponse } from "next/server";
import { derivePicks, fetchUpcomingGames } from "@/lib/odds";
import type { GameCard } from "@/lib/data";
import { ESPN_LEAGUES } from "@/lib/espn";

// NBA referee tendencies — keyed by referee name.
// High foul-rate refs → more FT attempts → lean Over.
// Methodical/slow refs → fewer possessions per minute but more stoppages → lean Under.
const NBA_REF_TENDENCIES: Record<string, number> = {
  "Scott Foster":    -0.25, // slowest pace, methodical — lean Under
  "Ken Mauer":       -0.20,
  "Zach Zarba":      -0.15,
  "James Capers":    -0.10,
  "Marc Davis":       0.00,
  "JB DeRosa":        0.00,
  "John Goble":      +0.10,
  "Tony Brothers":   +0.20, // high foul rate, many FT stoppages
  "Ed Malloy":       +0.20,
  "Bill Kennedy":    +0.15,
  "Eric Lewis":      +0.15,
  "Josh Tiven":      +0.10,
};

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

async function overlayNBAReferees(games: GameCard[]): Promise<void> {
  const nbaGames = games.filter((g) => g.league === "NBA");
  if (!nbaGames.length) return;

  const cfg = ESPN_LEAGUES["NBA"];
  try {
    // no-store: skip Next.js cache so we always get the latest assignment
    const resp = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/${cfg.sport}/${cfg.league}/scoreboard?limit=50`,
      { cache: "no-store", signal: AbortSignal.timeout(3000) },
    );
    if (!resp.ok) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await resp.json();

    // Build homeTeamName → referee map from ESPN events that have officials listed
    const refMap = new Map<string, { name: string; paceFactor: number }>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const event of (data.events ?? []) as any[]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const comp = (event.competitions ?? [])[0] as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const officials: any[] = comp?.officials ?? [];
      if (!officials.length) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ref = officials.find((o: any) =>
        (o.position?.displayName ?? o.position?.name ?? "").toLowerCase().includes("referee"),
      ) ?? officials[0];
      const name: string = ref?.displayName ?? ref?.fullName ?? "";
      if (!name) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const competitors: any[] = comp.competitors ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const home = competitors.find((c: any) => c.homeAway === "home");
      const homeTeam: string = (home?.team?.displayName ?? home?.team?.name ?? "").toLowerCase();
      if (homeTeam) refMap.set(homeTeam, { name, paceFactor: NBA_REF_TENDENCIES[name] ?? 0 });
    }

    if (!refMap.size) return;

    // Overlay onto matching NBA game cards (fuzzy match on home team name)
    for (const game of nbaGames) {
      if (game.refPaceFactor !== undefined) continue; // already set
      const lower = game.homeTeam.toLowerCase();
      const last  = lower.split(" ").pop() ?? lower;
      for (const [key, ref] of refMap) {
        if (key === lower || key.includes(last) || lower.includes(key.split(" ").pop() ?? "")) {
          game.refPaceFactor = ref.paceFactor;
          game.refLabel      = `${ref.name} (NBA ref)`;
          break;
        }
      }
    }
  } catch {
    // Non-critical — skip quietly if ESPN is slow or unavailable
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

  // Overlay NBA referee assignments at serve time (only announced ~1hr pre-tip)
  await overlayNBAReferees(games);

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
