import { NextResponse } from "next/server";
import { createSessionToken, validateCredentials, COOKIE_NAME, MAX_AGE } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const user = validateCredentials(email, password);
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const token = await createSessionToken(user);
  const resp = NextResponse.json({ user });
  resp.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
  return resp;
}
