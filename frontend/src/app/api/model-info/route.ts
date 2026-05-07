import { NextResponse } from "next/server";

const PREDICTION_API_URL = process.env.PREDICTION_API_URL ?? "";
const PREDICTION_API_TOKEN = process.env.PREDICTION_API_TOKEN ?? "";

export async function GET() {
  if (!PREDICTION_API_URL) {
    return NextResponse.json({ models: {}, leagues: ["nba", "nhl", "mlb", "nfl", "ncaab"] });
  }
  try {
    const resp = await fetch(`${PREDICTION_API_URL}/model/info`, {
      headers: { authorization: `Bearer ${PREDICTION_API_TOKEN}` },
      next: { revalidate: 300 },
    });
    if (!resp.ok) return NextResponse.json({ models: {}, leagues: [] });
    return NextResponse.json(await resp.json());
  } catch {
    return NextResponse.json({ models: {}, leagues: [] });
  }
}
