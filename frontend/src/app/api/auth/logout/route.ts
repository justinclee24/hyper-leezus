import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  const resp = NextResponse.json({ ok: true });
  resp.cookies.delete(COOKIE_NAME);
  return resp;
}
