import { NextResponse } from "next/server";
import { derivePicks, fetchUpcomingGames } from "@/lib/odds";

export async function GET() {
  const games = await fetchUpcomingGames();
  if (!games.length) {
    return NextResponse.json({ games: [], picks: [] });
  }
  const upcoming = games.slice(0, 12);
  const picks = derivePicks(upcoming);
  return NextResponse.json({ games: upcoming, picks });
}
