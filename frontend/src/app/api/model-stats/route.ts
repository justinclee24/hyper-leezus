import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.PREDICTION_API_URL;
  const token = process.env.PREDICTION_API_TOKEN;

  if (!url) {
    return NextResponse.json({ models: {}, leagues: [] });
  }

  try {
    const resp = await fetch(`${url}/model/info`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) return NextResponse.json({ models: {}, leagues: [] });
    return NextResponse.json(await resp.json());
  } catch {
    return NextResponse.json({ models: {}, leagues: [] });
  }
}
