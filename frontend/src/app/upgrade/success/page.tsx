"use client";

import { useEffect } from "react";
import { CheckCircle } from "lucide-react";
import Link from "next/link";

export default function UpgradeSuccessPage() {
  useEffect(() => {
    // Re-issue session token with updated plan, then redirect
    fetch("/api/auth/refresh", { method: "POST" }).finally(() => {
      setTimeout(() => { window.location.href = "/bets"; }, 2500);
    });
  }, []);

  return (
    <main className="mx-auto max-w-xl px-6 py-16 text-center">
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-12">
        <CheckCircle className="mx-auto mb-4 h-12 w-12 text-emerald-400" />
        <h1 className="text-2xl font-bold">Welcome to Pro!</h1>
        <p className="mt-2 text-slate-400">Your subscription is active. Taking you to Analytics…</p>
        <Link
          href="/bets"
          className="mt-6 inline-block rounded-xl bg-emerald-500/20 px-6 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/30"
        >
          Go to Analytics now
        </Link>
      </div>
    </main>
  );
}
