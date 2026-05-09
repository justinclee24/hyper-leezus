"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { TrendingUp, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

interface NavUser {
  name: string;
  email: string;
}

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/stats", label: "Statistics" },
  { href: "/futures", label: "Futures" },
  { href: "/bets", label: "Analytics" },
  { href: "/methodology", label: "How It Works" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<NavUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user ?? null))
      .catch(() => {});
  }, [pathname]);

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  async function handleSignOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.05] bg-[#030810]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-orange-500" />
          <span className="text-base font-black tracking-tighter">
            HYPER<span className="text-orange-500">LEEZUS</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden gap-6 text-sm font-medium md:flex">
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

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-1.5 rounded-md border border-orange-500/20 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-400 sm:flex">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" />
            LIVE
          </div>

          {/* Desktop user */}
          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <>
                <span className="hidden text-xs text-slate-500 lg:inline">{user.name}</span>
                <button
                  onClick={handleSignOut}
                  className="text-xs text-slate-600 transition-colors hover:text-slate-400"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="text-xs font-medium text-slate-400 transition-colors hover:text-slate-200"
              >
                Sign in
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white md:hidden"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="border-t border-white/[0.05] bg-[#030810] px-4 pb-4 pt-2 md:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? "bg-orange-500/10 text-orange-400"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 border-t border-white/[0.05] pt-3">
            {user ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">{user.name}</span>
                <button
                  onClick={handleSignOut}
                  className="text-xs text-slate-600 hover:text-slate-400"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="block text-sm font-medium text-orange-400 hover:text-orange-300"
              >
                Sign in →
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
