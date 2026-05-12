"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function ResetForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords don't match"); return; }
    setLoading(true);
    try {
      const resp = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await resp.json();
      if (!resp.ok) { setError(data.error ?? "Something went wrong"); return; }
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-6 text-center">
        <p className="text-sm text-red-400">Invalid reset link.</p>
        <Link href="/forgot-password" className="mt-3 inline-block text-xs text-orange-400 hover:text-orange-300">
          Request a new one
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6 text-center">
        <p className="text-sm text-slate-300">Password updated. Redirecting to sign in…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">New Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          minLength={8}
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm outline-none placeholder:text-slate-600 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30"
          required
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">Confirm Password</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm outline-none placeholder:text-slate-600 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30"
          required
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:opacity-50"
      >
        {loading ? "Updating…" : "Set New Password"}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-black tracking-tight">
            HYPER<span className="text-orange-500">LEEZUS</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">Choose a new password</p>
        </div>
        <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-white/[0.02]" />}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
