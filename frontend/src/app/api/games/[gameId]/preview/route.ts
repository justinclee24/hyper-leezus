import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

interface RedditPost {
  title: string;
  score: number;
  num_comments: number;
  subreddit: string;
}

async function fetchRedditSentiment(
  homeTeam: string,
  awayTeam: string,
  league: string,
): Promise<{ posts: RedditPost[]; score: number }> {
  try {
    const query = `${awayTeam} ${homeTeam} ${league}`;
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=hot&limit=10&raw_json=1&t=week`;
    const resp = await fetch(url, {
      headers: { "User-Agent": "HyperLeezus/1.0 sports-analytics" },
      next: { revalidate: 900 },
    });
    if (!resp.ok) return { posts: [], score: 0.5 };

    const data = await resp.json();
    const posts: RedditPost[] = (data.data?.children ?? [])
      .map((c: { data: RedditPost & { score: number } }) => ({
        title: c.data.title,
        score: c.data.score,
        num_comments: c.data.num_comments,
        subreddit: c.data.subreddit,
      }))
      .filter((p: RedditPost) => p.score > 0);

    const avgEngagement =
      posts.length > 0
        ? posts.reduce((s, p) => s + Math.min(p.score / 500, 1), 0) / posts.length
        : 0.5;

    return {
      posts: posts.slice(0, 5),
      score: Math.round(avgEngagement * 100) / 100,
    };
  } catch {
    return { posts: [], score: 0.5 };
  }
}

async function generateArticle(params: {
  homeTeam: string;
  awayTeam: string;
  league: string;
  homeProb: number;
  spread: number;
  total: number;
  sentiment: number;
  posts: RedditPost[];
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "";

  const { homeTeam, awayTeam, league, homeProb, spread, total, sentiment, posts } = params;
  const sentimentLabel = sentiment > 0.6 ? "bullish" : sentiment < 0.35 ? "bearish" : "mixed";
  const topPosts =
    posts.length > 0
      ? posts.map((p) => `- "${p.title}" (${p.score} pts, r/${p.subreddit})`).join("\n")
      : "";

  const prompt = `Write a sharp, punchy 3-paragraph sports betting preview for: ${awayTeam} @ ${homeTeam} (${league}).

Model data:
- Home win probability: ${Math.round(homeProb * 100)}%
- Spread: Home ${spread > 0 ? "+" : ""}${spread.toFixed(1)}
- Total: ${total.toFixed(1)}
- Fan sentiment: ${sentimentLabel} (${Math.round(sentiment * 100)}/100)
${topPosts ? `\nRecent fan discussion:\n${topPosts}` : ""}

Write like a sharp sports bettor who has done their homework. Cover: (1) the key matchup angle, (2) what the model sees that the market might be missing, (3) a direct betting take. Be specific, confident, and entertaining. 150-200 words max.`;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 450,
        messages: [{ role: "user", content: prompt }],
      }),
      next: { revalidate: 3600 },
    });
    if (!resp.ok) return "";
    const data = await resp.json();
    return (data.content?.[0]?.text ?? "").trim();
  } catch {
    return "";
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> },
) {
  await params; // consume required param
  const url = new URL(req.url);
  const homeTeam = url.searchParams.get("home") ?? "";
  const awayTeam = url.searchParams.get("away") ?? "";
  const league = url.searchParams.get("league") ?? "";
  const homeProb = parseFloat(url.searchParams.get("homeProb") ?? "0.5");
  const spread = parseFloat(url.searchParams.get("spread") ?? "0");
  const total = parseFloat(url.searchParams.get("total") ?? "0");

  if (!homeTeam || !awayTeam) {
    return NextResponse.json({ article: "", sentiment: { posts: [], score: 0.5 } });
  }

  const sentiment = await fetchRedditSentiment(homeTeam, awayTeam, league);
  const article = await generateArticle({
    homeTeam,
    awayTeam,
    league,
    homeProb,
    spread,
    total,
    sentiment: sentiment.score,
    posts: sentiment.posts,
  });

  return NextResponse.json({ article, sentiment });
}
