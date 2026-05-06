"use client";

import { BarChart3, Radar, ShieldCheck, Zap } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { GameCardView } from "@/components/game-card";
import { accuracySeries, featureImportance, upcomingGames } from "@/lib/data";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-7xl px-6 py-10">
      <section className="grid gap-8 lg:grid-cols-[1.4fr,0.9fr]">
        <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-8">
          <div className="inline-flex rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1 text-xs uppercase tracking-[0.3em] text-cyan-100">
            Multi-league prediction intelligence
          </div>
          <h1 className="mt-6 max-w-3xl text-5xl font-semibold tracking-tight text-white">
            Real-time sports forecasting for markets, teams, and player-level decision making.
          </h1>
          <p className="mt-4 max-w-2xl text-slate-300">
            Ensemble models blend tree methods, sequence models, Bayesian priors, and interaction graphs to update win probabilities and betting edges as live signals arrive.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={<Radar className="h-5 w-5" />} label="Leagues" value="8+" />
            <Metric icon={<Zap className="h-5 w-5" />} label="Hourly Ingestion" value="24/7" />
            <Metric icon={<ShieldCheck className="h-5 w-5" />} label="Calibration" value="2.2% ECE" />
            <Metric icon={<BarChart3 className="h-5 w-5" />} label="ROI Tracking" value="+4.1%" />
          </div>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-cyan-500/20 to-transparent p-6">
          <div className="text-sm uppercase tracking-[0.3em] text-cyan-100">Model health</div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={accuracySeries}>
                <CartesianGrid stroke="rgba(148,163,184,0.15)" vertical={false} />
                <XAxis dataKey="week" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" domain={[0.5, 0.7]} />
                <Tooltip />
                <Line type="monotone" dataKey="accuracy" stroke="#22d3ee" strokeWidth={3} />
                <Line type="monotone" dataKey="roi" stroke="#fbbf24" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
      <section className="mt-10">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Upcoming Games</h2>
          <span className="text-sm uppercase tracking-[0.25em] text-slate-400">Live board</span>
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          {upcomingGames.map((game) => (
            <GameCardView key={game.id} game={game} />
          ))}
        </div>
      </section>
      <section className="mt-10 grid gap-8 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6">
          <h3 className="text-xl font-semibold">Feature Importance</h3>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={featureImportance} layout="vertical">
                <CartesianGrid stroke="rgba(148,163,184,0.12)" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" />
                <YAxis dataKey="feature" type="category" stroke="#94a3b8" width={150} />
                <Tooltip />
                <Bar dataKey="value" fill="#22d3ee" radius={[0, 10, 10, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6">
          <h3 className="text-xl font-semibold">Platform Coverage</h3>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[
              "NBA / possession-level team models",
              "NFL & CFB weather + travel context",
              "NHL goalie-adjusted matchups",
              "MLB pitcher/bullpen state tracking",
              "Soccer xG and market-informed priors",
              "Rugby tempo and rest-cycle features"
            ].map((item) => (
              <div key={item} className="rounded-2xl bg-white/5 p-4 text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 text-cyan-200">{icon}</div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-sm text-slate-400">{label}</div>
    </div>
  );
}
