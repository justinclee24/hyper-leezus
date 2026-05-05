export default function AnalyticsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-8">
        <div className="text-sm uppercase tracking-[0.3em] text-cyan-200">Prediction Analytics</div>
        <h1 className="mt-3 text-4xl font-semibold">Historical Accuracy and ROI</h1>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <Card label="Accuracy" value="64.2%" />
          <Card label="Log Loss" value="0.612" />
          <Card label="Brier Score" value="0.193" />
          <Card label="ROI" value="+4.1%" />
        </div>
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl bg-white/5 p-5">
      <div className="text-sm text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}
