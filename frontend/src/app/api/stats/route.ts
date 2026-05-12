import { NextResponse } from "next/server";
import { fetchStandings, fetchNews, fetchNextScheduledGames, ESPN_LEAGUES } from "@/lib/espn";
import { fetchRedditContent } from "@/lib/reddit";
import { fetchNewsApiContent } from "@/lib/newsapi";

const _cache = new Map<string, { payload: unknown; expiry: number }>();
const CACHE_TTL = 30 * 60 * 1000;

export async function GET(req: Request) {
  const league = new URL(req.url).searchParams.get("league")?.toUpperCase() ?? "NBA";
  if (!ESPN_LEAGUES[league]) {
    return NextResponse.json({ error: "Unsupported league" }, { status: 400 });
  }

  const cached = _cache.get(league);
  if (cached && Date.now() < cached.expiry) {
    return NextResponse.json(cached.payload);
  }

  const [standings, espnNews, redditItems, newsApiItems, nextGames] = await Promise.all([
    fetchStandings(league),
    fetchNews(league),
    fetchRedditContent(league),
    fetchNewsApiContent(league),
    fetchNextScheduledGames(league),
  ]);

  const news = [
    ...espnNews.map((n) => ({ ...n, source: "ESPN" as const })),
    ...redditItems,
    ...newsApiItems,
  ].sort((a, b) => {
    const ta = a.published ? new Date(a.published).getTime() : 0;
    const tb = b.published ? new Date(b.published).getTime() : 0;
    return tb - ta;
  });

  const payload = {
    league,
    standings,
    news,
    nextGames,
    hasData: standings.length > 0 || news.length > 0,
    updatedAt: new Date().toISOString(),
  };
  _cache.set(league, { payload, expiry: Date.now() + CACHE_TTL });
  return NextResponse.json(payload);
}
