const COOKIE_NAME = "hl-session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

function getSecret(): string {
  return process.env.AUTH_SECRET ?? "hyper-leezus-dev-secret-change-in-prod";
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  const payload = btoa(
    JSON.stringify({ ...user, exp: Date.now() + MAX_AGE * 1000 }),
  );
  const sig = await hmacSign(payload, getSecret());
  return `${payload}.${sig}`;
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expectedSig = await hmacSign(payload, getSecret());
    if (sig !== expectedSig) return null;
    const data = JSON.parse(atob(payload));
    if (!data.exp || data.exp < Date.now()) return null;
    return { id: data.id, email: data.email, name: data.name };
  } catch {
    return null;
  }
}

// Demo credentials — replace with DB lookup in production
const DEMO_USERS = [
  { id: "1", email: "demo@hyper.bet", password: "demo123", name: "Demo User" },
];

export function validateCredentials(email: string, password: string): SessionUser | null {
  const user = DEMO_USERS.find((u) => u.email === email && u.password === password);
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name };
}

export { COOKIE_NAME, MAX_AGE };
