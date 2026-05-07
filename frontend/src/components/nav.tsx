"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

interface NavUser {
  name: string;
  email: string;
}

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/bets", label: "My Picks" },
  { href: "/analytics", label: "Analytics" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<NavUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user ?? null))
      .catch(() => {});
  }, [pathname]);

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.05] bg-[#030810]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-orange-500" />
          <span className="text-base font-black tracking-tighter">
            HYPER<span className="text-orange-500">LEEZUS</span>
          </span>
        </Link>

        <nav className="flex gap-6 text-sm font-medium">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                pathname === link.href
                  ? "text-orange-400"
                  : "text-slate-500 transition-colors hover:text-slate-200"
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-md border border-orange-500/20 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" />
            LIVE
          </div>

          {user ? (
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-slate-500 sm:inline">{user.name}</span>
              <button
                onClick={handleSignOut}
                className="text-xs text-slate-600 transition-colors hover:text-slate-400"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="text-xs font-medium text-slate-400 transition-colors hover:text-slate-200"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
