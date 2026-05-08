"use client";

import { useCallback, useEffect, useState } from "react";
import type { TrackedBet } from "@/lib/data";

export function useBets() {
  const [bets, setBets] = useState<TrackedBet[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    fetch("/api/bets")
      .then((r) => {
        if (r.status === 401) { setAuthenticated(false); return null; }
        setAuthenticated(true);
        return r.json();
      })
      .then((data) => { if (data?.bets) setBets(data.bets); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const trackBet = useCallback(
    async (bet: Omit<TrackedBet, "id" | "trackedAt" | "result">) => {
      if (!authenticated) return null;
      // Optimistic update
      const optimistic: TrackedBet = {
        ...bet, id: `pending-${Date.now()}`, trackedAt: new Date().toISOString(), result: "pending",
      };
      setBets((prev) => [optimistic, ...prev]);
      try {
        const resp = await fetch("/api/bets", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(bet),
        });
        const data = await resp.json();
        // Replace optimistic entry with server-confirmed bet
        setBets((prev) => prev.map((b) => (b.id === optimistic.id ? data.bet : b)));
        return data.bet as TrackedBet;
      } catch {
        setBets((prev) => prev.filter((b) => b.id !== optimistic.id));
        return null;
      }
    },
    [authenticated],
  );

  const updateResult = useCallback(
    async (id: string, result: TrackedBet["result"]) => {
      setBets((prev) => prev.map((b) => (b.id === id ? { ...b, result } : b)));
      await fetch(`/api/bets/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ result }),
      });
    },
    [],
  );

  const removeBet = useCallback(async (id: string) => {
    setBets((prev) => prev.filter((b) => b.id !== id));
    await fetch(`/api/bets/${id}`, { method: "DELETE" });
  }, []);

  const isTracked = useCallback(
    (gameId: string, betType: string) =>
      bets.some((b) => b.gameId === gameId && b.betType === betType && b.result === "pending"),
    [bets],
  );

  const pnl = bets.reduce((total, b) => {
    if (b.result === "win") {
      const odds = parseFloat(b.odds.replace("+", ""));
      return total + (odds > 0 ? b.stake * (odds / 100) : b.stake * (100 / Math.abs(odds)));
    }
    if (b.result === "loss") return total - b.stake;
    return total;
  }, 0);

  return { bets, trackBet, updateResult, removeBet, isTracked, pnl, loaded, authenticated };
}
