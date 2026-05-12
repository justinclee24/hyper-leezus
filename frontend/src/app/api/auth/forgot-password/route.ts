import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/db";
import { createResetToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  // Always return success — never reveal whether an email exists
  try {
    const user = await findUserByEmail(email.toLowerCase());
    if (user) {
      const token = await createResetToken(user.id, user.email);
      const resetUrl = `${process.env.NEXT_PUBLIC_URL ?? ""}/reset-password?token=${encodeURIComponent(token)}`;
      void sendPasswordResetEmail(user.email, user.name, resetUrl);
    }
  } catch {
    // swallow — still return success
  }

  return NextResponse.json({ success: true });
}
