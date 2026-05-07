"use client";

import { useCallback, useEffect, useState } from "react";
import type { TrackedBet } from "@/lib/data";

const STORAGE_KEY = "hl-tracked-bets";

export function useBets() {
  const [bets, setBets] = useState<TrackedBet[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setBets(JSON.parse(raw));
    } catch {}
    setLoaded(true);
  }, []);

  const persist = useCallback((updated: TrackedBet[]) => {
    setBets(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  }, []);

  const trackBet = useCallback(
    (bet: Omit<TrackedBet, "id" | "trackedAt" | "result">) => {
      const newBet: TrackedBet = {
        ...bet,
        id: `bet-${Date.now()}`,
        trackedAt: new Date().toISOString(),
        result: "pending",
      };
      persist([...bets, newBet]);
      return newBet;
    },
    [bets, persist],
  );

  const updateResult = useCallback(
    (id: string, result: TrackedBet["result"]) => {
      persist(bets.map((b) => (b.id === id ? { ...b, result } : b)));
    },
    [bets, persist],
  );

  const removeBet = useCallback(
    (id: string) => persist(bets.filter((b) => b.id !== id)),
    [bets, persist],
  );

  const isTracked = useCallback(
    (gameId: string, betType: string) =>
      bets.some((b) => b.gameId === gameId && b.betType === betType && b.result === "pending"),
    [bets],
  );

  // P&L in units (1 unit = 1 stake)
  const pnl = bets.reduce((total, b) => {
    if (b.result === "win") {
      const odds = parseFloat(b.odds.replace("+", ""));
      return total + (odds > 0 ? b.stake * (odds / 100) : b.stake * (100 / Math.abs(odds)));
    }
    if (b.result === "loss") return total - b.stake;
    return total;
  }, 0);

  return { bets, trackBet, updateResult, removeBet, isTracked, pnl, loaded };
}
