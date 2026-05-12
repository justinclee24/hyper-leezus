const COOKIE_NAME = "hl-session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  plan: string;
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
    return { id: data.id, email: data.email, name: data.name, plan: data.plan ?? "free" };
  } catch {
    return null;
  }
}

const RESET_TTL = 60 * 60 * 1000; // 1 hour

export async function createResetToken(userId: string, email: string): Promise<string> {
  const payload = btoa(
    JSON.stringify({ id: userId, email, purpose: "reset", exp: Date.now() + RESET_TTL }),
  );
  const sig = await hmacSign(payload, getSecret());
  return `${payload}.${sig}`;
}

export async function verifyResetToken(token: string): Promise<{ id: string; email: string } | null> {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expectedSig = await hmacSign(payload, getSecret());
    if (sig !== expectedSig) return null;
    const data = JSON.parse(atob(payload));
    if (data.purpose !== "reset") return null;
    if (!data.exp || data.exp < Date.now()) return null;
    return { id: data.id, email: data.email };
  } catch {
    return null;
  }
}

export { COOKIE_NAME, MAX_AGE };
