import { notFound } from "next/navigation";
import { derivePicksForGame, fetchUpcomingGames } from "@/lib/odds";
import { featureImportance } from "@/lib/data";
import { GamePreview } from "@/components/game-preview";

export default async function GamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;

  const allGames = await fetchUpcomingGames();
  const game = allGames.find((g) => g.id === gameId);
  if (!game) notFound();

  const picks = derivePicksForGame(game);

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
          {picks.length === 0 ? (
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
            picks.map((bet) => (
              <div
                key={bet.id}
                className="rounded-xl border border-orange-500/25 bg-orange-500/[0.06] p-5"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider text-orange-400">
                    {bet.betType}
                  </div>
                  {bet.hot && (
                    <span className="rounded-md bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-400">
                      Hot
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl font-bold text-white">{bet.pick}</span>
                  <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-sm text-slate-400">
                    {bet.odds}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="mb-1 flex justify-between text-[11px]">
                      <span className="text-slate-500">Edge</span>
                      <span className="text-orange-400">{Math.round(bet.edge * 100)}%</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/5">
                      <div
                        className="h-1 rounded-full bg-orange-500"
                        style={{ width: `${Math.min(bet.edge * 700, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Confidence</div>
                    <div className="text-sm font-semibold">{Math.round(bet.confidence * 100)}%</div>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">{bet.reasoning}</p>
              </div>
            ))
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
