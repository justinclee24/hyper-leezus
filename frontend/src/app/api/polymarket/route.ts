import { NextRequest, NextResponse } from "next/server";
import { fetchTeamMarkets } from "@/lib/polymarket";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const team = searchParams.get("team")?.trim();
  const sport = searchParams.get("sport")?.trim() ?? "";

  if (!team) return NextResponse.json({ markets: [] });

  const markets = await fetchTeamMarkets(team, sport);
  return NextResponse.json({ markets });
}
