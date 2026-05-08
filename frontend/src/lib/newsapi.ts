import type { NewsItem } from "./espn";

const NEWSAPI_KEY = process.env.NEWSAPI_KEY;

const LEAGUE_QUERIES: Record<string, string> = {
  NBA:   "NBA basketball",
  NFL:   "NFL football",
  NHL:   "NHL hockey",
  MLB:   "MLB baseball",
  NCAAB: "college basketball March Madness",
  MLS:   "MLS soccer",
  EPL:   "Premier League",
};

// Long cache — NewsAPI free tier is 100 req/day
const CACHE_TTL = 3 * 60 * 60 * 1000;
const _cache = new Map<string, { data: NewsItem[]; expiry: number }>();

export async function fetchNewsApiContent(leagueKey: string): Promise<NewsItem[]> {
  if (!NEWSAPI_KEY) return [];

  const key = leagueKey.toUpperCase();
  const hit = _cache.get(key);
  if (hit && Date.now() < hit.expiry) return hit.data;

  const q = encodeURIComponent(LEAGUE_QUERIES[key] ?? leagueKey);
  const url = `https://newsapi.org/v2/everything?q=${q}&language=en&sortBy=publishedAt&pageSize=6&apiKey=${NEWSAPI_KEY}`;

  try {
    const resp = await fetch(url, {
      next: { revalidate: 10800 },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return [];
    const data = await resp.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: NewsItem[] = (data.articles ?? []).map((a: any): NewsItem => ({
      id:          `newsapi-${a.publishedAt ?? ""}-${a.source?.id ?? Math.random()}`,
      headline:    a.title ?? "",
      description: a.description ?? "",
      published:   a.publishedAt ?? "",
      url:         a.url ?? "",
      teams:       [],
      source:      "NewsAPI",
      outlet:      a.source?.name ?? "",
    }));

    _cache.set(key, { data: items, expiry: Date.now() + CACHE_TTL });
    return items;
  } catch {
    return [];
  }
}
