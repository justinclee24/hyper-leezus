import { cookies } from "next/headers";
import { verifySessionToken, COOKIE_NAME } from "./auth";
import type { SessionUser } from "./auth";

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
