import { NextResponse } from "next/server";
import { fetchStandings, fetchNews, ESPN_LEAGUES } from "@/lib/espn";
import { fetchRedditContent } from "@/lib/reddit";
import { fetchNewsApiContent } from "@/lib/newsapi";

export async function GET(req: Request) {
  const league = new URL(req.url).searchParams.get("league")?.toUpperCase() ?? "NBA";
  if (!ESPN_LEAGUES[league]) {
    return NextResponse.json({ error: "Unsupported league" }, { status: 400 });
  }

  const [standings, espnNews, redditItems, newsApiItems] = await Promise.all([
    fetchStandings(league),
    fetchNews(league),
    fetchRedditContent(league),
    fetchNewsApiContent(league),
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

  return NextResponse.json({
    league,
    standings,
    news,
    hasData: standings.length > 0 || news.length > 0,
    updatedAt: new Date().toISOString(),
  });
}
