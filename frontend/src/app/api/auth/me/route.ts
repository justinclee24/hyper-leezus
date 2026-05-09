import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";
import { getUserPlan } from "@/lib/db";

function resolvedPlan(email: string, dbPlan: string): string {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase()) ? "admin" : dbPlan;
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ user: null });
  const user = await verifySessionToken(token);
  if (!user) return NextResponse.json({ user: null });

  // Re-read plan from DB so upgrades and admin grants take effect without re-login.
  // Fall back to the session-token plan if the DB is unavailable — ADMIN_EMAILS still applies.
  let dbPlan = user.plan ?? "free";
  try {
    dbPlan = await getUserPlan(user.id);
  } catch {
    // non-fatal: session plan used as fallback
  }
  const plan = resolvedPlan(user.email, dbPlan);

  return NextResponse.json({ user: { ...user, plan } });
}
