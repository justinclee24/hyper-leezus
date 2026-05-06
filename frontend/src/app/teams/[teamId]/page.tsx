export default async function TeamPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-8">
        <div className="text-sm uppercase tracking-[0.3em] text-cyan-200">Team Analytics</div>
        <h1 className="mt-3 text-4xl font-semibold">{teamId}</h1>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Card label="Offensive Rating" value="118.7" />
          <Card label="Defensive Rating" value="110.9" />
          <Card label="Travel Fatigue" value="0.12" />
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
