export default function PlayerPage({ params }: { params: { playerId: string } }) {
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-8">
        <div className="text-sm uppercase tracking-[0.3em] text-cyan-200">Player Analytics</div>
        <h1 className="mt-3 text-4xl font-semibold">{params.playerId}</h1>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <Card label="Usage Rate" value="29.4%" />
          <Card label="PER" value="24.1" />
          <Card label="Lineup Synergy" value="0.68" />
          <Card label="Prediction Impact" value="+3.2 pts" />
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
