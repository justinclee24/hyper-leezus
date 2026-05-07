"use client";

import { useBets } from "@/hooks/useBets";
import type { TrackedBet } from "@/lib/data";

const RESULT_STYLES: Record<TrackedBet["result"], string> = {
  pending: "text-slate-400 border-slate-500/20 bg-slate-500/10",
  win: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
  loss: "text-red-400 border-red-500/20 bg-red-500/10",
  push: "text-slate-400 border-white/10 bg-white/5",
};

export default function BetsPage() {
  const { bets, updateResult, removeBet, pnl, loaded } = useBets();

  if (!loaded) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="h-32 animate-pulse rounded-xl bg-white/[0.02]" />
      </main>
    );
  }

  const wins = bets.filter((b) => b.result === "win").length;
  const losses = bets.filter((b) => b.result === "loss").length;
  const pending = bets.filter((b) => b.result === "pending").length;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="mb-6 text-2xl font-bold">My Picks</h1>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Total tracked", value: bets.length.toString() },
          { label: "Pending", value: pending.toString() },
          { label: "Record", value: `${wins}–${losses}` },
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

      {bets.length === 0 ? (
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-10 text-center">
          <p className="text-slate-500">No tracked picks yet.</p>
          <p className="mt-1 text-xs text-slate-600">
            Click <span className="text-orange-400">Track</span> on any pick from the dashboard.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {bets.map((bet) => (
            <div
              key={bet.id}
              className="flex items-center gap-4 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold uppercase text-slate-500">{bet.league}</span>
                  <span className="text-xs text-slate-600">{bet.matchup}</span>
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${RESULT_STYLES[bet.result]}`}
                  >
                    {bet.result.toUpperCase()}
                  </span>
                </div>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className="font-semibold">{bet.pick}</span>
                  <span className="text-sm text-slate-500">{bet.odds}</span>
                </div>
                <div className="mt-0.5 text-xs text-slate-600">
                  {new Date(bet.trackedAt).toLocaleDateString()} · {bet.stake} unit
                  {bet.stake !== 1 ? "s" : ""}
                </div>
              </div>

              {bet.result === "pending" && (
                <div className="flex shrink-0 gap-1.5">
                  <button
                    onClick={() => updateResult(bet.id, "win")}
                    className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20"
                  >
                    W
                  </button>
                  <button
                    onClick={() => updateResult(bet.id, "loss")}
                    className="rounded-md border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400 hover:bg-red-500/20"
                  >
                    L
                  </button>
                  <button
                    onClick={() => updateResult(bet.id, "push")}
                    className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-400 hover:bg-white/10"
                  >
                    P
                  </button>
                </div>
              )}

              <button
                onClick={() => removeBet(bet.id)}
                className="ml-1 shrink-0 text-slate-700 hover:text-slate-400"
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
