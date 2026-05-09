"use client";

import { useEffect, useState } from "react";
import { Trophy, TrendingUp, Zap, ExternalLink } from "lucide-react";
import { ESPN_LEAGUES } from "@/lib/espn";
import type { FuturesPick } from "@/app/api/futures/route";
import type { PolymarketMarket } from "@/lib/polymarket";

type League = keyof typeof ESPN_LEAGUES;
const LEAGUES = Object.keys(ESPN_LEAGUES) as League[];

interface FuturesResponse {
  picks: FuturesPick[];
  isPlayoffs: boolean;
  leagueKey: string;
  simulations: number;
  bracketSize: number;
  activeSeriesCount: number;
  message?: string;
}

function Skeleton({ n = 8 }: { n?: number }) {
  return (
    <div className="space-y-2">
      {[...Array(n)].map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl border border-white/[0.05] bg-white/[0.02]" />
      ))}
    </div>
  );
}

export default function FuturesPage() {
  const [league, setLeague] = useState<League>("NBA");
  const [data, setData] = useState<FuturesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pmChampMap, setPmChampMap] = useState<Map<string, PolymarketMarket>>(new Map());

  useEffect(() => {
    setLoading(true);
    setData(null);
    setPmChampMap(new Map());
    fetch(`/api/futures?league=${league}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [league]);

  // After futures data loads, fetch Polymarket championship markets for top teams
  useEffect(() => {
    if (!data?.picks?.length) return;
    const topTeams = data.picks.filter((p) => !p.eliminated).slice(0, 8);
    Promise.all(
      topTeams.map((t) =>
        fetch(`/api/polymarket?team=${encodeURIComponent(t.teamName)}&sport=${encodeURIComponent(league)}`)
          .then((r) => r.json())
          .catch(() => ({ markets: [] }))
          .then((res) => ({ teamId: t.teamId, markets: (res.markets ?? []) as PolymarketMarket[] }))
      )
    ).then((results) => {
      const map = new Map<string, PolymarketMarket>();
      for (const { teamId, markets } of results) {
        const champ = markets.find((m) => m.isChampionship) ?? markets[0];
        if (champ) map.set(teamId, champ);
      }
      setPmChampMap(map);
    });
  }, [data, league]);

  const active = data?.picks.filter((p) => !p.eliminated) ?? [];
  const out = data?.picks.filter((p) => p.eliminated) ?? [];
  const topProb = active[0]?.champProb ?? 0;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Futures Predictions</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {data?.isPlayoffs
              ? "Championship odds from live playoff bracket · Monte Carlo simulation"
              : "Projected championship odds from current standings"}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[11px] font-semibold text-slate-500">
          <TrendingUp className="h-3 w-3 text-orange-500" />
          {data?.simulations ? `${data.simulations.toLocaleString()} simulations` : "Monte Carlo model"}
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

      {loading ? (
        <Skeleton />
      ) : !active.length ? (
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-10 text-center">
          <Trophy className="mx-auto mb-3 h-8 w-8 text-slate-700" />
          <p className="text-sm text-slate-500">{data?.message ?? `No futures data for ${league}.`}</p>
          <p className="mt-1 text-xs text-slate-700">This league may be in the off-season.</p>
        </div>
      ) : (
        <>
          {/* Playoffs banner */}
          {data?.isPlayoffs && (
            <div className="mb-5 flex items-center gap-3 rounded-xl border border-orange-500/20 bg-orange-500/[0.05] px-4 py-3">
              <Zap className="h-4 w-4 shrink-0 text-orange-400" />
              <div>
                <span className="text-xs font-bold text-orange-300">PLAYOFFS ACTIVE</span>
                <span className="ml-2 text-xs text-slate-500">
                  {data.activeSeriesCount} series in progress · odds update with live results
                </span>
              </div>
            </div>
          )}

          {/* Main odds table */}
          <div className="mb-4 overflow-hidden rounded-xl border border-white/[0.06]">
            <div className="border-b border-white/[0.05] px-4 py-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600">
                Championship Odds — {data?.isPlayoffs ? "Remaining playoff teams" : "Projected playoff field"}
              </span>
            </div>
            <div className="divide-y divide-white/[0.03]">
              {active.map((pick, i) => {
                const pct = (pick.champProb * 100).toFixed(1);
                const barW = topProb > 0 ? (pick.champProb / topProb) * 100 : 0;
                return (
                  <div
                    key={pick.teamId}
                    className={`flex items-center gap-3 px-4 py-3 ${i === 0 ? "bg-orange-500/[0.04]" : ""}`}
                  >
                    {/* Rank + team */}
                    <div className="w-5 shrink-0 text-center text-xs font-bold text-slate-700">
                      {i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {i === 0 && <Trophy className="h-3.5 w-3.5 text-orange-400" />}
                        <span className="text-sm font-semibold text-slate-200">{pick.teamName}</span>
                        <span className="text-[10px] text-slate-600">{pick.abbreviation}</span>
                        {pick.seriesRecord && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                              pick.seriesLeading
                                ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-red-500/10 text-red-400"
                            }`}
                          >
                            {pick.seriesRecord} series
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-3">
                        <span className="text-[11px] text-slate-600">
                          {pick.wins}–{pick.losses}
                        </span>
                        {pick.conference && (
                          <span className="text-[10px] text-slate-700">{pick.conference}</span>
                        )}
                      </div>
                    </div>

                    {/* Probability bar */}
                    <div className="hidden w-40 sm:block">
                      <div className="h-1.5 rounded-full bg-white/[0.05]">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            i === 0 ? "bg-orange-500" : i < 3 ? "bg-orange-500/50" : "bg-slate-600"
                          }`}
                          style={{ width: `${barW}%` }}
                        />
                      </div>
                    </div>

                    {/* Probability number */}
                    <div className="shrink-0 text-right">
                      <span
                        className={`text-sm font-bold ${
                          i === 0 ? "text-orange-400" : i < 3 ? "text-slate-300" : "text-slate-500"
                        }`}
                      >
                        {pct}%
                      </span>
                      {pmChampMap.get(pick.teamId) && (() => {
                        const pm = pmChampMap.get(pick.teamId)!;
                        return (
                          <a
                            href={pm.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={pm.question}
                            className="mt-0.5 flex items-center justify-end gap-0.5 text-[10px] text-purple-500 hover:text-purple-400"
                          >
                            {Math.round(pm.probability * 100)}% PM
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Eliminated teams */}
          {out.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-white/[0.04]">
              <div className="border-b border-white/[0.04] px-4 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">
                  Eliminated
                </span>
              </div>
              <div className="divide-y divide-white/[0.03] opacity-40">
                {out.map((pick) => (
                  <div key={pick.teamId} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 text-sm text-slate-500">
                      {pick.teamName}
                      <span className="ml-2 text-[10px] text-slate-700">
                        {pick.wins}–{pick.losses}
                      </span>
                    </div>
                    <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                      ELIM
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="mt-4 text-center text-xs text-slate-700">
            Probabilities estimated via {data?.simulations?.toLocaleString()} Monte Carlo bracket
            simulations weighted by current win rate.{" "}
            {data?.isPlayoffs
              ? "Live series scores are factored in."
              : `Assumes top-${data?.bracketSize ?? 16} seeding from current standings.`}
          </p>
        </>
      )}
    </main>
  );
}
