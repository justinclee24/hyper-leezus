"use client";

import { useBets } from "@/hooks/useBets";
import type { TrackedBet } from "@/lib/data";
import { Info } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const RESULT_STYLES: Record<TrackedBet["result"], string> = {
  pending: "text-slate-400 border-slate-500/20 bg-slate-500/10",
  win: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
  loss: "text-red-400 border-red-500/20 bg-red-500/10",
  push: "text-slate-400 border-white/10 bg-white/5",
};

const tooltipStyle = {
  contentStyle: {
    background: "#07101e",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 8,
    fontSize: 12,
  },
};

function betPnl(bet: TrackedBet): number {
  if (bet.result === "win") {
    const odds = parseFloat(bet.odds.replace("+", ""));
    return odds > 0 ? bet.stake * (odds / 100) : bet.stake * (100 / Math.abs(odds));
  }
  if (bet.result === "loss") return -bet.stake;
  return 0;
}

export default function AnalyticsPage() {
  const { bets, updateResult, removeBet, pnl, loaded } = useBets();

  if (!loaded) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="h-32 animate-pulse rounded-xl bg-white/[0.02]" />
      </main>
    );
  }

  const wins = bets.filter((b) => b.result === "win").length;
  const losses = bets.filter((b) => b.result === "loss").length;
  const pending = bets.filter((b) => b.result === "pending").length;
  const settled = wins + losses;
  const winRate = settled > 0 ? Math.round((wins / settled) * 100) : null;

  // Cumulative P&L series
  const sorted = [...bets].sort(
    (a, b) => new Date(a.trackedAt).getTime() - new Date(b.trackedAt).getTime()
  );
  let running = 0;
  const pnlSeries = sorted.map((bet, i) => {
    running += betPnl(bet);
    return {
      n: i + 1,
      label: new Date(bet.trackedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      pnl: parseFloat(running.toFixed(2)),
    };
  });

  // By bet type
  const typeMap: Record<string, { wins: number; losses: number; pushes: number; pending: number }> = {};
  bets.forEach((b) => {
    if (!typeMap[b.betType]) typeMap[b.betType] = { wins: 0, losses: 0, pushes: 0, pending: 0 };
    if (b.result === "win") typeMap[b.betType].wins++;
    else if (b.result === "loss") typeMap[b.betType].losses++;
    else if (b.result === "push") typeMap[b.betType].pushes++;
    else typeMap[b.betType].pending++;
  });
  const typeData = Object.entries(typeMap).map(([type, v]) => ({
    type,
    Wins: v.wins,
    Losses: v.losses,
    winRate: v.wins + v.losses > 0 ? Math.round((v.wins / (v.wins + v.losses)) * 100) : 0,
  }));

  // By league
  const leagueMap: Record<string, { wins: number; losses: number }> = {};
  bets.forEach((b) => {
    if (!leagueMap[b.league]) leagueMap[b.league] = { wins: 0, losses: 0 };
    if (b.result === "win") leagueMap[b.league].wins++;
    else if (b.result === "loss") leagueMap[b.league].losses++;
  });
  const leagueData = Object.entries(leagueMap)
    .map(([league, v]) => ({
      league: league.toUpperCase(),
      Wins: v.wins,
      Losses: v.losses,
      winRate: v.wins + v.losses > 0 ? Math.round((v.wins / (v.wins + v.losses)) * 100) : 0,
    }))
    .sort((a, b) => b.Wins + b.Losses - (a.Wins + a.Losses));

  // Edge buckets
  const edgeBuckets: Record<string, number> = { "0–3%": 0, "3–6%": 0, "6–10%": 0, "10%+": 0 };
  bets.forEach((b) => {
    const e = b.edge * 100;
    if (e < 3) edgeBuckets["0–3%"]++;
    else if (e < 6) edgeBuckets["3–6%"]++;
    else if (e < 10) edgeBuckets["6–10%"]++;
    else edgeBuckets["10%+"]++;
  });
  const edgeData = Object.entries(edgeBuckets).map(([bucket, count]) => ({ bucket, count }));

  const hasBets = bets.length > 0;
  const hasSettled = settled > 0;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Analytics</h1>

      {/* Disclaimer */}
      <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-white/[0.04] bg-white/[0.02] px-4 py-3">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" />
        <p className="text-xs leading-relaxed text-slate-600">
          Picks tracked here are for analytical purposes only — no real bets are placed through this platform.
          To wager, use a licensed sportsbook such as DraftKings, FanDuel, BetMGM, or Caesars Sportsbook.
          Gambling involves real financial risk; please bet responsibly and within your means.
        </p>
      </div>

      {/* Summary stats */}
      <div className="mb-8 grid gap-3 sm:grid-cols-5">
        {[
          { label: "Total tracked", value: bets.length.toString() },
          { label: "Pending", value: pending.toString() },
          { label: "Record", value: `${wins}–${losses}` },
          {
            label: "Win rate",
            value: winRate != null ? `${winRate}%` : "—",
            color: winRate != null ? (winRate >= 55 ? "text-emerald-400" : winRate >= 50 ? "text-amber-400" : "text-red-400") : "",
          },
          {
            label: "P&L (units)",
            value: `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}`,
            color: pnl >= 0 ? "text-emerald-400" : "text-red-400",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4">
            <div className="text-xs uppercase tracking-wider text-slate-500">{s.label}</div>
            <div className={`mt-1 text-2xl font-bold ${s.color ?? ""}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {!hasBets ? (
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-14 text-center">
          <p className="text-slate-500">No tracked picks yet.</p>
          <p className="mt-1 text-xs text-slate-600">
            Click <span className="text-orange-400">Track</span> on any pick from the dashboard to start building your record.
          </p>
        </div>
      ) : (
        <>
          {/* Charts row 1 — P&L timeline */}
          <div className="mb-6 rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
            <h2 className="mb-1 text-sm font-semibold">Cumulative P&L</h2>
            <p className="mb-4 text-xs text-slate-600">Running profit/loss in units as picks settle</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pnlSeries}>
                  <CartesianGrid stroke="rgba(148,163,184,0.05)" vertical={false} />
                  <XAxis dataKey="label" stroke="#334155" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis stroke="#334155" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}`} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />
                  <Tooltip
                    {...tooltipStyle}
                    formatter={(v: number) => [`${v > 0 ? "+" : ""}${v.toFixed(2)} units`, "P&L"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="pnl"
                    stroke={pnl >= 0 ? "#10b981" : "#f87171"}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Charts row 2 */}
          <div className="mb-6 grid gap-6 lg:grid-cols-3">
            {/* By bet type */}
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
              <h2 className="mb-1 text-sm font-semibold">Results by Bet Type</h2>
              <p className="mb-4 text-xs text-slate-600">Settled bets only</p>
              <div className="h-40">
                {hasSettled ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={typeData} barGap={2}>
                      <CartesianGrid stroke="rgba(148,163,184,0.05)" vertical={false} />
                      <XAxis dataKey="type" stroke="#334155" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#334155" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip {...tooltipStyle} />
                      <Bar dataKey="Wins" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Losses" fill="#f87171" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-600">No settled bets yet</div>
                )}
              </div>
            </div>

            {/* By league */}
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
              <h2 className="mb-1 text-sm font-semibold">Results by League</h2>
              <p className="mb-4 text-xs text-slate-600">Settled bets only</p>
              <div className="h-40">
                {hasSettled && leagueData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={leagueData} barGap={2}>
                      <CartesianGrid stroke="rgba(148,163,184,0.05)" vertical={false} />
                      <XAxis dataKey="league" stroke="#334155" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#334155" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip {...tooltipStyle} />
                      <Bar dataKey="Wins" fill="#f97316" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Losses" fill="#334155" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-slate-600">No settled bets yet</div>
                )}
              </div>
            </div>

            {/* Edge distribution */}
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
              <h2 className="mb-1 text-sm font-semibold">Edge Distribution</h2>
              <p className="mb-4 text-xs text-slate-600">How aggressively you&apos;re betting</p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={edgeData}>
                    <CartesianGrid stroke="rgba(148,163,184,0.05)" vertical={false} />
                    <XAxis dataKey="bucket" stroke="#334155" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#334155" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip {...tooltipStyle} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {edgeData.map((entry, i) => (
                        <Cell
                          key={entry.bucket}
                          fill={i === 0 ? "#334155" : i === 1 ? "#f97316" : i === 2 ? "#fb923c" : "#fdba74"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Win rate by type table */}
          {hasSettled && (
            <div className="mb-6 rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
              <h2 className="mb-4 text-sm font-semibold">Performance Breakdown</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.05]">
                      {["Type", "Bets", "W", "L", "Win Rate", "ROI"].map((h) => (
                        <th key={h} className="pb-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {typeData.map((row) => {
                      const typeBets = bets.filter((b) => b.betType === row.type);
                      const typeSettled = row.Wins + row.Losses;
                      const typeRoi = typeSettled > 0
                        ? typeBets.reduce((sum, b) => sum + betPnl(b), 0) / (typeBets.filter(b => b.result !== "pending" && b.result !== "push").length || 1)
                        : 0;
                      return (
                        <tr key={row.type} className="border-b border-white/[0.04]">
                          <td className="py-2.5 font-medium text-slate-300">{row.type}</td>
                          <td className="py-2.5 text-slate-400">{typeBets.length}</td>
                          <td className="py-2.5 text-emerald-400">{row.Wins}</td>
                          <td className="py-2.5 text-red-400">{row.Losses}</td>
                          <td className="py-2.5">
                            <span className={row.winRate >= 55 ? "font-semibold text-emerald-400" : row.winRate >= 50 ? "text-amber-400" : "text-red-400"}>
                              {typeSettled > 0 ? `${row.winRate}%` : "—"}
                            </span>
                          </td>
                          <td className="py-2.5">
                            <span className={typeRoi >= 0 ? "text-emerald-400" : "text-red-400"}>
                              {typeSettled > 0 ? `${typeRoi >= 0 ? "+" : ""}${typeRoi.toFixed(2)}u` : "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Picks list */}
          <div>
            <h2 className="mb-3 text-sm font-semibold text-slate-400 uppercase tracking-wider">All Picks</h2>
            <div className="space-y-2">
              {bets.map((bet) => (
                <div
                  key={bet.id}
                  className="flex items-center gap-4 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase text-slate-500">{bet.league}</span>
                      <span className="text-xs text-slate-600">{bet.matchup}</span>
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${RESULT_STYLES[bet.result]}`}>
                        {bet.result.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-baseline gap-2">
                      <span className="font-semibold">{bet.pick}</span>
                      <span className="text-sm text-slate-500">{bet.odds}</span>
                      <span className="text-xs text-slate-600">Edge {Math.round(bet.edge * 100)}%</span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-600">
                      {new Date(bet.trackedAt).toLocaleDateString()} · {bet.stake} unit{bet.stake !== 1 ? "s" : ""}
                    </div>
                  </div>

                  {bet.result === "pending" && (
                    <div className="flex shrink-0 gap-1.5">
                      <button onClick={() => updateResult(bet.id, "win")} className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20">W</button>
                      <button onClick={() => updateResult(bet.id, "loss")} className="rounded-md border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/20">L</button>
                      <button onClick={() => updateResult(bet.id, "push")} className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-400 hover:bg-white/10">P</button>
                    </div>
                  )}

                  <button onClick={() => removeBet(bet.id)} className="ml-1 shrink-0 text-slate-700 hover:text-slate-400" aria-label="Remove">×</button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
