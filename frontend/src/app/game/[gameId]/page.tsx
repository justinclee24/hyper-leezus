import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { derivePicksForGame, fetchUpcomingGames } from "@/lib/odds";
import { featureImportance } from "@/lib/data";
import { GamePreview } from "@/components/game-preview";
import { PickCard } from "@/components/pick-card";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";
import { getUserPlan } from "@/lib/db";

async function getIsPro(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const user = await verifySessionToken(token);
  if (!user) return false;
  const dbPlan = await getUserPlan(user.id);
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const plan = adminEmails.includes(user.email.toLowerCase()) ? "admin" : dbPlan;
  return plan === "pro" || plan === "admin";
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;

  const [allGames, isPro] = await Promise.all([fetchUpcomingGames(), getIsPro()]);
  const game = allGames.find((g) => g.id === gameId);
  if (!game) notFound();

  const picks = isPro ? derivePicksForGame(game) : [];

  const gameDate = new Date(game.startTime).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.3em] text-orange-500">
        {game.league}
      </div>
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-3xl font-bold">
          {game.awayTeam} <span className="text-slate-600">@</span> {game.homeTeam}
        </h1>
        <span className="text-sm text-slate-500">{gameDate}</span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        {[
          { label: "Home Win %", value: `${Math.round(game.homeWinProbability * 100)}%` },
          {
            label: "Spread",
            value: game.spread > 0 ? `+${game.spread}` : `${game.spread}`,
          },
          { label: "Total", value: game.total.toFixed(1) },
          { label: "Confidence", value: `${Math.round(game.confidence * 100)}%` },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4"
          >
            <div className="text-xs uppercase tracking-wider text-slate-500">{stat.label}</div>
            <div className="mt-1 text-3xl font-bold">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          {!isPro ? (
            <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.06] p-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Model Picks
              </div>
              <p className="text-sm text-white font-semibold">Unlock game picks</p>
              <p className="mt-1 text-xs text-slate-400">
                Sign up for Pro to see model-derived edges, spreads, and totals for every game.
              </p>
              <div className="mt-3 flex gap-3">
                <a href="/login" className="rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15">
                  Sign in
                </a>
                <a href="/upgrade" className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-400">
                  Upgrade to Pro →
                </a>
              </div>
            </div>
          ) : picks.length === 0 ? (
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Model Picks
              </div>
              <p className="text-sm text-slate-500">
                No significant edge detected for this game. Probability aligns closely with
                market-implied odds across all bet types.
              </p>
            </div>
          ) : (
            picks.map((bet) => <PickCard key={bet.id} bet={bet} />)
          )}
        </div>

        <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-5">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Top Features
          </div>
          <div className="space-y-2.5">
            {featureImportance.map((f) => (
              <div key={f.feature} className="flex items-center justify-between">
                <span className="text-sm text-slate-400">{f.feature}</span>
                <div className="flex items-center gap-3">
                  <div className="h-1 w-20 rounded-full bg-white/5">
                    <div
                      className="h-1 rounded-full bg-orange-500/60"
                      style={{ width: `${f.value * 300}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs text-slate-600">
                    {Math.round(f.value * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <GamePreview
        gameId={gameId}
        homeTeam={game.homeTeam}
        awayTeam={game.awayTeam}
        league={game.league}
        homeProb={game.homeWinProbability}
        spread={game.spread}
        total={game.total}
      />
    </main>
  );
}
