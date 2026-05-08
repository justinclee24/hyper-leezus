"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TrendingUp } from "lucide-react";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const resp = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, name, password }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-2 flex justify-center">
            <TrendingUp className="h-6 w-6 text-orange-500" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">
            HYPER<span className="text-orange-500">LEEZUS</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">Create your account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm outline-none placeholder:text-slate-600 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30"
              required
            />
          </div>
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
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm outline-none placeholder:text-slate-600 focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Confirm password</label>
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
            {loading ? "Creating account…" : "Create Account"}
          </button>
          <p className="text-center text-xs text-slate-600">
            Already have an account?{" "}
            <Link href="/login" className="text-slate-400 hover:text-white">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
