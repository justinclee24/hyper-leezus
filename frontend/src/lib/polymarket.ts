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

// Generic words that aren't team names — skip Polymarket fetch for these
const SKIP_TERMS = new Set(["over", "under", "yes", "no", "spread", "total", "push"]);

export async function fetchTeamMarkets(teamName: string, sport: string): Promise<PolymarketMarket[]> {
  const trimmed = teamName.trim();
  // Don't fetch for very short names or generic bet terms — would match unrelated markets
  if (trimmed.length < 4 || SKIP_TERMS.has(trimmed.toLowerCase())) return [];

  const cacheKey = `${trimmed}|${sport}`.toLowerCase();
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < TTL) return cached.data;

  const query = encodeURIComponent(trimmed);
  const url = `https://gamma-api.polymarket.com/public-search?q=${query}&events_status=active&limit_per_type=10`;

  let events: RawEvent[] = [];
  try {
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    events = Array.isArray(json) ? json : (json.events ?? []);
  } catch {
    return [];
  }

  const results: PolymarketMarket[] = [];
  const teamLower = trimmed.toLowerCase();
  // Split into words ≥ 3 chars for word-level matching (avoids "LA" matching "play", etc.)
  const teamWords = teamLower.split(/\s+/).filter((w) => w.length >= 3);
  // The most distinctive word is usually the last (e.g. "Warriors", "Celtics")
  const lastWord = teamWords.at(-1) ?? teamLower;

  for (const event of events) {
    const eventSlug = event.slug ?? "";
    for (const market of event.markets ?? []) {
      if (!market.question || market.closed) continue;

      const q = market.question.toLowerCase();
      // Require the question to contain the full team name OR all significant words
      // Use word-boundary split to avoid "heat" matching "weather heat index", etc.
      const qWords = new Set(q.split(/\W+/));
      const fullMatch = q.includes(teamLower);
      const wordMatch = teamWords.length > 0 && teamWords.every((w) => qWords.has(w) || q.includes(w));
      const lastWordMatch = lastWord.length >= 4 && qWords.has(lastWord);
      if (!fullMatch && !wordMatch && !lastWordMatch) continue;

      let outcomes: string[] = [];
      let prices: number[] = [];
      try {
        outcomes = JSON.parse(market.outcomes ?? "[]");
        prices = JSON.parse(market.outcomePrices ?? "[]").map(Number);
      } catch {
        continue;
      }

      let matchIdx = outcomes.findIndex((o) => o.toLowerCase().includes(teamLower));
      if (matchIdx === -1) matchIdx = 0;

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

  results.sort((a, b) => {
    if (a.isChampionship !== b.isChampionship) return a.isChampionship ? -1 : 1;
    return b.volume - a.volume;
  });

  CACHE.set(cacheKey, { ts: Date.now(), data: results });
  return results;
}
