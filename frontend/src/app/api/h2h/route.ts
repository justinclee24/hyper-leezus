import { NextRequest, NextResponse } from "next/server";
import { fetchHeadToHead, ESPN_LEAGUES } from "@/lib/espn";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const homeId = searchParams.get("homeId") ?? "";
  const awayId = searchParams.get("awayId") ?? "";
  const leagueKey = (searchParams.get("league") ?? "").toUpperCase();

  const cfg = ESPN_LEAGUES[leagueKey];
  if (!cfg || !homeId || !awayId) {
    return NextResponse.json({ meetings: [] });
  }

  const meetings = await fetchHeadToHead(homeId, awayId, cfg.sport, cfg.league);
  return NextResponse.json({ meetings });
}
