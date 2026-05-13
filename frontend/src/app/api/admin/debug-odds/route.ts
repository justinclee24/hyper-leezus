import { NextResponse } from "next/server";
import { activeSeasonSports } from "@/lib/odds";

export async function GET(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ODDS_API_KEY not set" }, { status: 500 });

  const activeSports = activeSeasonSports();
  const results: Record<string, { status: number; eventCount: number; error?: string }> = {};

  await Promise.all(
    Object.entries(activeSports).map(async ([sportKey, league]) => {
      try {
        const url =
          `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?` +
          new URLSearchParams({
            apiKey,
            regions: "us",
            markets: "h2h",
            dateFormat: "iso",
            oddsFormat: "american",
          });
        const resp = await fetch(url, { cache: "no-store" });
        if (!resp.ok) {
          results[`${league} (${sportKey})`] = { status: resp.status, eventCount: 0, error: resp.statusText };
          return;
        }
        const events = await resp.json();
        results[`${league} (${sportKey})`] = {
          status: resp.status,
          eventCount: Array.isArray(events) ? events.length : -1,
        };
      } catch (e) {
        results[`${sportKey}`] = { status: 0, eventCount: 0, error: String(e) };
      }
    }),
  );

  return NextResponse.json({ activeSports: Object.keys(activeSports), results });
}
