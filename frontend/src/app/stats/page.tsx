"use client";

import { useEffect, useState } from "react";
import { ArrowUp, ExternalLink, Lightbulb, MessageSquare, Newspaper, Trophy } from "lucide-react";
import type { TeamRecord, NewsItem, H2HMeeting } from "@/lib/espn";
import { matchTeam, buildTidbits, ESPN_LEAGUES } from "@/lib/espn";
import type { GameCard } from "@/lib/data";

type League = keyof typeof ESPN_LEAGUES;
const LEAGUES = Object.keys(ESPN_LEAGUES) as League[];

interface StatsPayload {
  standings: TeamRecord[];
  news: NewsItem[];
  hasData: boolean;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/[0.03] ${className}`} />;
}

function FormBadge({ streak }: { streak: string }) {
  if (!streak) return null;
  const isWin = streak.startsWith("W");
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${isWin ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
      {streak}
    </span>
  );
}

function StatRow({ label, away, home, highlight }: { label: string; away: string; home: string; highlight?: "home" | "away" | "none" }) {
  return (
    <div className="grid grid-cols-3 items-center py-1.5 text-sm">
      <span className={`text-right font-semibold ${highlight === "away" ? "text-orange-400" : "text-slate-300"}`}>{away}</span>
      <span className="text-center text-[11px] text-slate-600">{label}</span>
      <span className={`font-semibold ${highlight === "home" ? "text-orange-400" : "text-slate-300"}`}>{home}</span>
    </div>
  );
}

function GamePreviewCard({ game, standings }: { game: GameCard; standings: TeamRecord[] }) {
  const homeStats = matchTeam(game.homeTeam, standings);
  const awayStats = matchTeam(game.awayTeam, standings);

  const [h2h, setH2h] = useState<H2HMeeting[] | null>(null);

  useEffect(() => {
    if (!homeStats?.id || !awayStats?.id) return;
    fetch(`/api/h2h?homeId=${homeStats.id}&awayId=${awayStats.id}&league=${game.league}`)
      .then((r) => r.json())
      .then((d) => setH2h(d.meetings ?? []))
      .catch(() => setH2h([]));
  }, [homeStats?.id, awayStats?.id, game.league]);

  if (!homeStats && !awayStats) return null;

  const tidbits = homeStats && awayStats ? buildTidbits(awayStats, homeStats, game.league) : [];
  const gameTime = new Date(game.startTime).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });

  const homeEdge = (homeStats && awayStats)
    ? homeStats.pointsFor > awayStats.pointsFor ? "home"
    : awayStats.pointsFor > homeStats.pointsFor ? "away" : "none"
    : "none";

  const defEdge = (homeStats && awayStats)
    ? homeStats.pointsAgainst < awayStats.pointsAgainst ? "home"
    : awayStats.pointsAgainst < homeStats.pointsAgainst ? "away" : "none"
    : "none";

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-slate-400">{game.awayTeam.split(" ").slice(-1)[0]}</span>
          <span className="text-slate-700">@</span>
          <span className="text-white">{game.homeTeam.split(" ").slice(-1)[0]}</span>
        </div>
        <span className="text-[11px] text-slate-600">{gameTime}</span>
      </div>

      <div className="p-4">
        {/* Team headers */}
        <div className="mb-3 grid grid-cols-3 text-center">
          <div>
            <div className="text-xs font-bold text-slate-300">{awayStats?.abbreviation ?? game.awayTeam.split(" ").slice(-1)[0]}</div>
            <div className="text-[11px] text-slate-600">{awayStats ? `${awayStats.wins}-${awayStats.losses}` : "—"}</div>
            {awayStats?.streak && <FormBadge streak={awayStats.streak} />}
          </div>
          <div className="flex items-center justify-center">
            <span className="text-xs font-black text-slate-700">VS</span>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-slate-300">{homeStats?.abbreviation ?? game.homeTeam.split(" ").slice(-1)[0]}</div>
            <div className="text-[11px] text-slate-600">{homeStats ? `${homeStats.wins}-${homeStats.losses}` : "—"}</div>
            {homeStats?.streak && <div className="flex justify-end"><FormBadge streak={homeStats.streak} /></div>}
          </div>
        </div>

        {/* Stats comparison */}
        {homeStats && awayStats && (
          <div className="divide-y divide-white/[0.04] rounded-lg border border-white/[0.04] bg-white/[0.01] px-3">
            <StatRow
              label="Win%"
              away={`${(awayStats.winPct * 100).toFixed(1)}%`}
              home={`${(homeStats.winPct * 100).toFixed(1)}%`}
              highlight={homeStats.winPct > awayStats.winPct ? "home" : homeStats.winPct < awayStats.winPct ? "away" : "none"}
            />
            {homeStats.pointsFor > 0 && (
              <StatRow label="Off PPG" away={homeStats.pointsFor > 0 ? awayStats.pointsFor.toFixed(1) : "—"} home={homeStats.pointsFor.toFixed(1)} highlight={homeEdge} />
            )}
            {homeStats.pointsAgainst > 0 && (
              <StatRow label="Def PPG" away={awayStats.pointsAgainst.toFixed(1)} home={homeStats.pointsAgainst.toFixed(1)} highlight={defEdge} />
            )}
            {homeStats.homeRecord && (
              <StatRow label="Home / Away" away={awayStats.awayRecord || "—"} home={homeStats.homeRecord || "—"} />
            )}
          </div>
        )}

        {/* Tidbits */}
        {tidbits.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {tidbits.map((tip, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg bg-orange-500/[0.05] px-3 py-2">
                <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-orange-500/60" />
                <span className="text-[11px] leading-relaxed text-slate-400">{tip}</span>
              </div>
            ))}
          </div>
        )}

        {/* Head-to-head */}
        {h2h !== null && h2h.length > 0 && homeStats && awayStats && (
          <div className="mt-3">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                H2H · Last {h2h.length}
              </span>
              {(() => {
                const homeWins = h2h.filter(
                  (m) =>
                    (m.homeTeamId === homeStats.id && m.winner === "home") ||
                    (m.awayTeamId === homeStats.id && m.winner === "away"),
                ).length;
                const awayWins = h2h.length - homeWins;
                const leader =
                  homeWins > awayWins
                    ? homeStats.abbreviation
                    : awayWins > homeWins
                    ? awayStats.abbreviation
                    : null;
                return (
                  <span className="text-[10px] font-bold text-slate-400">
                    {awayStats.abbreviation} {awayWins}–{homeWins} {homeStats.abbreviation}
                    {leader && (
                      <span className="ml-1 text-slate-600">({leader} leads)</span>
                    )}
                  </span>
                );
              })()}
            </div>
            <div className="space-y-1">
              {h2h.slice(0, 3).map((m, i) => {
                const d = new Date(m.date).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "2-digit",
                });
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded bg-white/[0.02] px-2.5 py-1 text-[11px]"
                  >
                    <span className="text-slate-600">{d}</span>
                    <span>
                      <span className={m.winner === "away" ? "font-bold text-slate-200" : "text-slate-500"}>
                        {m.awayAbbr} {m.awayScore}
                      </span>
                      <span className="mx-1 text-slate-700">–</span>
                      <span className={m.winner === "home" ? "font-bold text-slate-200" : "text-slate-500"}>
                        {m.homeScore} {m.homeAbbr}
                      </span>
                    </span>
                    <span className="text-[10px] text-slate-700">@{m.homeAbbr}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StandingsTable({ standings }: { standings: TeamRecord[] }) {
  const grouped = standings.reduce<Record<string, TeamRecord[]>>((acc, t) => {
    const key = t.conference || "League";
    (acc[key] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([group, teams]) => (
        <div key={group}>
          {group && <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">{group}</div>}
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.05] text-[11px] uppercase tracking-wider text-slate-600">
                  <th className="px-4 py-2.5 text-left font-medium">Team</th>
                  <th className="px-3 py-2.5 text-center font-medium">W</th>
                  <th className="px-3 py-2.5 text-center font-medium">L</th>
                  <th className="px-3 py-2.5 text-center font-medium">Win%</th>
                  <th className="px-3 py-2.5 text-center font-medium">GB</th>
                  <th className="px-3 py-2.5 text-center font-medium">Home</th>
                  <th className="px-3 py-2.5 text-center font-medium">Away</th>
                  <th className="px-3 py-2.5 text-center font-medium">Streak</th>
                </tr>
              </thead>
              <tbody>
                {[...teams].sort((a, b) => b.winPct - a.winPct).map((t, i) => (
                  <tr key={t.id} className={`border-b border-white/[0.03] ${i === 0 ? "bg-orange-500/[0.03]" : ""}`}>
                    <td className="px-4 py-2.5">
                      <span className="mr-2 text-[11px] text-slate-600">{t.abbreviation}</span>
                      <span className="text-slate-300">{t.name}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-300">{t.wins}</td>
                    <td className="px-3 py-2.5 text-center text-slate-300">{t.losses}</td>
                    <td className="px-3 py-2.5 text-center font-semibold text-orange-400">{(t.winPct * 100).toFixed(1)}%</td>
                    <td className="px-3 py-2.5 text-center text-slate-500">{t.gamesBack > 0 ? t.gamesBack.toFixed(1) : "—"}</td>
                    <td className="px-3 py-2.5 text-center text-slate-400">{t.homeRecord || "—"}</td>
                    <td className="px-3 py-2.5 text-center text-slate-400">{t.awayRecord || "—"}</td>
                    <td className="px-3 py-2.5 text-center"><FormBadge streak={t.streak} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

const SOURCE_STYLE: Record<string, string> = {
  ESPN:    "bg-orange-500/10 text-orange-400",
  Reddit:  "bg-red-500/10 text-red-400",
  NewsAPI: "bg-blue-500/10 text-blue-400",
};

function NewsCard({ item }: { item: NewsItem }) {
  const date = item.published
    ? new Date(item.published).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "";
  const sourceLabel = item.source === "Reddit" && item.subreddit
    ? `r/${item.subreddit}`
    : item.source === "NewsAPI" && item.outlet
    ? item.outlet
    : item.source ?? "ESPN";
  const sourceStyle = SOURCE_STYLE[item.source ?? "ESPN"] ?? SOURCE_STYLE.ESPN;

  return (
    <a
      href={item.url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-4 rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 transition hover:border-white/[0.1] hover:bg-white/[0.04]"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-snug text-slate-200 group-hover:text-white">
            {item.headline}
          </p>
          {item.url && <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-700 group-hover:text-slate-500" />}
        </div>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{item.description}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${sourceStyle}`}>{sourceLabel}</span>
          {item.teams.slice(0, 2).map((t) => (
            <span key={t} className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-slate-500">{t}</span>
          ))}
          {item.source === "Reddit" && item.score !== undefined && (
            <span className="flex items-center gap-0.5 text-[10px] text-slate-600">
              <ArrowUp className="h-2.5 w-2.5" />{item.score.toLocaleString()}
            </span>
          )}
          {item.source === "Reddit" && item.comments !== undefined && (
            <span className="flex items-center gap-0.5 text-[10px] text-slate-600">
              <MessageSquare className="h-2.5 w-2.5" />{item.comments.toLocaleString()}
            </span>
          )}
          {date && <span className="text-[10px] text-slate-700">{date}</span>}
        </div>
      </div>
    </a>
  );
}

