"use client";

import { useEffect, useState } from "react";
import { Activity, Brain, CheckCircle, Clock, Database, TrendingUp, Zap } from "lucide-react";

const PIPELINE_STEPS = [
  {
    icon: Database,
    title: "Data Collection",
    cadence: "Every 2 hours",
    color: "blue",
    points: [
      "Live pre-game odds from 20+ sportsbooks via The-Odds-API",
      "Completed game scores stored with matching game UUIDs",
      "Consensus win probability averaged across all bookmakers",
      "ESPN historical scores backfilled for rolling team stats",
    ],
  },
  {
    icon: Brain,
    title: "Model Training",
    cadence: "Daily at 4 AM",
    color: "violet",
    points: [
      "10-game rolling team averages prevent data leakage",
      "XGBoost classifier outputs win probability per league",
      "Gradient Boosting regressors predict home & away scores",
      "5 leagues trained independently: NBA, NHL, MLB, NFL, NCAAB",
    ],
  },
  {
    icon: Zap,
    title: "Prediction & Edge",
    cadence: "Real-time",
    color: "orange",
    points: [
      "ML output blended 60% with 40% market consensus probability",
      "Edge flagged when blended probability deviates >3.5% from market",
      "O/U edge detected when projected total deviates >4% from league avg",
      "Confidence derived from how far probability sits from 50%",
    ],
  },
];

const FEATURES = [
  { group: "Performance", color: "orange", items: [
    { name: "Power Rating Diff", desc: "Rolling avg point differential (home minus away), last 10 games" },
    { name: "Offensive Rating Diff", desc: "Points per possession differential across recent games" },
    { name: "Defensive Rating Diff", desc: "Points allowed per possession differential across recent games" },
    { name: "Pace Differential", desc: "Possessions per minute difference — predicts total scoring" },
  ]},
  { group: "Situational", color: "blue", items: [
    { name: "Rest Days Diff", desc: "Days of rest between games, home minus away" },
    { name: "Travel Fatigue", desc: "Miles traveled divided by rest days — penalizes cross-country back-to-backs" },
    { name: "Injury Impact Diff", desc: "Summed injury impact scores (out=1.0, questionable=0.45) per team" },
  ]},
  { group: "Market Signals", color: "emerald", items: [
    { name: "Market Implied Prob", desc: "Consensus home win probability averaged across all bookmakers (vig-adjusted)" },
    { name: "Line Movement", desc: "Spread change from open — sharp movement signals informed action" },
    { name: "Public Betting %", desc: "Percentage of public bets on home team — contrarian signal" },
    { name: "Sharp Money %", desc: "Percentage of sharp (high-limit) bets on home — strongest market signal" },
  ]},
  { group: "Environmental", color: "amber", items: [
    { name: "Sentiment Diff", desc: "Reddit post sentiment score for home team minus away team" },
    { name: "Weather Severity", desc: "Composite of wind speed, precipitation, and temperature deviation (outdoor sports only)" },
  ]},
];

const COLOR_MAP: Record<string, string> = {
  orange: "border-orange-500/20 bg-orange-500/[0.05] text-orange-400",
  blue: "border-blue-500/20 bg-blue-500/[0.05] text-blue-400",
  violet: "border-violet-500/20 bg-violet-500/[0.05] text-violet-400",
  emerald: "border-emerald-500/20 bg-emerald-500/[0.05] text-emerald-400",
  amber: "border-amber-500/20 bg-amber-500/[0.05] text-amber-400",
};

const DOT_MAP: Record<string, string> = {
  orange: "bg-orange-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
};

interface LeagueModel {
  version: string;
  metrics: Record<string, number>;
  training_rows: number;
  trained_at: string | null;
  is_real: boolean;
}

