"use client";

import { useEffect, useState } from "react";
import { BarChart3, Clock, Flame, Target, TrendingUp, Layers } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { GameCardView } from "@/components/game-card";
import { BetActions } from "@/components/bet-actions";
import { SearchBar } from "@/components/search-bar";
import { accuracySeries, featureImportance } from "@/lib/data";
import type { BetRecommendation, GameCard } from "@/lib/data";
import type { PolymarketMarket } from "@/lib/polymarket";

const BET_TYPE_STYLE: Record<BetRecommendation["betType"], string> = {
  Spread: "border-blue-500/20 bg-blue-500/10 text-blue-300",
  Moneyline: "border-violet-500/20 bg-violet-500/10 text-violet-300",
  Over: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  Under: "border-red-500/20 bg-red-500/10 text-red-300",
};

const LEAGUE_COLORS: Record<string, string> = {
  NBA: "#3b82f6",
  NFL: "#ef4444",
  NHL: "#06b6d4",
  MLB: "#22c55e",
  MLS: "#10b981",
  EPL: "#a855f7",
  NCAAB: "#6366f1",
  NCAAF: "#f97316",
  CFB: "#f97316",
  CFL: "#f59e0b",
  WNBA: "#ec4899",
};

function leagueColor(league: string): string {
  return LEAGUE_COLORS[league.toUpperCase()] ?? "#64748b";
}

