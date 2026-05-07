"use client";

import { useEffect, useState } from "react";

interface RedditPost {
  title: string;
  score: number;
  subreddit: string;
  url?: string;
}

interface PreviewData {
  article: string;
  sentiment: { posts: RedditPost[]; score: number };
}

export function GamePreview({
  gameId,
  homeTeam,
  awayTeam,
  league,
  homeProb,
  spread,
  total,
}: {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  homeProb: number;
  spread: number;
  total: number;
}) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams({
      home: homeTeam,
      away: awayTeam,
      league,
      homeProb: homeProb.toString(),
      spread: spread.toString(),
      total: total.toString(),
    });
    fetch(`/api/games/${gameId}/preview?${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [gameId, homeTeam, awayTeam, league, homeProb, spread, total]);

  if (loading) {
    return (
      <div className="mt-5 space-y-2.5">
        {[100, 90, 80].map((w) => (
          <div
            key={w}
            className="h-3.5 animate-pulse rounded bg-white/[0.03]"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
    );
  }

  if (!data?.article && !data?.sentiment.posts.length) return null;

  return (
    <div className="mt-5 space-y-5">
      {data.article && (
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              AI Sharp Take
            </div>
            {data.sentiment.score > 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>Fan sentiment</span>
                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-1.5 rounded-full bg-orange-500/60"
                    style={{ width: `${Math.round(data.sentiment.score * 100)}%` }}
                  />
                </div>
                <span className="text-slate-500">{Math.round(data.sentiment.score * 100)}</span>
              </div>
            )}
          </div>
          <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-line">
            {data.article}
          </p>
        </div>
      )}

      {data.sentiment.posts.length > 0 && (
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Reddit Buzz
          </div>
          <div className="space-y-2.5">
            {data.sentiment.posts.map((post, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 text-[10px] text-slate-600">
                  r/{post.subreddit}
                </span>
                {post.url ? (
                  <a
                    href={post.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-xs leading-relaxed text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {post.title}
                  </a>
                ) : (
                  <span className="flex-1 text-xs leading-relaxed text-slate-400">{post.title}</span>
                )}
                <span className="shrink-0 text-[10px] text-orange-500/70">+{post.score}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
