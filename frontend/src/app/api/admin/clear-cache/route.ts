import { NextResponse } from "next/server";
import { deleteOddsCache } from "@/lib/db";

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await deleteOddsCache("upcoming_games");

  return NextResponse.json({ ok: true, message: "odds cache cleared — next request will fetch fresh data" });
}
