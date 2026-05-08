import type { NewsItem } from "./espn";

const LEAGUE_SUBREDDITS: Record<string, string> = {
  NBA:   "nba",
  NFL:   "nfl",
  NHL:   "hockey",
  MLB:   "baseball",
  NCAAB: "CollegeBasketball",
  MLS:   "MLS",
  EPL:   "soccer",
};

const CACHE_TTL = 15 * 60 * 1000;
const _cache = new Map<string, { data: NewsItem[]; expiry: number }>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchSubredditPosts(sub: string, limit = 8): Promise<any[]> {
  try {
    const resp = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=${limit}&raw_json=1`, {
      headers: { "User-Agent": "hyper-leezus-sports-app/1.0" },
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.data?.children ?? []).map((c: any) => c.data);
  } catch {
    return [];
  }
}

export async function fetchRedditContent(leagueKey: string): Promise<NewsItem[]> {
  const key = leagueKey.toUpperCase();
  const hit = _cache.get(key);
  if (hit && Date.now() < hit.expiry) return hit.data;

  const leagueSub = LEAGUE_SUBREDDITS[key];
  const [leaguePosts, bettingPosts] = await Promise.all([
    leagueSub ? fetchSubredditPosts(leagueSub, 6) : Promise.resolve([]),
    fetchSubredditPosts("sportsbook", 5),
  ]);

  const items: NewsItem[] = [...leaguePosts, ...bettingPosts]
    .filter(
      (p) =>
        !p.stickied &&
        p.score >= 5 &&
        p.title &&
        !p.removed_by_category &&
        p.title !== "[deleted]",
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((p: any): NewsItem => ({
      id:          `reddit-${p.id}`,
      headline:    p.title,
      description: p.selftext ? p.selftext.slice(0, 220) : "",
      published:   new Date(p.created_utc * 1000).toISOString(),
      url:         `https://reddit.com${p.permalink}`,
      teams:       [],
      source:      "Reddit",
      subreddit:   p.subreddit,
      score:       p.score,
      comments:    p.num_comments,
    }))
    .slice(0, 10);

  _cache.set(key, { data: items, expiry: Date.now() + CACHE_TTL });
  return items;
}
