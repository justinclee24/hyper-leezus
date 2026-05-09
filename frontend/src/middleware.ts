import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, COOKIE_NAME } from "@/lib/auth";

const ADMIN_EMAIL = "justinclee24@gmail.com";
const PRO_ROUTES = ["/bets"];

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const user = token ? await verifySessionToken(token) : null;

  if (!user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin always has access
  if (user.email === ADMIN_EMAIL) return NextResponse.next();

  const path = req.nextUrl.pathname;
  const requiresPro = PRO_ROUTES.some((r) => path.startsWith(r));
  if (requiresPro && user.plan !== "pro") {
    return NextResponse.redirect(new URL("/upgrade", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/bets/:path*"],
};
