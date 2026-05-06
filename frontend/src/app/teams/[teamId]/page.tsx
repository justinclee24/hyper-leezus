export default async function TeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.3em] text-orange-500">
        Team Analytics
      </div>
      <h1 className="text-3xl font-bold">{teamId.replace(/-/g, " ")}</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card label="Offensive Rating" value="118.7" />
        <Card label="Defensive Rating" value="110.9" />
        <Card label="Travel Fatigue" value="0.12" />
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
