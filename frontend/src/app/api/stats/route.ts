import { NextResponse } from "next/server";
import { fetchStandings, fetchNews, ESPN_LEAGUES } from "@/lib/espn";

export async function GET(req: Request) {
  const league = new URL(req.url).searchParams.get("league")?.toUpperCase() ?? "NBA";
  if (!ESPN_LEAGUES[league]) {
    return NextResponse.json({ error: "Unsupported league" }, { status: 400 });
  }

  const [standings, news] = await Promise.all([
    fetchStandings(league),
    fetchNews(league),
  ]);

  return NextResponse.json({
    league,
    standings,
    news,
    hasData: standings.length > 0 || news.length > 0,
    updatedAt: new Date().toISOString(),
  });
}
