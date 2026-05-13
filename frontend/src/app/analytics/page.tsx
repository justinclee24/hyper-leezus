export default function AnalyticsPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-8">
        <div className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-500">
          Prediction Analytics
        </div>
        <h1 className="mt-2 text-3xl font-bold">Historical Accuracy and ROI</h1>
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
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.03] p-5">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  );
}
