import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { verifyResetToken } from "@/lib/auth";
import { updateUserPassword } from "@/lib/db";

export async function POST(req: Request) {
  const { token, password } = await req.json();
  if (!token || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

  const data = await verifyResetToken(token);
  if (!data) return NextResponse.json({ error: "This reset link is invalid or has expired" }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 12);
  await updateUserPassword(data.id, passwordHash);

  return NextResponse.json({ success: true });
}
