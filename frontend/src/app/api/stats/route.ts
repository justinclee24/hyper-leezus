import { NextResponse } from "next/server";
import { fetchStandings, fetchInjuries } from "@/lib/sportradar";

const SUPPORTED = ["NFL", "NBA", "NHL", "MLB"];

export async function GET(req: Request) {
  const league = new URL(req.url).searchParams.get("league")?.toUpperCase() ?? "NFL";
  if (!SUPPORTED.includes(league)) {
    return NextResponse.json({ error: "Unsupported league" }, { status: 400 });
  }

  const [standings, injuries] = await Promise.all([
    fetchStandings(league),
    fetchInjuries(league),
  ]);

  return NextResponse.json({
    league,
    standings,
    injuries,
    updatedAt: new Date().toISOString(),
    hasData: standings.length > 0 || injuries.length > 0,
  });
}
