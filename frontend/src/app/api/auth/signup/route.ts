import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSessionToken, COOKIE_NAME, MAX_AGE } from "@/lib/auth";
import { createUser, findUserByEmail } from "@/lib/db";
import { sendWelcomeEmail, notifyAdminNewSignup } from "@/lib/email";

export async function POST(req: Request) {
  const { email, name, password } = await req.json();

  if (!email || !name || !password) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const existing = await findUserByEmail(email.toLowerCase());
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await createUser(email.toLowerCase(), name, passwordHash);

  void sendWelcomeEmail(user.email, user.name);
  void notifyAdminNewSignup(user.email, user.name);

  const token = await createSessionToken({ id: user.id, email: user.email, name: user.name, plan: user.plan ?? "free" });
  const resp = NextResponse.json({ user }, { status: 201 });
  resp.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
  return resp;
}
