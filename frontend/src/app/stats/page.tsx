"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle, ArrowUp, ExternalLink, Lightbulb, MessageSquare,
  Newspaper, Shield, TrendingUp, Trophy, Zap,
} from "lucide-react";
import type { TeamRecord, NewsItem, H2HMeeting, ScheduledGame, TeamInjuryReport } from "@/lib/espn";
import { matchTeam, buildTidbits, ESPN_LEAGUES } from "@/lib/espn";
import type { GameCard, PitcherInfo } from "@/lib/data";
import type { NHLTeamStats } from "@/lib/nhl";

type League = keyof typeof ESPN_LEAGUES;
const LEAGUES = Object.keys(ESPN_LEAGUES) as League[];

interface PitcherMatchup { team: string; name: string; era: number; whip: number; k9: number; wins: number; losses: number; }

interface StatsPayload {
  standings: TeamRecord[];
  news: NewsItem[];
  nextGames: ScheduledGame[];
  injuries: TeamInjuryReport[];
  insights: string[];
  pitcherMatchups: PitcherMatchup[] | null;
  specialTeams: NHLTeamStats[] | null;
  hasData: boolean;
}

// ─── Shared primitives ────────────────────────────────────────────────────────

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

function RestBadge({ days, label }: { days: number | undefined; label: string }) {
  if (days === undefined || days > 3) return null;
  if (days <= 1) return (
    <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
      {days === 0 ? "B2B" : "1-DAY"} {label}
    </span>
  );
  return (
    <span className="rounded border border-amber-500/20 bg-amber-500/[0.08] px-1.5 py-0.5 text-[9px] font-bold text-amber-500">
      {days}d REST {label}
    </span>
  );
}

function InjuryBadge({ count, label }: { count: number | undefined; label: string }) {
  if (!count || count < 1) return null;
  return (
    <span className="flex items-center gap-0.5 rounded border border-orange-500/20 bg-orange-500/[0.07] px-1.5 py-0.5 text-[9px] font-bold text-orange-400">
      <AlertTriangle className="h-2.5 w-2.5" />
      {count} OUT {label}
    </span>
  );
}

