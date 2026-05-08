"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, BarChart3, Shield, Swords } from "lucide-react";
import type { TeamStats, TeamInjuryReport, InjuredPlayer } from "@/lib/sportradar";
import type { GameCard } from "@/lib/data";
import { matchTeam } from "@/lib/sportradar";

const LEAGUES = ["NFL", "NBA", "NHL", "MLB"] as const;
type League = (typeof LEAGUES)[number];

const SCORE_LABEL: Record<League, { for: string; against: string }> = {
  NFL: { for: "Pts/G", against: "Opp/G" },
  NBA: { for: "Pts/G", against: "Opp/G" },
  NHL: { for: "GF/G", against: "GA/G" },
  MLB: { for: "R/G", against: "RA/G" },
};

const STATUS_STYLE: Record<InjuredPlayer["status"], string> = {
  out: "bg-red-500/15 text-red-400 border-red-500/20",
  doubtful: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  questionable: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  probable: "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

interface StatsPayload {
  league: League;
  standings: TeamStats[];
  injuries: TeamInjuryReport[];
  hasData: boolean;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-white/[0.03] ${className}`} />;
}

function RecordBadge({ team }: { team: TeamStats }) {
  const record =
    team.ties !== undefined
      ? `${team.wins}-${team.losses}-${team.ties}`
      : team.otLosses !== undefined
        ? `${team.wins}-${team.losses}-${team.otLosses}`
        : `${team.wins}-${team.losses}`;
  return (
    <span className="font-mono text-sm font-semibold text-white">{record}</span>
  );
}

function WinPctBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-white/[0.05]">
        <div
          className="h-1.5 rounded-full bg-orange-500"
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
      <span className="text-xs text-slate-400">{Math.round(pct * 100)}%</span>
    </div>
  );
}

function TeamCard({
  team,
  injuryReport,
  label,
  league,
}: {
  team: TeamStats;
  injuryReport?: TeamInjuryReport;
  label: "Home" | "Away";
  league: League;
}) {
  const labels = SCORE_LABEL[league];
  const keyInjuries = (injuryReport?.players ?? []).filter(
    (p) => p.status === "out" || p.status === "doubtful",
  );

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
            {label} · {team.conference}{team.division ? ` ${team.division}` : ""}
          </div>
          <div className="mt-0.5 text-lg font-bold leading-tight">{team.name}</div>
          <RecordBadge team={team} />
        </div>
        <div className="text-right">
          <WinPctBar pct={team.winPct} />
          <div className="mt-1 text-[11px] text-slate-600">Win %</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
          <div className="text-[11px] text-slate-600">{labels.for}</div>
          <div className="mt-0.5 text-xl font-bold text-emerald-400">
            {team.pointsFor.toFixed(1)}
          </div>
        </div>
        <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3">
          <div className="text-[11px] text-slate-600">{labels.against}</div>
          <div className="mt-0.5 text-xl font-bold text-red-400">
            {team.pointsAgainst.toFixed(1)}
          </div>
        </div>
      </div>

      {keyInjuries.length > 0 && (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            <AlertTriangle className="h-3 w-3" />
            Key Injuries
          </div>
          <div className="space-y-1">
            {keyInjuries.slice(0, 4).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-slate-400">
                  {p.position && <span className="mr-1 text-slate-600">{p.position}</span>}
                  {p.name}
                </span>
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLE[p.status]}`}
                >
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GameMatchup({
  game,
  standings,
  injuries,
  league,
}: {
  game: GameCard;
  standings: TeamStats[];
  injuries: TeamInjuryReport[];
  league: League;
}) {
  const homeStats = matchTeam(game.homeTeam, standings);
  const awayStats = matchTeam(game.awayTeam, standings);
  const homeInjuries = injuries.find((r) =>
    r.teamName.toLowerCase().includes(game.homeTeam.split(" ").pop()!.toLowerCase()),
  );
  const awayInjuries = injuries.find((r) =>
    r.teamName.toLowerCase().includes(game.awayTeam.split(" ").pop()!.toLowerCase()),
  );

  if (!homeStats && !awayStats) return null;

  const gameTime = new Date(game.startTime).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Swords className="h-3.5 w-3.5 text-orange-500" />
          <span className="text-xs font-semibold text-slate-400">
            {game.awayTeam.split(" ").pop()} @ {game.homeTeam.split(" ").pop()}
          </span>
        </div>
        <span className="text-[11px] text-slate-600">{gameTime}</span>
      </div>

      <div className="flex gap-6">
        {awayStats && (
          <TeamCard
            team={awayStats}
            injuryReport={awayInjuries}
            label="Away"
            league={league}
          />
        )}
        {awayStats && homeStats && (
          <div className="flex flex-col items-center justify-center gap-1 text-slate-700">
            <div className="h-full w-px bg-white/[0.05]" />
            <span className="text-xs font-bold">VS</span>
            <div className="h-full w-px bg-white/[0.05]" />
          </div>
        )}
        {homeStats && (
          <TeamCard
            team={homeStats}
            injuryReport={homeInjuries}
            label="Home"
            league={league}
          />
        )}
      </div>
    </div>
  );
}

