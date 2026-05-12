"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-black tracking-tight">
            HYPER<span className="text-orange-500">LEEZUS</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">Reset your password</p>
        </div>

        {submitted ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6 text-center">
            <p className="text-sm text-slate-300">
              If an account exists for <span className="font-semibold text-white">{email}</span>, you&apos;ll receive a reset link shortly.
            </p>
            <Link href="/login" className="mt-4 inline-block text-xs text-orange-400 hover:text-orange-300">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm outline-none placeholder:text-slate-600 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-orange-500 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send Reset Link"}
            </button>
            <p className="text-center text-xs text-slate-600">
              <Link href="/login" className="text-slate-400 hover:text-white">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