export default function MethodologyPage() {
  const [models, setModels] = useState<Record<string, LeagueModel>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/model-info")
      .then((r) => r.json())
      .then((d) => setModels(d.models ?? {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const leagues = ["nba", "nhl", "mlb", "nfl", "ncaab"];

  return (
    <main className="mx-auto max-w-7xl px-6 py-10">

      {/* Hero */}
      <div className="mb-12 max-w-2xl">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-orange-500">
          <Activity className="h-3.5 w-3.5" />
          System Transparency
        </div>
        <h1 className="mb-3 text-4xl font-black tracking-tight">How It Works</h1>
        <p className="text-base leading-relaxed text-slate-400">
          Hyper Leezus runs a fully automated ML pipeline — ingesting real odds and game
          results every two hours, retraining models nightly, and blending statistical
          predictions with live market consensus to surface genuine edges.
        </p>
      </div>

      {/* Pipeline */}
      <section className="mb-14">
        <h2 className="mb-6 text-lg font-bold tracking-tight">The Pipeline</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          {PIPELINE_STEPS.map((step, i) => {
            const Icon = step.icon;
            const cls = COLOR_MAP[step.color];
            return (
              <div key={step.title} className="relative rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className={`flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-semibold ${cls}`}>
                    <Icon className="h-3.5 w-3.5" />
                    Step {i + 1}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
                    <Clock className="h-3 w-3" />
                    {step.cadence}
                  </div>
                </div>
                <h3 className="mb-3 text-base font-bold">{step.title}</h3>
                <ul className="space-y-2">
                  {step.points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${DOT_MAP[step.color]}`} />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* Live Model Status */}
      <section className="mb-14">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Live Model Status</h2>
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" />
            Updated after each training run
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                {["League", "Status", "Training Samples", "Accuracy", "Log Loss", "Calibration (ECE)", "Est. ROI", "Last Trained"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-white/[0.04]">
                    {[...Array(8)].map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 w-20 animate-pulse rounded bg-white/[0.05]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                leagues.map((league) => {
                  const m = models[league];
                  return (
                    <tr key={league} className="border-b border-white/[0.04] transition-colors hover:bg-white/[0.02]">
                      <td className="px-4 py-3 font-semibold uppercase text-slate-300">{league}</td>
                      <td className="px-4 py-3">
                        {m ? (
                          m.is_real ? (
                            <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
                              <CheckCircle className="h-3.5 w-3.5" /> Real Model
                            </span>
                          ) : (
                            <span className="text-xs text-amber-500 font-medium">Synthetic Fallback</span>
                          )
                        ) : (
                          <span className="text-xs text-slate-600">Not trained</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{m ? m.training_rows.toLocaleString() : "—"}</td>
                      <td className="px-4 py-3">
                        {m?.metrics?.accuracy != null ? (
                          <span className={m.metrics.accuracy >= 0.55 ? "text-emerald-400 font-semibold" : "text-slate-400"}>
                            {(m.metrics.accuracy * 100).toFixed(1)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {m?.metrics?.log_loss != null ? m.metrics.log_loss.toFixed(3) : "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {m?.metrics?.calibration_error != null ? (m.metrics.calibration_error * 100).toFixed(2) + "%" : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {m?.metrics?.roi_against_closing_line != null ? (
                          <span className={m.metrics.roi_against_closing_line > 0 ? "text-emerald-400 font-semibold" : "text-slate-400"}>
                            {m.metrics.roi_against_closing_line > 0 ? "+" : ""}
                            {(m.metrics.roi_against_closing_line * 100).toFixed(1)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {m?.trained_at ? new Date(m.trained_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-slate-600">
          Accuracy ≥ 55% and positive ROI indicate the model is beating the market. Calibration (ECE) measures how well predicted probabilities match actual outcomes — lower is better.
        </p>
      </section>

      {/* Features */}
      <section className="mb-14">
        <h2 className="mb-2 text-lg font-bold tracking-tight">Training Features</h2>
        <p className="mb-6 text-sm text-slate-500">
          13 features across 4 categories feed each league&apos;s model. All performance features use rolling
          10-game averages computed from games <em>before</em> the target game — no data leakage.
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          {FEATURES.map((group) => (
            <div key={group.group} className={`rounded-xl border p-5 ${COLOR_MAP[group.color]}`}>
              <div className="mb-4 text-xs font-bold uppercase tracking-widest opacity-80">{group.group}</div>
              <div className="space-y-3">
                {group.items.map((item) => (
                  <div key={item.name}>
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <span className={`h-1.5 w-1.5 rounded-full ${DOT_MAP[group.color]}`} />
                      {item.name}
                    </div>
                    <p className="mt-0.5 pl-3.5 text-[11px] leading-relaxed text-slate-500">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Blend & Edge */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <div className="mb-1 flex items-center gap-2 text-sm font-bold">
            <TrendingUp className="h-4 w-4 text-orange-500" />
            The 60 / 40 Blend
          </div>
          <p className="mb-4 text-xs text-slate-500">Why not use the ML model at 100%?</p>
          <div className="mb-4 flex h-4 overflow-hidden rounded-full">
            <div className="flex h-full w-[60%] items-center justify-center bg-orange-500 text-[9px] font-bold text-black">60% ML</div>
            <div className="flex h-full w-[40%] items-center justify-center bg-slate-700 text-[9px] font-bold text-slate-300">40% Market</div>
          </div>
          <div className="space-y-3 text-xs leading-relaxed text-slate-400">
            <p>
              Sportsbook lines aggregate information from thousands of sharp bettors and
              professional syndicates. A model trained on weeks of data cannot systematically
              beat that signal — but it can add value on top of it.
            </p>
            <p>
              By blending, the system inherits the market&apos;s information advantage while
              letting the model contribute where market odds are slow to adjust: rest
              differentials, travel schedules, and recent form.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
          <div className="mb-1 flex items-center gap-2 text-sm font-bold">
            <Zap className="h-4 w-4 text-orange-500" />
            Edge Detection
          </div>
          <p className="mb-4 text-xs text-slate-500">How picks are surfaced</p>
          <div className="space-y-3">
            {[
              {
                label: "Moneyline Edge",
                formula: "blended_prob − market_implied_prob > 3.5%",
                detail: "Model sees home team as meaningfully more likely than the market implies.",
              },
              {
                label: "Spread Edge",
                formula: "|spread_diff| > 1.5 pts when confidence > 62%",
                detail: "Predicted margin deviates from the line and the model is confident.",
              },
              {
                label: "O/U Edge",
                formula: "|projected_total − league_avg| / league_avg > 4%",
                detail: "Projected total deviates significantly from the league season average — mean reversion signal.",
              },
            ].map((rule) => (
              <div key={rule.label} className="rounded-lg bg-white/[0.03] p-3">
                <div className="mb-1 text-xs font-semibold text-orange-400">{rule.label}</div>
                <code className="mb-1 block text-[10px] text-slate-500">{rule.formula}</code>
                <p className="text-[11px] leading-relaxed text-slate-500">{rule.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
