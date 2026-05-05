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

export const upcomingGames: GameCard[] = [
  {
    id: "nba-lal-bos",
    league: "NBA",
    homeTeam: "Boston Celtics",
    awayTeam: "Los Angeles Lakers",
    startTime: "2026-03-17T01:30:00Z",
    homeWinProbability: 0.64,
    confidence: 0.77,
    spread: -5.5,
    total: 227.5
  },
  {
    id: "nfl-kc-buf",
    league: "NFL",
    homeTeam: "Buffalo Bills",
    awayTeam: "Kansas City Chiefs",
    startTime: "2026-03-18T00:20:00Z",
    homeWinProbability: 0.53,
    confidence: 0.61,
    spread: -1.0,
    total: 49.5
  },
  {
    id: "soccer-ars-mci",
    league: "EPL",
    homeTeam: "Arsenal",
    awayTeam: "Manchester City",
    startTime: "2026-03-17T19:00:00Z",
    homeWinProbability: 0.48,
    confidence: 0.58,
    spread: 0.0,
    total: 2.7
  }
];

export const accuracySeries = [
  { week: "W1", accuracy: 0.59, roi: 0.02 },
  { week: "W2", accuracy: 0.61, roi: 0.04 },
  { week: "W3", accuracy: 0.63, roi: 0.05 },
  { week: "W4", accuracy: 0.65, roi: 0.06 },
  { week: "W5", accuracy: 0.64, roi: 0.03 }
];

export const featureImportance = [
  { feature: "Power Rating Diff", value: 0.27 },
  { feature: "Market Implied Probability", value: 0.22 },
  { feature: "Rest Differential", value: 0.14 },
  { feature: "Travel Fatigue", value: 0.12 },
  { feature: "Lineup Strength", value: 0.1 }
];
