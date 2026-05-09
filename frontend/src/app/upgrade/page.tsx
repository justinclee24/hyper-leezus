"use client";

import { useEffect, useState } from "react";
import { Check, CreditCard, Wallet, Zap } from "lucide-react";
import Link from "next/link";

const PRICE_USD = 9.99;

const PRO_FEATURES = [
  "Full bet tracking and performance history",
  "Cumulative P&L charts and analytics",
  "Results breakdown by league and bet type",
  "Edge distribution analysis",
  "Win rate and ROI tracking",
  "Export tools (coming soon)",
];

export default function UpgradePage() {
  const [user, setUser] = useState<{ email: string; plan: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [ethStep, setEthStep] = useState<"idle" | "connecting" | "sending" | "verifying" | "done" | "error">("idle");
  const [ethError, setEthError] = useState("");

  const ethAmount = ethPrice ? (PRICE_USD / ethPrice).toFixed(6) : null;
  const ethAddress = process.env.NEXT_PUBLIC_ETH_PAYMENT_ADDRESS;

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => { setUser(d.user); setLoading(false); })
      .catch(() => setLoading(false));

    fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd")
      .then((r) => r.json())
      .then((d) => setEthPrice(d.ethereum?.usd ?? null))
      .catch(() => {});
  }, []);

  async function handleStripe() {
    setStripeLoading(true);
    try {
      const r = await fetch("/api/stripe/checkout", { method: "POST" });
      const d = await r.json();
      if (d.url) window.location.href = d.url;
      else alert(d.error ?? "Stripe checkout unavailable. Ensure STRIPE_SECRET_KEY and STRIPE_PRICE_ID are set.");
    } catch {
      alert("Failed to initiate checkout. Try again.");
    } finally {
      setStripeLoading(false);
    }
  }

  async function handleMetaMask() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eth = (window as any).ethereum;
    if (!eth) {
      setEthError("MetaMask not found. Install it at metamask.io then reload.");
      setEthStep("error");
      return;
    }
    if (!ethAddress || !ethAmount) {
      setEthError("Crypto payments are not configured on this server.");
      setEthStep("error");
      return;
    }

    try {
      setEthStep("connecting");
      const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
      const from = accounts[0];

      setEthStep("sending");
      const valueWei = BigInt(Math.round(parseFloat(ethAmount) * 1e15)) * BigInt(1000);
      const valueHex = "0x" + valueWei.toString(16);

      const hash: string = await eth.request({
        method: "eth_sendTransaction",
        params: [{ from, to: ethAddress, value: valueHex }],
      });

      setEthStep("verifying");
      // Wait 20s for at least 1 confirmation before verifying
      await new Promise((res) => setTimeout(res, 20000));

      const verifyResp = await fetch("/api/crypto/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: hash, expectedEth: parseFloat(ethAmount) }),
      });
      const verifyData = await verifyResp.json();

      if (verifyData.success) {
        setEthStep("done");
        // Refresh session token to pick up new plan, then redirect
        await fetch("/api/auth/refresh", { method: "POST" });
        setTimeout(() => { window.location.href = "/bets"; }, 1500);
      } else {
        setEthError(verifyData.error ?? "Verification failed");
        setEthStep("error");
      }
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string };
      if (e.code === 4001) {
        setEthError("Transaction rejected in MetaMask.");
      } else {
        setEthError(e.message ?? "Unknown error");
      }
      setEthStep("error");
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <div className="h-80 animate-pulse rounded-2xl bg-white/[0.02]" />
      </main>
    );
  }

  if (user?.plan === "pro") {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-center">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-10">
          <Zap className="mx-auto mb-4 h-10 w-10 text-emerald-400" />
          <h1 className="text-2xl font-bold">You&apos;re on Pro</h1>
          <p className="mt-2 text-slate-400">All analytics features are unlocked.</p>
          <Link
            href="/bets"
            className="mt-6 inline-block rounded-xl bg-emerald-500/20 px-6 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/30"
          >
            Go to Analytics
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Upgrade to Pro</h1>
        <p className="mt-2 text-slate-400">Unlock full bet tracking and advanced analytics.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-orange-500/20 bg-gradient-to-b from-orange-500/[0.05] to-transparent">
        <div className="border-b border-white/[0.05] px-8 py-6 text-center">
          <div className="text-4xl font-black">
            ${PRICE_USD}
            <span className="text-xl font-normal text-slate-400">/mo</span>
          </div>
          <div className="mt-1 text-sm text-slate-500">Cancel anytime from your Stripe portal</div>
        </div>

        <div className="px-8 py-6">
          <ul className="space-y-3">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-3 text-sm text-slate-300">
                <Check className="h-4 w-4 shrink-0 text-orange-400" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3 px-8 pb-8">
          {!user ? (
            <Link
              href="/login?from=/upgrade"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3.5 text-sm font-bold text-white hover:bg-orange-400"
            >
              Sign in to upgrade
            </Link>
          ) : (
            <>
              <button
                onClick={handleStripe}
                disabled={stripeLoading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3.5 text-sm font-bold text-white hover:bg-orange-400 disabled:opacity-60"
              >
                <CreditCard className="h-4 w-4" />
                {stripeLoading ? "Redirecting to Stripe…" : "Subscribe with Card"}
              </button>

              {ethAddress && ethPrice && (
                <>
                  <div className="relative py-1">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/[0.06]" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-[#07101e] px-3 text-[11px] text-slate-600">or pay with crypto</span>
                    </div>
                  </div>

                  {ethStep === "idle" && (
                    <button
                      onClick={handleMetaMask}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-6 py-3.5 text-sm font-bold text-slate-200 hover:bg-white/[0.05]"
                    >
                      <Wallet className="h-4 w-4" />
                      Pay {ethAmount} ETH via MetaMask
                    </button>
                  )}

                  {ethStep === "connecting" && (
                    <div className="rounded-xl border border-white/[0.06] px-4 py-3 text-center text-xs text-slate-400">
                      Connecting to MetaMask…
                    </div>
                  )}
                  {ethStep === "sending" && (
                    <div className="rounded-xl border border-white/[0.06] px-4 py-3 text-center text-xs text-slate-400">
                      Waiting for you to approve the transaction in MetaMask…
                    </div>
                  )}
                  {ethStep === "verifying" && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3 text-center text-xs text-amber-400">
                      Transaction sent — verifying on-chain (15–30 seconds)…
                    </div>
                  )}
                  {ethStep === "done" && (
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-3 text-center text-xs text-emerald-400">
                      Payment confirmed! Activating your Pro account…
                    </div>
                  )}
                  {ethStep === "error" && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] px-4 py-3 text-center text-xs text-red-400">
                      {ethError}{" "}
                      <button onClick={() => setEthStep("idle")} className="underline">
                        Try again
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-slate-700">
        Payments processed securely via Stripe. We never store card details.
      </p>
    </main>
  );
}