export default function StatsPage() {
  const [league, setLeague] = useState<League>("NBA");
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [allFetchedGames, setAllFetchedGames] = useState<GameCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"preview" | "standings" | "news">("preview");

  // Fetch games once — same cache as dashboard, no re-fetch on league switch
  useEffect(() => {
    fetch("/api/games")
      .then((r) => r.json())
      .then((d) => setAllFetchedGames(d.games ?? []))
      .catch(() => {});
  }, []);

  // Fetch standings + news per league
  useEffect(() => {
    setLoading(true);
    setStats(null);
    fetch(`/api/stats?league=${league}`)
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [league]);

  const games = allFetchedGames.filter((g) => g.league.toUpperCase().startsWith(league));

  const previewGames = games.filter(
    (g) => stats?.standings.length && (matchTeam(g.homeTeam, stats.standings) || matchTeam(g.awayTeam, stats.standings)),
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Statistics</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Team stats, standings, and league news
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[11px] font-semibold text-slate-500">
          <Newspaper className="h-3 w-3 text-orange-500" />
          Multi-source data
        </div>
      </div>

      {/* League filter */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {LEAGUES.map((l) => (
          <button
            key={l}
            onClick={() => setLeague(l)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              league === l
                ? "border-orange-500/40 bg-orange-500/15 text-orange-400"
                : "border-white/[0.06] bg-white/[0.02] text-slate-500 hover:text-slate-300"
            }`}
          >
            {ESPN_LEAGUES[l].label}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-5 border-b border-white/[0.05]">
        {(["preview", "standings", "news"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`-mb-px flex items-center gap-1.5 pb-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "border-b-2 border-orange-500 text-orange-400"
                : "text-slate-600 hover:text-slate-400"
            }`}
          >
            {tab === "preview" ? "Game Previews" : tab === "standings" ? "Standings" : (
              <><Newspaper className="h-3.5 w-3.5" />News</>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      ) : !stats?.hasData ? (
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-10 text-center">
          <Trophy className="mx-auto mb-3 h-8 w-8 text-slate-700" />
          <p className="text-sm text-slate-500">No data available for {league} right now.</p>
          <p className="mt-1 text-xs text-slate-700">This league may be in its offseason.</p>
        </div>
      ) : (
        <>
          {activeTab === "preview" && (
            <div className="grid gap-4 sm:grid-cols-2">
              {previewGames.length === 0 ? (
                <div className="col-span-2 rounded-xl border border-white/[0.05] bg-white/[0.02] p-8 text-center">
                  <p className="text-sm text-slate-500">No upcoming {league} games found in today&apos;s schedule.</p>
                  <p className="mt-1 text-xs text-slate-600">Check the Standings tab to browse team stats.</p>
                </div>
              ) : (
                previewGames.map((g) => (
                  <GamePreviewCard key={g.id} game={g} standings={stats.standings} />
                ))
              )}
            </div>
          )}

          {activeTab === "standings" && <StandingsTable standings={stats.standings} />}

          {activeTab === "news" && (
            <div className="space-y-3">
              {stats.news.length === 0 ? (
                <p className="text-sm text-slate-500">No recent news for {league}.</p>
              ) : (
                stats.news.map((item) => <NewsCard key={item.id} item={item} />)
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
