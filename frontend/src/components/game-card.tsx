import Link from "next/link";
import { GameCard } from "@/lib/data";

export function GameCardView({ game }: { game: GameCard }) {
  return (
    <Link
      href={`/game/${game.id}`}
      className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 transition hover:border-cyan-400/60 hover:bg-slate-900"
    >
      <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.25em] text-cyan-200">
        <span>{game.league}</span>
        <span>{new Date(game.startTime).toLocaleString()}</span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-lg">
          <span className="text-slate-200">{game.awayTeam}</span>
          <span className="text-slate-400">Away</span>
        </div>
        <div className="flex items-center justify-between text-lg font-semibold">
          <span>{game.homeTeam}</span>
          <span className="text-emerald-300">Home</span>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
        <Stat label="Home Win" value={`${Math.round(game.homeWinProbability * 100)}%`} />
        <Stat label="Confidence" value={`${Math.round(game.confidence * 100)}%`} />
        <Stat label="Total" value={game.total.toFixed(1)} />
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/5 p-3">
      <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-1 text-base font-medium text-white">{value}</div>
    </div>
  );
}
