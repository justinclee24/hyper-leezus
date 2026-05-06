"use client";

import { BarChart3, Clock, Flame, Target, TrendingUp } from "lucide-react";
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
import {
  accuracySeries,
  betRecommendations,
  featureImportance,
  upcomingGames,
} from "@/lib/data";
import type { BetRecommendation } from "@/lib/data";

const BET_TYPE_STYLE: Record<BetRecommendation["betType"], string> = {
  Spread: "border-blue-500/20 bg-blue-500/10 text-blue-300",
  Moneyline: "border-violet-500/20 bg-violet-500/10 text-violet-300",
  Over: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  Under: "border-red-500/20 bg-red-500/10 text-red-300",
};

function BetCard({ bet }: { bet: BetRecommendation }) {
  const edgePct = Math.round(bet.edge * 100);
  const confPct = Math.round(bet.confidence * 100);
  return (
    <div
      className={`relative rounded-xl border p-5 ${
        bet.hot
          ? "border-orange-500/30 bg-orange-500/[0.06] shadow-lg shadow-orange-500/5"
          : "border-white/[0.06] bg-white/[0.02]"
      }`}
    >
      {bet.hot && (
        <div className="absolute right-4 top-4 flex items-center gap-1 rounded-md bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-400">
          <Flame className="h-3 w-3" />
          Hot
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
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
            <span className={edgePct >= 10 ? "text-orange-400" : "text-amber-500"}>
              {edgePct}%
            </span>
          </div>
          <div className="h-1 rounded-full bg-white/5">
            <div
              className={`h-1 rounded-full ${edgePct >= 10 ? "bg-orange-500" : "bg-amber-500"}`}
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
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
        {icon}
      </div>
      <div>
        <div className="text-lg font-bold leading-tight">{value}</div>
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

export default function HomePage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric icon={<TrendingUp className="h-4 w-4" />} label="Leagues" value="8+" />
        <Metric icon={<Clock className="h-4 w-4" />} label="Ingestion" value="24/7" />
        <Metric icon={<Target className="h-4 w-4" />} label="Calibration" value="2.2% ECE" />
        <Metric icon={<BarChart3 className="h-4 w-4" />} label="Model ROI" value="+4.1%" />
      </div>

      <section className="mb-10">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tight">Today's Edges</h2>
          <span className="rounded-md bg-orange-500/15 px-2 py-0.5 text-xs font-semibold text-orange-400">
            {betRecommendations.length} picks
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {betRecommendations.map((bet) => (
            <BetCard key={bet.id} bet={bet} />
          ))}
        </div>
      </section>

      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Upcoming Games</h2>
          <span className="text-xs uppercase tracking-[0.25em] text-slate-600">Live board</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {upcomingGames.map((game) => (
            <GameCardView key={game.id} game={game} />
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-6">
          <h3 className="text-base font-semibold">Feature Importance</h3>
          <p className="mt-0.5 mb-5 text-xs text-slate-600">SHAP-averaged across all active leagues</p>
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
          <p className="mt-0.5 mb-5 text-xs text-slate-600">Rolling 5-week accuracy and ROI</p>
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
