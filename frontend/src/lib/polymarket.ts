export interface PolymarketMarket {
  question: string;
  url: string;
  probability: number; // 0-1 for the "yes" / team-wins outcome
  outcome: string;     // label of the matched outcome
  volume: number;
  isChampionship: boolean;
}

interface RawMarket {
  question?: string;
  slug?: string;
  outcomes?: string;        // JSON array string
  outcomePrices?: string;   // JSON array string
  volume?: number | string;
  active?: boolean;
  closed?: boolean;
}

interface RawEvent {
  slug?: string;
  markets?: RawMarket[];
}

const CACHE = new Map<string, { ts: number; data: PolymarketMarket[] }>();
const TTL = 15 * 60 * 1000; // 15 min

const CHAMP_KEYWORDS = ["champion", "championship", "win the", "nba finals", "stanley cup", "world series", "super bowl", "ncaa", "mls cup"];

function isChampionshipQuestion(q: string): boolean {
  const lc = q.toLowerCase();
  return CHAMP_KEYWORDS.some((kw) => lc.includes(kw));
}

export async function fetchTeamMarkets(teamName: string, sport: string): Promise<PolymarketMarket[]> {
  const cacheKey = `${teamName}|${sport}`.toLowerCase();
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < TTL) return cached.data;

  const query = encodeURIComponent(teamName);
  const url = `https://gamma-api.polymarket.com/public-search?q=${query}&events_status=active&limit_per_type=10`;

  let events: RawEvent[] = [];
  try {
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    // Response is { events: [...] } or array
    events = Array.isArray(json) ? json : (json.events ?? []);
  } catch {
    return [];
  }

  const results: PolymarketMarket[] = [];
  const teamLower = teamName.toLowerCase();

  for (const event of events) {
    const eventSlug = event.slug ?? "";
    for (const market of event.markets ?? []) {
      if (!market.question || market.closed) continue;

      const q = market.question.toLowerCase();
      if (!q.includes(teamLower) && !q.includes(teamLower.split(" ").at(-1)!.toLowerCase())) continue;

      let outcomes: string[] = [];
      let prices: number[] = [];
      try {
        outcomes = JSON.parse(market.outcomes ?? "[]");
        prices = JSON.parse(market.outcomePrices ?? "[]").map(Number);
      } catch {
        continue;
      }

      // Find the outcome index that matches the team name
      let matchIdx = outcomes.findIndex((o) => o.toLowerCase().includes(teamLower));
      if (matchIdx === -1) matchIdx = 0; // fallback to first (Yes / team wins)

      const probability = prices[matchIdx] ?? 0;
      if (probability <= 0 || probability > 1) continue;

      const marketUrl = eventSlug && market.slug
        ? `https://polymarket.com/event/${eventSlug}/${market.slug}`
        : `https://polymarket.com`;

      results.push({
        question: market.question,
        url: marketUrl,
        probability,
        outcome: outcomes[matchIdx] ?? "Yes",
        volume: typeof market.volume === "string" ? parseFloat(market.volume) : (market.volume ?? 0),
        isChampionship: isChampionshipQuestion(market.question),
      });
    }
  }

  // Sort: championship markets first, then by volume descending
  results.sort((a, b) => {
    if (a.isChampionship !== b.isChampionship) return a.isChampionship ? -1 : 1;
    return b.volume - a.volume;
  });

  CACHE.set(cacheKey, { ts: Date.now(), data: results });
  return results;
}
