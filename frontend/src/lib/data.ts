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
