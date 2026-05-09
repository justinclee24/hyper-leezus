import Link from "next/link";
import { GameCard } from "@/lib/data";

const LEAGUE_COLORS: Record<string, string> = {
  NBA: "#2563eb",   // royal blue
  NFL: "#dc2626",   // red
  NHL: "#0891b2",   // cyan
  MLB: "#15803d",   // forest green
  MLS: "#ca8a04",   // gold
  EPL: "#7c3aed",   // violet
  NCAAB: "#0f766e", // teal
  NCAAF: "#ea580c", // burnt orange
  CFB: "#ea580c",
  CFL: "#b45309",   // dark amber
  WNBA: "#db2777",  // deep pink
};

function leagueColor(league: string): string {
  return LEAGUE_COLORS[league.toUpperCase()] ?? "#64748b";
}

export function GameCardView({ game }: { game: GameCard }) {
  const gameDate = new Date(game.startTime).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const color = leagueColor(game.league);
  return (
    <Link
      href={`/game/${game.id}`}
      className="group rounded-xl border bg-white/[0.02] p-4 transition hover:bg-white/[0.04]"
      style={{ borderColor: `${color}40` }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span
          className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
          style={{ color }}
        >
          {game.league}
        </span>
        <span className="text-[11px] text-slate-600">{gameDate}</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">{game.awayTeam}</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-600">Away</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white">{game.homeTeam}</span>
          <span className="text-[10px] uppercase tracking-wider text-orange-500">Home</span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <Stat label="Home Win" value={`${Math.round(game.homeWinProbability * 100)}%`} />
        <Stat label="Confidence" value={`${Math.round(game.confidence * 100)}%`} />
        <Stat label="Total" value={game.total > 0 ? game.total.toFixed(1) : "—"} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        {game.bookmakerCount && game.bookmakerCount > 1 ? (
          <span className="text-[10px] text-slate-700">{game.bookmakerCount} books</span>
        ) : (
          <span />
        )}
        <span className="text-[10px] font-medium text-orange-500/70 transition-colors group-hover:text-orange-400">
          AI Preview →
        </span>
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.04] px-2 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-600">{label}</div>
      <div className="mt-0.5 font-semibold text-slate-200">{value}</div>
    </div>
  );
}
