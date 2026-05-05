import { featureImportance } from "@/lib/data";

export default function GamePage({ params }: { params: { gameId: string } }) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-8">
        <div className="text-sm uppercase tracking-[0.3em] text-cyan-200">Game Breakdown</div>
        <h1 className="mt-3 text-4xl font-semibold">{params.gameId}</h1>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <Panel title="Home Win %" value="64%" />
          <Panel title="Spread" value="-5.5" />
          <Panel title="Total" value="227.5" />
          <Panel title="Confidence" value="77%" />
        </div>
        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr,0.9fr]">
          <div className="rounded-3xl bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Model Explanation</h2>
            <p className="mt-3 text-slate-300">
              SHAP decomposition shows the strongest lift coming from recent offensive efficiency, lineup continuity, and market-implied strength.
            </p>
          </div>
          <div className="rounded-3xl bg-white/5 p-6">
            <h2 className="text-xl font-semibold">Top Features</h2>
            <div className="mt-4 space-y-3">
              {featureImportance.map((feature) => (
                <div key={feature.feature} className="flex items-center justify-between rounded-2xl bg-slate-900/80 px-4 py-3">
                  <span>{feature.feature}</span>
                  <span className="text-cyan-200">{Math.round(feature.value * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Panel({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white/5 p-4">
      <div className="text-sm uppercase tracking-[0.25em] text-slate-400">{title}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}