function PitcherRow({ pitcher, label }: { pitcher: PitcherInfo | undefined; label: string }) {
  if (!pitcher) return null;
  const eraColor = pitcher.era < 3.5 ? "text-emerald-400" : pitcher.era > 5 ? "text-red-400" : "text-slate-300";
  return (
    <div className="flex items-center justify-between rounded-md bg-white/[0.03] px-2.5 py-1.5 text-[11px]">
      <span className="text-slate-500">{label} SP</span>
      <span className="font-semibold text-slate-300">{pitcher.name}</span>
      <span className={`font-bold ${eraColor}`}>{pitcher.era.toFixed(2)} ERA</span>
      <span className="text-slate-600">{pitcher.whip.toFixed(2)} WHIP</span>
      <span className="text-slate-600">{pitcher.k9.toFixed(1)} K/9</span>
    </div>
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

// ─── Game Preview Card ─────────────────────────────────────────────────────────

function GamePreviewCard({ game, standings, league }: { game: GameCard; standings: TeamRecord[]; league: string }) {
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
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });

  const homeEdge = homeStats && awayStats
    ? homeStats.pointsFor > awayStats.pointsFor ? "home" : awayStats.pointsFor > homeStats.pointsFor ? "away" : "none"
    : "none";
  const defEdge = homeStats && awayStats
    ? homeStats.pointsAgainst < awayStats.pointsAgainst ? "home" : awayStats.pointsAgainst < homeStats.pointsAgainst ? "away" : "none"
    : "none";

  const isNHL = league === "NHL";
  const isMLB = league === "MLB";

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
        {/* Team headers with rest/injury badges */}
        <div className="mb-3 grid grid-cols-3 text-center">
          <div className="space-y-1">
            <div className="text-xs font-bold text-slate-300">{awayStats?.abbreviation ?? game.awayTeam.split(" ").slice(-1)[0]}</div>
            <div className="text-[11px] text-slate-600">{awayStats ? `${awayStats.wins}-${awayStats.losses}` : "—"}</div>
            {awayStats?.streak && <FormBadge streak={awayStats.streak} />}
            <div className="flex flex-wrap justify-center gap-1">
              <RestBadge days={game.awayRestDays} label="AWAY" />
              <InjuryBadge count={game.awayInjuryCount} label="AWAY" />
            </div>
          </div>
          <div className="flex items-center justify-center">
            <span className="text-xs font-black text-slate-700">VS</span>
          </div>
          <div className="space-y-1 text-right">
            <div className="text-xs font-bold text-slate-300">{homeStats?.abbreviation ?? game.homeTeam.split(" ").slice(-1)[0]}</div>
            <div className="text-[11px] text-slate-600">{homeStats ? `${homeStats.wins}-${homeStats.losses}` : "—"}</div>
            {homeStats?.streak && <div className="flex justify-end"><FormBadge streak={homeStats.streak} /></div>}
            <div className="flex flex-wrap justify-end gap-1">
              <RestBadge days={game.homeRestDays} label="HOME" />
              <InjuryBadge count={game.homeInjuryCount} label="HOME" />
            </div>
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
              <StatRow label={isNHL ? "Goals/G" : "Off PPG"} away={awayStats.pointsFor.toFixed(1)} home={homeStats.pointsFor.toFixed(1)} highlight={homeEdge} />
            )}
            {homeStats.pointsAgainst > 0 && (
              <StatRow label={isNHL ? "GA/G" : "Def PPG"} away={awayStats.pointsAgainst.toFixed(1)} home={homeStats.pointsAgainst.toFixed(1)} highlight={defEdge} />
            )}
            {isNHL && game.homePowerPlay !== undefined && game.awayPowerPlay !== undefined && (
              <StatRow
                label="PP%"
                away={`${game.awayPowerPlay.toFixed(1)}%`}
                home={`${game.homePowerPlay.toFixed(1)}%`}
                highlight={game.homePowerPlay > game.awayPowerPlay ? "home" : "away"}
              />
            )}
            {homeStats.homeRecord && (
              <StatRow label="Home / Away" away={awayStats.awayRecord || "—"} home={homeStats.homeRecord || "—"} />
            )}
          </div>
        )}

        {/* MLB Pitcher Matchup */}
        {isMLB && (game.homePitcher || game.awayPitcher) && (
          <div className="mt-3 space-y-1">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Probable Starters</p>
            <PitcherRow pitcher={game.awayPitcher} label={game.awayTeam.split(" ").slice(-1)[0]} />
            <PitcherRow pitcher={game.homePitcher} label={game.homeTeam.split(" ").slice(-1)[0]} />
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
                  (m) => (m.homeTeamId === homeStats.id && m.winner === "home") || (m.awayTeamId === homeStats.id && m.winner === "away"),
                ).length;
                const awayWins = h2h.length - homeWins;
                return (
                  <span className="text-[10px] font-bold text-slate-400">
                    {awayStats.abbreviation} {awayWins}–{homeWins} {homeStats.abbreviation}
                    {homeWins !== awayWins && (
                      <span className="ml-1 text-slate-600">({homeWins > awayWins ? homeStats.abbreviation : awayStats.abbreviation} leads)</span>
                    )}
                  </span>
                );
              })()}
            </div>
            <div className="space-y-1">
              {h2h.slice(0, 3).map((m, i) => {
                const d = new Date(m.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
                return (
                  <div key={i} className="flex items-center justify-between rounded bg-white/[0.02] px-2.5 py-1 text-[11px]">
                    <span className="text-slate-600">{d}</span>
                    <span>
                      <span className={m.winner === "away" ? "font-bold text-slate-200" : "text-slate-500"}>{m.awayAbbr} {m.awayScore}</span>
                      <span className="mx-1 text-slate-700">–</span>
                      <span className={m.winner === "home" ? "font-bold text-slate-200" : "text-slate-500"}>{m.homeScore} {m.homeAbbr}</span>
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

// ─── Standings Table ───────────────────────────────────────────────────────────

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

// ─── Injury Report ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  Out:           "border-red-500/30 bg-red-500/10 text-red-400",
  Doubtful:      "border-red-400/20 bg-red-400/[0.07] text-red-400",
  Questionable:  "border-amber-500/30 bg-amber-500/[0.08] text-amber-400",
  "Day-To-Day":  "border-slate-500/30 bg-slate-500/10 text-slate-400",
};

const STATUS_ORDER: Record<string, number> = {
  Out: 0, Doubtful: 1, Questionable: 2, "Day-To-Day": 3,
};

function InjuryReport({ injuries, standings }: { injuries: TeamInjuryReport[]; standings: TeamRecord[] }) {
  if (!injuries.length) {
    return (
      <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-10 text-center">
        <Shield className="mx-auto mb-3 h-8 w-8 text-emerald-700" />
        <p className="text-sm text-slate-500">No significant injuries reported.</p>
        <p className="mt-1 text-xs text-slate-700">All players are currently healthy or active.</p>
      </div>
    );
  }

  // Sort teams by number of Out players (most impacted first)
  const sorted = [...injuries]
    .map((t) => ({
      ...t,
      players: [...t.players].sort(
        (a, b) => (STATUS_ORDER[a.status] ?? 4) - (STATUS_ORDER[b.status] ?? 4),
      ),
      outCount: t.players.filter((p) => p.status === "Out").length,
      doubtCount: t.players.filter((p) => p.status === "Doubtful").length,
    }))
    .filter((t) => t.players.some((p) => p.status === "Out" || p.status === "Doubtful" || p.status === "Questionable"))
    .sort((a, b) => b.outCount - a.outCount || b.doubtCount - a.doubtCount);

  const totalOut = sorted.reduce((n, t) => n + t.outCount, 0);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">League Injury Summary</span>
        <span className="rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-bold text-red-400">
          {totalOut} Out
        </span>
        <span className="rounded border border-red-400/20 bg-red-400/[0.07] px-2 py-0.5 text-[11px] font-bold text-red-400">
          {sorted.reduce((n, t) => n + t.doubtCount, 0)} Doubtful
        </span>
        <span className="text-[11px] text-slate-600">
          {sorted.length} team{sorted.length !== 1 ? "s" : ""} affected
        </span>
      </div>

      {sorted.map((team) => {
        const record = matchTeam(team.teamName, standings);
        const outPlayers    = team.players.filter((p) => p.status === "Out");
        const doubtPlayers  = team.players.filter((p) => p.status === "Doubtful");
        const otherPlayers  = team.players.filter((p) => p.status !== "Out" && p.status !== "Doubtful");

        return (
          <div key={team.teamId} className="rounded-xl border border-white/[0.05] bg-white/[0.02] overflow-hidden">
            {/* Team header */}
            <div className="flex items-center gap-3 border-b border-white/[0.05] bg-white/[0.02] px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base font-black text-white">{team.teamAbbr}</span>
                <span className="truncate text-sm font-medium text-slate-300">{team.teamName}</span>
              </div>
              <div className="ml-auto flex items-center gap-2 shrink-0">
                {record && (
                  <span className="text-[11px] text-slate-600">{record.wins}–{record.losses}</span>
                )}
                {team.outCount > 0 && (
                  <span className="rounded border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
                    {team.outCount} OUT
                  </span>
                )}
                {team.doubtCount > 0 && (
                  <span className="rounded border border-red-400/20 bg-red-400/[0.07] px-1.5 py-0.5 text-[9px] font-bold text-red-400">
                    {team.doubtCount} DOUBTFUL
                  </span>
                )}
              </div>
            </div>

            <div className="divide-y divide-white/[0.03] px-4 py-1">
              {/* Out section */}
              {outPlayers.length > 0 && (
                <>
                  <div className="py-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-red-500/60">Out</span>
                  </div>
                  {outPlayers.map((p, i) => (
                    <PlayerRow key={`out-${i}`} player={p} />
                  ))}
                </>
              )}

              {/* Doubtful section */}
              {doubtPlayers.length > 0 && (
                <>
                  <div className="py-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-red-400/50">Doubtful</span>
                  </div>
                  {doubtPlayers.map((p, i) => (
                    <PlayerRow key={`doubt-${i}`} player={p} />
                  ))}
                </>
              )}

              {/* Questionable / Day-To-Day */}
              {otherPlayers.length > 0 && (
                <>
                  <div className="py-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500/50">Questionable / GTD</span>
                  </div>
                  {otherPlayers.map((p, i) => (
                    <PlayerRow key={`other-${i}`} player={p} />
                  ))}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PlayerRow({ player }: { player: { name: string; position: string; status: string; injuryType: string } }) {
  const style = STATUS_STYLE[player.status] ?? STATUS_STYLE["Day-To-Day"];
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-6 shrink-0 text-[10px] font-bold text-slate-600">{player.position}</span>
        <span className="truncate text-sm text-slate-300">{player.name}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {player.injuryType && <span className="text-[10px] text-slate-600">{player.injuryType}</span>}
        <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${style}`}>{player.status}</span>
      </div>
    </div>
  );
}

// ─── Insights Panel ────────────────────────────────────────────────────────────

const INSIGHT_ICONS = [TrendingUp, Zap, Shield, AlertTriangle, Trophy, TrendingUp, Zap, Shield, AlertTriangle, Trophy];

function InsightsPanel({
  insights, pitcherMatchups, specialTeams, league,
}: {
  insights: string[];
  pitcherMatchups: PitcherMatchup[] | null;
  specialTeams: NHLTeamStats[] | null;
  league: string;
}) {
  return (
    <div className="space-y-6">
      {/* Generated nuggets */}
      {insights.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-400">League Trends</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {insights.map((insight, i) => {
              const Icon = INSIGHT_ICONS[i % INSIGHT_ICONS.length];
              return (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-orange-500/70" />
                  <p className="text-[12px] leading-relaxed text-slate-300">{insight}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MLB probable pitchers */}
      {league === "MLB" && pitcherMatchups && pitcherMatchups.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-400">Today&apos;s Probable Starters</h2>
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.05] text-[11px] uppercase tracking-wider text-slate-600">
                  <th className="px-4 py-2.5 text-left font-medium">Team</th>
                  <th className="px-3 py-2.5 text-left font-medium">Pitcher</th>
                  <th className="px-3 py-2.5 text-center font-medium">ERA</th>
                  <th className="px-3 py-2.5 text-center font-medium">WHIP</th>
                  <th className="px-3 py-2.5 text-center font-medium">K/9</th>
                  <th className="px-3 py-2.5 text-center font-medium">W–L</th>
                </tr>
              </thead>
              <tbody>
                {pitcherMatchups.map((p, i) => {
                  const eraClass = p.era < 3.5 ? "text-emerald-400" : p.era > 5 ? "text-red-400" : "text-slate-300";
                  return (
                    <tr key={i} className="border-b border-white/[0.03]">
                      <td className="px-4 py-2.5 font-medium text-slate-400">{p.team.split(" ").slice(-1)[0]}</td>
                      <td className="px-3 py-2.5 text-slate-200">{p.name}</td>
                      <td className={`px-3 py-2.5 text-center font-bold ${eraClass}`}>{p.era.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-center text-slate-400">{p.whip.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-center text-slate-400">{p.k9.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-center text-slate-500">{p.wins}–{p.losses}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NHL special teams */}
      {league === "NHL" && specialTeams && specialTeams.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-400">Special Teams Rankings</h2>
          <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.05] text-[11px] uppercase tracking-wider text-slate-600">
                  <th className="px-4 py-2.5 text-left font-medium">Team</th>
                  <th className="px-3 py-2.5 text-center font-medium">PP%</th>
                  <th className="px-3 py-2.5 text-center font-medium">PK%</th>
                  <th className="px-3 py-2.5 text-center font-medium">GF/G</th>
                  <th className="px-3 py-2.5 text-center font-medium">GA/G</th>
                  <th className="px-3 py-2.5 text-center font-medium">SF/G</th>
                </tr>
              </thead>
              <tbody>
                {specialTeams.map((t, i) => {
                  const ppClass = t.powerPlayPct > 24 ? "text-emerald-400 font-bold" : t.powerPlayPct < 17 ? "text-red-400" : "text-slate-300";
                  return (
                    <tr key={t.teamAbbr} className={`border-b border-white/[0.03] ${i < 3 ? "bg-orange-500/[0.02]" : ""}`}>
                      <td className="px-4 py-2.5">
                        <span className="mr-2 text-[11px] text-slate-600">{t.teamAbbr}</span>
                        <span className="text-slate-300">{t.teamName}</span>
                      </td>
                      <td className={`px-3 py-2.5 text-center ${ppClass}`}>{t.powerPlayPct.toFixed(1)}%</td>
                      <td className="px-3 py-2.5 text-center text-slate-400">{t.penaltyKillPct.toFixed(1)}%</td>
                      <td className="px-3 py-2.5 text-center text-slate-400">{t.goalsForPerGame.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-center text-slate-500">{t.goalsAgainstPerGame.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{t.shotsForPerGame.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {insights.length === 0 && !pitcherMatchups?.length && !specialTeams?.length && (
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-10 text-center">
          <Lightbulb className="mx-auto mb-3 h-8 w-8 text-slate-700" />
          <p className="text-sm text-slate-500">No insights available yet.</p>
          <p className="mt-1 text-xs text-slate-700">Check back once the season is underway.</p>
        </div>
      )}
    </div>
  );
}

// ─── News Card ─────────────────────────────────────────────────────────────────

const SOURCE_STYLE: Record<string, string> = {
  ESPN:    "bg-orange-500/10 text-orange-400",
  Reddit:  "bg-red-500/10 text-red-400",
  NewsAPI: "bg-blue-500/10 text-blue-400",
};

function NewsCard({ item }: { item: NewsItem }) {
  const date = item.published
    ? new Date(item.published).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    : "";
  const sourceLabel =
    item.source === "Reddit" && item.subreddit ? `r/${item.subreddit}` :
    item.source === "NewsAPI" && item.outlet   ? item.outlet :
    item.source ?? "ESPN";
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
          <p className="text-sm font-semibold leading-snug text-slate-200 group-hover:text-white">{item.headline}</p>
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

// ─── Page ──────────────────────────────────────────────────────────────────────

type Tab = "preview" | "standings" | "injuries" | "insights" | "news";

export default function StatsPage() {
  const [league, setLeague] = useState<League>("NBA");
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [allFetchedGames, setAllFetchedGames] = useState<GameCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("preview");

  useEffect(() => {
    fetch("/api/games")
      .then((r) => r.json())
      .then((d) => setAllFetchedGames(d.games ?? []))
      .catch(() => {});
  }, []);

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

  const injuryCount = stats?.injuries?.reduce((n, t) => n + t.players.filter((p) => p.status === "Out" || p.status === "Doubtful").length, 0) ?? 0;

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: "preview",   label: "Game Previews" },
    { id: "standings", label: "Standings" },
    { id: "injuries",  label: "Injuries", badge: injuryCount > 0 ? injuryCount : undefined },
    { id: "insights",  label: "Insights" },
    { id: "news",      label: "News" },
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stats &amp; Insights</h1>
          <p className="mt-0.5 text-sm text-slate-500">Matchup intelligence, injury reports, and league trends</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[11px] font-semibold text-slate-500">
          <Newspaper className="h-3 w-3 text-orange-500" />
          Multi-source data
        </div>
      </div>

      {/* League selector */}
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
      <div className="mb-6 flex gap-5 overflow-x-auto border-b border-white/[0.05] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`-mb-px flex shrink-0 items-center gap-1.5 pb-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-orange-500 text-orange-400"
                : "text-slate-600 hover:text-slate-400"
            }`}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-400">
                {tab.badge}
              </span>
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
                <div className="col-span-2 rounded-xl border border-white/[0.05] bg-white/[0.02] p-6">
                  <p className="mb-4 text-sm text-slate-500">No {league} games in the current odds window.</p>
                  {stats.nextGames?.length > 0 && (
                    <>
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600">Next Scheduled Games</p>
                      <div className="space-y-2">
                        {stats.nextGames.map((g, i) => {
                          const d = new Date(g.date).toLocaleDateString("en-US", {
                            weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                          });
                          return (
                            <div key={i} className="flex items-center justify-between rounded-lg border border-white/[0.04] bg-white/[0.02] px-4 py-2.5 text-sm">
                              <span className="text-slate-300">
                                <span className="text-slate-500">{g.awayAbbr || g.away.split(" ").pop()}</span>
                                <span className="mx-2 text-slate-700">@</span>
                                <span className="font-semibold">{g.homeAbbr || g.home.split(" ").pop()}</span>
                              </span>
                              <span className="text-xs text-slate-600">{d}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                previewGames.map((g) => (
                  <GamePreviewCard key={g.id} game={g} standings={stats.standings} league={league} />
                ))
              )}
            </div>
          )}

          {activeTab === "standings" && <StandingsTable standings={stats.standings} />}

          {activeTab === "injuries" && (
            <InjuryReport injuries={stats.injuries ?? []} standings={stats.standings} />
          )}

          {activeTab === "insights" && (
            <InsightsPanel
              insights={stats.insights ?? []}
              pitcherMatchups={stats.pitcherMatchups}
              specialTeams={stats.specialTeams}
              league={league}
            />
          )}

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
