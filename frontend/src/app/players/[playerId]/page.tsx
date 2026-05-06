export default async function PlayerPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.3em] text-orange-500">
        Player Analytics
      </div>
      <h1 className="text-3xl font-bold">{playerId.replace(/-/g, " ")}</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Card label="Usage Rate" value="29.4%" />
        <Card label="PER" value="24.1" />
        <Card label="Lineup Synergy" value="0.68" />
        <Card label="Prediction Impact" value="+3.2 pts" />
      </div>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
      <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  );
}
