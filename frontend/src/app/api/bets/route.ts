import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getTrackedBets, addTrackedBet } from "@/lib/db";
import type { TrackedBet } from "@/lib/data";
import { notifyAdminBetTracked } from "@/lib/email";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bets = await getTrackedBets(user.id);
  return NextResponse.json({ bets });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const bet: TrackedBet = {
    id: `bet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    gameId: body.gameId,
    matchup: body.matchup,
    pick: body.pick,
    betType: body.betType,
    odds: body.odds,
    edge: body.edge,
    stake: body.stake ?? 1,
    league: body.league,
    trackedAt: new Date().toISOString(),
    gameDate: body.gameDate ?? undefined,
    result: "pending",
  };

  await addTrackedBet(user.id, bet);
  void notifyAdminBetTracked(user.email, user.name, bet.pick, bet.betType, bet.odds, bet.matchup, bet.league);
  return NextResponse.json({ bet }, { status: 201 });
}