function BetCard({ bet, pmMarket }: { bet: BetRecommendation; pmMarket?: PolymarketMarket }) {
  const edgePct = Math.round(bet.edge * 100);
  const confPct = Math.round(bet.confidence * 100);
  return (
    <div
      className={`relative rounded-xl border p-5 ${
        bet.hot
          ? "border-orange-500/40 bg-orange-500/[0.08] shadow-lg shadow-orange-500/10"
          : "border-orange-500/20 bg-orange-500/[0.04]"
      }`}
    >
      {bet.hot && (
        <div className="absolute right-4 top-4 flex items-center gap-1 rounded-md bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-400">
          <Flame className="h-3 w-3" />
          Hot
        </div>
      )}
      <div className="flex items-center gap-2">
        <span
          className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
          style={{ color: leagueColor(bet.league) }}
        >
          {bet.league}
        </span>
        <span
          className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${BET_TYPE_STYLE[bet.betType]}`}
        >
          {bet.betType}
        </span>
      </div>
      <div className="mt-2 text-xs text-slate-500">{bet.matchup}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-white">{bet.pick}</span>
        <span className="text-sm font-medium text-slate-500">{bet.odds}</span>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1">
          <div className="mb-1 flex justify-between text-[11px]">
            <span className="text-slate-600">Edge</span>
            <span className={edgePct >= 8 ? "text-orange-400" : "text-amber-500"}>
              {edgePct}%
            </span>
          </div>
          <div className="h-1 rounded-full bg-white/5">
            <div
              className={`h-1 rounded-full ${edgePct >= 8 ? "bg-orange-500" : "bg-amber-500"}`}
              style={{ width: `${Math.min(edgePct * 7, 100)}%` }}
            />
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-slate-600">Conf</div>
          <div className="text-sm font-semibold text-slate-200">{confPct}%</div>
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-slate-600">{bet.reasoning}</p>
      <div className="mt-3 border-t border-white/[0.05] pt-2.5">
        <BetActions bet={bet} pmMarket={pmMarket} />
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
        {icon}
      </div>
      <div>
        {loading ? (
          <div className="mb-1 h-5 w-16 animate-pulse rounded bg-white/[0.06]" />
        ) : (
          <div className="text-lg font-bold leading-tight">{value}</div>
        )}
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  );
}

const tooltipStyle = {
  contentStyle: {
    background: "#07101e",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 8,
    fontSize: 12,
  },
};

function matchesQuery(query: string, ...fields: string[]): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return fields.some((f) => f.toLowerCase().includes(q));
}

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function offsetLocalDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}

function gameLocalDate(isoString: string) {
  return localDateStr(new Date(isoString));
}

function formatTabLabel(dateStr: string, today: string, tomorrow: string) {
  if (!dateStr) return "Today";
  const [y, m, day] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, day);
  const short = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (dateStr === today) return `Today, ${short}`;
  if (dateStr === tomorrow) return `Tomorrow, ${short}`;
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

interface ModelStatsPayload {
  models: Record<string, { metrics: Record<string, number>; is_real: boolean }>;
  leagues: string[];
}

function computeMetrics(data: ModelStatsPayload | null) {
  if (!data) return { leagueCount: "—", calibration: "—", roi: "—" };
  const entries = Object.values(data.models);
  if (entries.length === 0) return { leagueCount: "—", calibration: "—", roi: "—" };
  const real = entries.filter((e) => e.is_real);
  const leagueCount = real.length > 0 ? `${real.length}` : `${entries.length}`;
  const calValues = entries.map((e) => e.metrics?.calibration_error ?? 0).filter((v) => v > 0);
  const roiValues = entries.map((e) => e.metrics?.roi_against_closing_line ?? 0);
  const avgCal = calValues.length ? calValues.reduce((a, b) => a + b, 0) / calValues.length : 0;
  const avgRoi = roiValues.length ? roiValues.reduce((a, b) => a + b, 0) / roiValues.length : 0;
  return {
    leagueCount,
    calibration: calValues.length ? `${(avgCal * 100).toFixed(1)}% ECE` : "—",
    roi: roiValues.length ? `${avgRoi >= 0 ? "+" : ""}${(avgRoi * 100).toFixed(1)}%` : "—",
  };
}

// ─── Parlay helpers ──────────────────────────────────────────────────────────

function americanToDecimal(odds: string): number {
  const n = parseFloat(odds.replace("+", ""));
  if (n > 0) return 1 + n / 100;
  if (n < 0) return 1 + 100 / Math.abs(n);
  return 1;
}

function decimalToAmerican(d: number): string {
  if (d >= 2) return `+${Math.round((d - 1) * 100)}`;
  return `-${Math.round(100 / (d - 1))}`;
}

function buildParlays(picks: BetRecommendation[]) {
  if (picks.length < 2) return [];
  const sorted = [...picks].sort((a, b) => b.edge * b.confidence - a.edge * a.confidence);
  const top = sorted.slice(0, Math.min(4, picks.length));

  return [2, 3]
    .filter((n) => top.length >= n)
    .map((n) => {
      const legs = top.slice(0, n);
      const decimal = legs.reduce((acc, p) => acc * americanToDecimal(p.odds), 1);
      const winPct = legs.reduce((acc, p) => acc * p.confidence, 1);
      return { legs, odds: decimalToAmerican(decimal), winPct, label: `${n}-Leg` };
    });
}

// Number of picks shown in full to unauthenticated or non-pro visitors
const FREE_PREVIEW_COUNT = 2;

export default function HomePage() {
  const [allGames, setAllGames] = useState<GameCard[]>([]);
  const [allPicks, setAllPicks] = useState<BetRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [gamesReason, setGamesReason] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [modelStats, setModelStats] = useState<ModelStatsPayload | null>(null);
  const [modelStatsLoading, setModelStatsLoading] = useState(true);
  // Initialized empty — set client-side only to avoid SSR/client timezone hydration mismatch
  const [selectedDate, setSelectedDate] = useState("");
  const [dateOptions, setDateOptions] = useState<string[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const [polymarketMap, setPolymarketMap] = useState<Map<string, PolymarketMarket>>(new Map());
  const [userPlan, setUserPlan] = useState<string | null>(null); // null = not yet loaded
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setSelectedDate(localDateStr());
    setDateOptions(Array.from({ length: 7 }, (_, i) => offsetLocalDate(i)));
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.user) {
          setIsAuthenticated(true);
          setUserPlan(data.user.plan ?? "free");
        } else {
          setIsAuthenticated(false);
          setUserPlan("free");
        }
      })
      .catch(() => { setIsAuthenticated(false); setUserPlan("free"); });
  }, []);

  useEffect(() => {
    fetch("/api/games")
      .then((r) => r.json())
      .then((data) => {
        if (data.games?.length) setAllGames(data.games);
        if (data.picks?.length) setAllPicks(data.picks);
        if (data.reason) setGamesReason(data.reason);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout>;
    const load = (isRetry = false) => {
      fetch("/api/model-stats")
        .then((r) => r.json())
        .then((data: ModelStatsPayload) => {
          if (!isRetry && (!data.leagues?.length && !Object.keys(data.models ?? {}).length)) {
            // Empty response — prediction service may be cold-starting. Retry once after 12s.
            retryTimer = setTimeout(() => load(true), 12000);
            return;
          }
          setModelStats(data);
        })
        .catch(() => {})
        .finally(() => { if (isRetry) setModelStatsLoading(false); });
      if (isRetry) return;
      // After first attempt, stop the skeleton after 18s regardless
      retryTimer = setTimeout(() => setModelStatsLoading(false), 18000);
    };
    load();
    return () => clearTimeout(retryTimer);
  }, []);

  // Fetch Polymarket markets for each unique team in picks (skip Over/Under — no team name)
  useEffect(() => {
    if (!allPicks.length) return;
    const uniqueTeams = new Set<string>();
    for (const p of allPicks) {
      if (p.betType === "Over" || p.betType === "Under") continue;
      const teamPart = p.pick.split(/\s+/)[0]; // split on whitespace only
      if (teamPart && teamPart.length >= 4) uniqueTeams.add(`${teamPart}|${p.league}`);
    }
    const fetches = [...uniqueTeams].map(async (key) => {
      const [team, sport] = key.split("|");
      const res = await fetch(`/api/polymarket?team=${encodeURIComponent(team)}&sport=${encodeURIComponent(sport ?? "")}`).then((r) => r.json()).catch(() => ({ markets: [] }));
      return { key, markets: res.markets as PolymarketMarket[] };
    });
    Promise.all(fetches).then((results) => {
      const map = new Map<string, PolymarketMarket>();
      for (const { key, markets } of results) {
        const best = markets[0];
        if (best) map.set(key, best);
      }
      setPolymarketMap(map);
    });
  }, [allPicks]);

  const today = selectedDate;
  const tomorrow = dateOptions[1] ?? "";

  const games = allGames.filter((g) => {
    if (!selectedDate) return true;
    return gameLocalDate(g.startTime) === selectedDate && (!selectedLeague || g.league === selectedLeague);
  });

  const picks = allPicks.filter((p) =>
    !selectedLeague || p.league === selectedLeague.split(" ")[0],
  );

  const filteredGames = games.filter((g) =>
    matchesQuery(query, g.homeTeam, g.awayTeam, g.league),
  );
  const filteredPicks = picks.filter((p) =>
    matchesQuery(query, p.matchup, p.league, p.betType, p.pick),
  );

  const activeLeagues = [...new Set(allGames.map((g) => g.league))].sort();

  const { leagueCount, calibration, roi } = computeMetrics(modelStats);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric icon={<TrendingUp className="h-4 w-4" />} label="Leagues Covered" value={leagueCount} loading={modelStatsLoading} />
        <Metric icon={<Clock className="h-4 w-4" />} label="Ingestion" value="24/7" />
        <Metric icon={<Target className="h-4 w-4" />} label="Calibration" value={calibration} loading={modelStatsLoading} />
        <Metric icon={<BarChart3 className="h-4 w-4" />} label="Model ROI" value={roi} loading={modelStatsLoading} />
      </div>

      <div className="mb-8">
        <SearchBar value={query} onChange={setQuery} />
      </div>

      <section className="mb-10">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tight">
            {!selectedDate || selectedDate === today ? "Today's Edges" : `${formatTabLabel(selectedDate, today, tomorrow)} Edges`}
          </h2>
          {!loading && filteredPicks.length > 0 && (
            <span className="rounded-md bg-orange-500/15 px-2 py-0.5 text-xs font-semibold text-orange-400">
              {filteredPicks.length} picks
            </span>
          )}
        </div>
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl border border-white/[0.05] bg-white/[0.02]" />
            ))}
          </div>
        ) : filteredPicks.length === 0 ? (
          <p className="text-sm text-slate-500">
            {allPicks.length === 0 ? "No edges detected right now. Check back soon." : "No picks match your search."}
          </p>
        ) : (() => {
          const isPro = userPlan === "pro" || userPlan === "admin";
          const previewOnly = !isPro;
          const visiblePicks = previewOnly ? filteredPicks.slice(0, FREE_PREVIEW_COUNT) : filteredPicks;
          const hiddenCount = filteredPicks.length - visiblePicks.length;
          return (
            <div className="relative">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {visiblePicks.map((bet) => {
                  const teamPart = bet.betType === "Over" || bet.betType === "Under"
                    ? "" : bet.pick.split(/\s+/)[0];
                  const pmMarket = teamPart ? polymarketMap.get(`${teamPart}|${bet.league}`) : undefined;
                  return <BetCard key={bet.id} bet={bet} pmMarket={pmMarket} />;
                })}
                {/* Blurred placeholder cards for hidden picks */}
                {previewOnly && hiddenCount > 0 && Array.from({ length: Math.min(hiddenCount, 4) }).map((_, i) => (
                  <div key={`blur-${i}`} className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02]">
                    <div className="pointer-events-none select-none blur-sm p-5 opacity-40">
                      <div className="h-3 w-16 rounded bg-white/10 mb-3" />
                      <div className="h-6 w-32 rounded bg-white/10 mb-2" />
                      <div className="h-2 w-24 rounded bg-white/10" />
                    </div>
                  </div>
                ))}
              </div>
              {/* Upgrade CTA overlay when picks are hidden */}
              {previewOnly && hiddenCount > 0 && (
                <div className="mt-4 rounded-xl border border-orange-500/20 bg-orange-500/[0.06] p-5 text-center">
                  <p className="text-sm font-semibold text-white">
                    {hiddenCount} more edge{hiddenCount !== 1 ? "s" : ""} available today
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Sign up for Pro to unlock all picks, parlays, and bet tracking.
                  </p>
                  <div className="mt-3 flex justify-center gap-3">
                    {!isAuthenticated && (
                      <a href="/login" className="rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15">
                        Sign in
                      </a>
                    )}
                    <a href="/upgrade" className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-400">
                      Upgrade to Pro →
                    </a>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </section>

      {/* Parlay Suggestions */}
      {!loading && (() => {
        const parlays = buildParlays(filteredPicks);
        if (!parlays.length) return null;
        return (
          <section className="mb-10">
            <div className="mb-4 flex items-center gap-3">
              <Layers className="h-5 w-5 text-violet-400" />
              <h2 className="text-xl font-bold tracking-tight">Parlay Suggestions</h2>
              <span className="rounded-md bg-violet-500/15 px-2 py-0.5 text-xs font-semibold text-violet-400">
                AI-combined
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {parlays.map((p) => (
                <div
                  key={p.label}
                  className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-5"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-bold text-violet-300">{p.label} Parlay</span>
                    <span className="text-xl font-black text-white">{p.odds}</span>
                  </div>
                  <div className="space-y-1.5">
                    {p.legs.map((leg, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="rounded bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                          {leg.league}
                        </span>
                        <span className="flex-1 truncate text-slate-300">{leg.pick}</span>
                        <span className="shrink-0 text-slate-600">{leg.odds}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-white/[0.05] pt-2.5 text-xs">
                    <span className="text-slate-600">Combined win prob.</span>
                    <span className="font-semibold text-slate-400">
                      {(p.winPct * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Upcoming Games</h2>
          <span className="text-xs uppercase tracking-[0.25em] text-slate-600">
            {loading ? "Loading…" : allGames.length ? "Live data" : "No games"}
          </span>
        </div>

        {/* Date tabs */}
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          {dateOptions.map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDate(d)}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedDate === d
                  ? "border-orange-500/40 bg-orange-500/15 text-orange-400"
                  : "border-white/[0.06] bg-white/[0.02] text-slate-500 hover:border-white/[0.12] hover:text-slate-300"
              }`}
            >
              {formatTabLabel(d, today, tomorrow)}
            </button>
          ))}
        </div>

        {/* League filter chips — only show leagues with data */}
        {!loading && activeLeagues.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedLeague(null)}
              className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                selectedLeague === null
                  ? "border-slate-500/40 bg-slate-500/15 text-slate-200"
                  : "border-white/[0.06] bg-transparent text-slate-600 hover:text-slate-400"
              }`}
            >
              All
            </button>
            {activeLeagues.map((league) => (
              <button
                key={league}
                onClick={() => setSelectedLeague(league === selectedLeague ? null : league)}
                className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  selectedLeague === league
                    ? "border-orange-500/40 bg-orange-500/15 text-orange-400"
                    : "border-white/[0.06] bg-transparent text-slate-600 hover:text-slate-400"
                }`}
              >
                {league}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl border border-white/[0.05] bg-white/[0.02]" />
            ))}
          </div>
        ) : filteredGames.length === 0 ? (
          <p className="text-sm text-slate-500">
            {allGames.length === 0
              ? gamesReason === "api_error_or_quota"
                ? "Odds API returned no data — quota may be exhausted or the API key is invalid. Check Render logs for details."
                : "No upcoming games found. Add an ODDS_API_KEY to enable live data."
              : "No games on this date" + (selectedLeague ? ` for ${selectedLeague}` : "") + "."}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {filteredGames.map((game) => (
              <GameCardView key={game.id} game={game} />
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-6">
          <h3 className="text-base font-semibold">Feature Importance</h3>
          <p className="mb-5 mt-0.5 text-xs text-slate-600">
            SHAP-averaged across all active leagues
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={featureImportance} layout="vertical">
                <CartesianGrid stroke="rgba(148,163,184,0.05)" horizontal={false} />
                <XAxis type="number" stroke="#334155" tick={{ fontSize: 11 }} />
                <YAxis
                  dataKey="feature"
                  type="category"
                  stroke="#334155"
                  width={140}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="value" fill="#f97316" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-6">
          <h3 className="text-base font-semibold">Model Health</h3>
          <p className="mb-5 mt-0.5 text-xs text-slate-600">Rolling 5-week accuracy and ROI</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={accuracySeries}>
                <CartesianGrid stroke="rgba(148,163,184,0.05)" vertical={false} />
                <XAxis dataKey="week" stroke="#334155" tick={{ fontSize: 11 }} />
                <YAxis stroke="#334155" domain={[0.5, 0.7]} tick={{ fontSize: 11 }} />
                <Tooltip {...tooltipStyle} />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="roi"
                  stroke="#fbbf24"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </main>
  );
}