function StandingsTable({ teams, league }: { teams: TeamStats[]; league: League }) {
  const labels = SCORE_LABEL[league];
  const grouped = teams.reduce<Record<string, TeamStats[]>>((acc, t) => {
    const key = t.division ? `${t.conference} ${t.division}` : (t.conference ?? "");
    (acc[key] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([group, groupTeams]) => (
        <div key={group}>
          {group && (
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
              {group}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.05] text-[11px] uppercase tracking-wider text-slate-600">
                  <th className="pb-2 text-left font-medium">Team</th>
                  <th className="pb-2 text-center font-medium">W</th>
                  <th className="pb-2 text-center font-medium">L</th>
                  <th className="pb-2 text-center font-medium">Win%</th>
                  <th className="pb-2 text-center font-medium">{labels.for}</th>
                  <th className="pb-2 text-center font-medium">{labels.against}</th>
                </tr>
              </thead>
              <tbody>
                {groupTeams
                  .sort((a, b) => b.winPct - a.winPct)
                  .map((t) => (
                    <tr key={t.id} className="border-b border-white/[0.03]">
                      <td className="py-2 font-medium">
                        <span className="mr-2 text-[11px] text-slate-600">{t.alias}</span>
                        <span className="text-slate-300">{t.name}</span>
                      </td>
                      <td className="py-2 text-center text-slate-300">{t.wins}</td>
                      <td className="py-2 text-center text-slate-300">{t.losses}</td>
                      <td className="py-2 text-center text-orange-400">
                        {(t.winPct * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 text-center text-emerald-400">
                        {t.pointsFor.toFixed(1)}
                      </td>
                      <td className="py-2 text-center text-red-400">
                        {t.pointsAgainst.toFixed(1)}
                      </td>
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

export default function StatsPage() {
  const [league, setLeague] = useState<League>("NFL");
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [games, setGames] = useState<GameCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"preview" | "standings" | "injuries">("preview");

  useEffect(() => {
    setLoading(true);
    setStats(null);
    Promise.all([
      fetch(`/api/stats?league=${league}`).then((r) => r.json()),
      fetch("/api/games").then((r) => r.json()),
    ])
      .then(([statsData, gamesData]) => {
        setStats(statsData);
        const leagueGames = (gamesData.games ?? []).filter(
          (g: GameCard) => g.league.startsWith(league),
        );
        setGames(leagueGames);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [league]);

  const matchupGames = games.filter((g) => {
    if (!stats?.standings.length) return false;
    return (
      matchTeam(g.homeTeam, stats.standings) ||
      matchTeam(g.awayTeam, stats.standings)
    );
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Statistics</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Advanced team stats and injury reports
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[11px] font-semibold text-slate-500">
          <Activity className="h-3 w-3 text-orange-500" />
          Powered by SportRadar
        </div>
      </div>

      {/* League filter */}
      <div className="mb-6 flex gap-1.5">
        {LEAGUES.map((l) => (
          <button
            key={l}
            onClick={() => setLeague(l)}
            className={`rounded-lg border px-4 py-1.5 text-xs font-semibold transition-colors ${
              league === l
                ? "border-orange-500/40 bg-orange-500/15 text-orange-400"
                : "border-white/[0.06] bg-white/[0.02] text-slate-500 hover:text-slate-300"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-4 border-b border-white/[0.05]">
        {(["preview", "standings", "injuries"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`-mb-px pb-3 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? "border-b-2 border-orange-500 text-orange-400"
                : "text-slate-600 hover:text-slate-400"
            }`}
          >
            {tab === "preview" ? "Game Previews" : tab === "standings" ? "Standings" : "Injury Report"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : !stats?.hasData ? (
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-10 text-center">
          <BarChart3 className="mx-auto mb-3 h-8 w-8 text-slate-700" />
          <p className="text-sm text-slate-500">
            No SportRadar data available for {league}.
          </p>
          <p className="mt-1 text-xs text-slate-700">
            Confirm <code className="text-slate-600">SPORTRADAR_API_KEY</code> is set and {league} is in your trial package.
          </p>
        </div>
      ) : (
        <>
          {activeTab === "preview" && (
            <div className="space-y-4">
              {matchupGames.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No upcoming {league} games found — stats are available in the Standings tab.
                </p>
              ) : (
                matchupGames.map((g) => (
                  <GameMatchup
                    key={g.id}
                    game={g}
                    standings={stats.standings}
                    injuries={stats.injuries}
                    league={league}
                  />
                ))
              )}
            </div>
          )}

          {activeTab === "standings" && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
              <StandingsTable teams={stats.standings} league={league} />
            </div>
          )}

          {activeTab === "injuries" && (
            <div className="space-y-4">
              {stats.injuries.length === 0 ? (
                <p className="text-sm text-slate-500">No injuries reported for {league}.</p>
              ) : (
                stats.injuries
                  .filter((r) => r.players.some((p) => p.status === "out" || p.status === "doubtful"))
                  .sort((a, b) => {
                    const aOut = a.players.filter((p) => p.status === "out").length;
                    const bOut = b.players.filter((p) => p.status === "out").length;
                    return bOut - aOut;
                  })
                  .map((report) => (
                    <div key={report.teamId} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Shield className="h-3.5 w-3.5 text-slate-600" />
                        <span className="text-sm font-semibold">{report.teamName}</span>
                        <span className="text-[11px] text-slate-600">
                          {report.players.filter((p) => p.status === "out").length} out,{" "}
                          {report.players.filter((p) => p.status === "doubtful").length} doubtful
                        </span>
                      </div>
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        {report.players
                          .sort((a, b) => b.impactScore - a.impactScore)
                          .map((p) => (
                            <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.04] bg-white/[0.01] px-3 py-2">
                              <div>
                                <div className="text-xs font-medium text-slate-300">
                                  {p.position && (
                                    <span className="mr-1.5 text-slate-600">{p.position}</span>
                                  )}
                                  {p.name}
                                </div>
                                {p.description && (
                                  <div className="text-[11px] text-slate-600">{p.description}</div>
                                )}
                              </div>
                              <span
                                className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLE[p.status]}`}
                              >
                                {p.status}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
