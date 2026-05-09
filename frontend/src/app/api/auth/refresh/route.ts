import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySessionToken, createSessionToken, COOKIE_NAME, MAX_AGE } from "@/lib/auth";
import { getUserPlan } from "@/lib/db";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const user = await verifySessionToken(token);
  if (!user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  // Re-fetch plan from DB so it reflects the latest subscription status
  const plan = await getUserPlan(user.id);
  const newToken = await createSessionToken({ id: user.id, email: user.email, name: user.name, plan });

  const resp = NextResponse.json({ user: { ...user, plan } });
  resp.cookies.set(COOKIE_NAME, newToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
  return resp;
}
