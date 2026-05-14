export type TeamStats = {
  ppg: number;         // points scored per game (offense)
  dppg: number;        // points allowed per game (defense)
  winPct: number;      // overall win %
  homeWinPct: number;  // win % in home games
  awayWinPct: number;  // win % in away games
  streak: number;      // +N = W streak, -N = L streak
  // Rolling recent form (last ~10 games, blended with season)
  recentWinPct?: number;
  recentPpg?: number;
  recentDppg?: number;
};

export interface PitcherInfo {
  name: string;
  era: number;
  whip: number;
  k9: number;
  wins: number;
  losses: number;
}

export type GameCard = {
  id: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  homeWinProbability: number;
  confidence: number;
  spread: number;
  total: number;
  bookmakerCount?: number;
  spreadVariance?: number;
  totalVariance?: number;
  homeStats?: TeamStats;
  awayStats?: TeamStats;
  // Enriched fields
  homeRestDays?: number;
  awayRestDays?: number;
  homeInjuryCount?: number;
  awayInjuryCount?: number;
  homePitcher?: PitcherInfo;    // MLB only
  awayPitcher?: PitcherInfo;    // MLB only
  homePowerPlay?: number;       // NHL: power play %
  awayPowerPlay?: number;
  homeGoalsPerGame?: number;    // NHL: goals for per game
  awayGoalsPerGame?: number;
  // Line movement (delta vs first-seen odds — positive = moved toward home)
  homeOddsMovement?: number;
  spreadMovement?: number;
  totalMovement?: number;
  // Weather — outdoor NFL/MLB only
  windMph?: number;
  precipChance?: number;        // 0–100
  tempF?: number;
  // Referee/umpire tendencies
  refPaceFactor?: number;       // negative = lean Under, positive = lean Over
  refLabel?: string;
};

export type TrackedBet = {
  id: string;
  gameId: string;
  matchup: string;
  pick: string;
  betType: string;
  odds: string;
  edge: number;
  stake: number;
  league: string;
  trackedAt: string;
  gameDate?: string;
  result: "pending" | "win" | "loss" | "push";
};

export type BetRecommendation = {
  id: string;
  gameId: string;
  league: string;
  matchup: string;
  betType: "Spread" | "Moneyline" | "Over" | "Under";
  pick: string;
  odds: string;
  edge: number;
  confidence: number;
  reasoning: string;
  hot: boolean;
  gameDate?: string;
};

export const accuracySeries = [
  { week: "W1", accuracy: 0.59, roi: 0.02 },
  { week: "W2", accuracy: 0.61, roi: 0.04 },
  { week: "W3", accuracy: 0.63, roi: 0.05 },
  { week: "W4", accuracy: 0.65, roi: 0.06 },
  { week: "W5", accuracy: 0.64, roi: 0.03 },
];

export const featureImportance = [
  { feature: "Power Rating Diff", value: 0.27 },
  { feature: "Market Implied Prob", value: 0.22 },
  { feature: "Rest Differential", value: 0.14 },
  { feature: "Travel Fatigue", value: 0.12 },
  { feature: "Lineup Strength", value: 0.10 },
];
