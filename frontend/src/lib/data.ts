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

export const upcomingGames: GameCard[] = [
  {
    id: "nba-okc-dal",
    league: "NBA · Playoffs",
    homeTeam: "Dallas Mavericks",
    awayTeam: "Oklahoma City Thunder",
    startTime: "2026-05-07T01:30:00Z",
    homeWinProbability: 0.58,
    confidence: 0.74,
    spread: -3.5,
    total: 224.5,
  },
  {
    id: "nba-bos-cle",
    league: "NBA · Playoffs",
    homeTeam: "Cleveland Cavaliers",
    awayTeam: "Boston Celtics",
    startTime: "2026-05-08T00:00:00Z",
    homeWinProbability: 0.38,
    confidence: 0.71,
    spread: 5.5,
    total: 219.0,
  },
  {
    id: "nhl-edm-col",
    league: "NHL · Playoffs",
    homeTeam: "Edmonton Oilers",
    awayTeam: "Colorado Avalanche",
    startTime: "2026-05-06T02:00:00Z",
    homeWinProbability: 0.56,
    confidence: 0.63,
    spread: -1.5,
    total: 6.0,
  },
  {
    id: "mlb-nyy-bos",
    league: "MLB",
    homeTeam: "Boston Red Sox",
    awayTeam: "New York Yankees",
    startTime: "2026-05-06T23:10:00Z",
    homeWinProbability: 0.46,
    confidence: 0.59,
    spread: 1.5,
    total: 9.0,
  },
];

export const betRecommendations: BetRecommendation[] = [
  {
    id: "pick-nba-bos-cle-spread",
    gameId: "nba-bos-cle",
    league: "NBA",
    matchup: "BOS @ CLE",
    betType: "Spread",
    pick: "BOS -2.5",
    odds: "-112",
    edge: 0.11,
    confidence: 0.78,
    reasoning: "Celtics +14.2 net rating vs 50-win teams this postseason. Mitchell nursing ankle — limited to 26 min in G1.",
    hot: true,
  },
  {
    id: "pick-nba-okc-dal-spread",
    gameId: "nba-okc-dal",
    league: "NBA",
    matchup: "OKC @ DAL",
    betType: "Spread",
    pick: "DAL -3.5",
    odds: "-108",
    edge: 0.09,
    confidence: 0.74,
    reasoning: "Mavericks 71% cover rate in home playoff games. OKC rotation disrupted by foul trouble in G2.",
    hot: true,
  },
  {
    id: "pick-nhl-edm-col-ml",
    gameId: "nhl-edm-col",
    league: "NHL",
    matchup: "COL @ EDM",
    betType: "Moneyline",
    pick: "EDM ML",
    odds: "+118",
    edge: 0.07,
    confidence: 0.63,
    reasoning: "Oilers 8-2 ATS last 10 home playoff games. Draisaitl line producing 4.2 pts/60 this series.",
    hot: false,
  },
  {
    id: "pick-mlb-nyy-bos-over",
    gameId: "mlb-nyy-bos",
    league: "MLB",
    matchup: "NYY @ BOS",
    betType: "Over",
    pick: "Over 9.0",
    odds: "-115",
    edge: 0.06,
    confidence: 0.61,
    reasoning: "Both bullpens taxed last 3 days. Fenway wind 14 mph to CF. Combined starter ERA last 7 days: 5.1.",
    hot: false,
  },
];

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
