import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSessionToken, COOKIE_NAME, MAX_AGE } from "@/lib/auth";
import { findUserByEmail } from "@/lib/db";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const user = await findUserByEmail(email.toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await createSessionToken({ id: user.id, email: user.email, name: user.name });
  const resp = NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
  resp.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
  return resp;
}
