const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const FROM = process.env.EMAIL_FROM ?? "HyperLeezus <onboarding@resend.dev>";

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function send(to: string | string[], subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
  } catch {
    // non-fatal — never block a user action on email
  }
}

export async function sendPasswordResetEmail(toEmail: string, name: string, resetUrl: string): Promise<void> {
  await send(
    toEmail,
    "Reset your HyperLeezus password",
    `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#e2e8f0;background:#07101e;padding:32px;border-radius:12px">
      <h1 style="font-size:22px;font-weight:900;margin:0 0 4px">Reset your password</h1>
      <p style="color:#94a3b8;font-size:14px;margin:0 0 24px">Hi ${name} — click the link below to set a new password. This link expires in 1 hour.</p>
      <a href="${resetUrl}"
        style="display:inline-block;background:#f97316;color:#fff;font-weight:700;font-size:13px;padding:12px 24px;border-radius:8px;text-decoration:none">
        Reset Password →
      </a>
      <p style="font-size:12px;color:#475569;margin:24px 0 0">If you didn't request this, you can safely ignore this email.</p>
    </div>
    `,
  );
}

// ─── User-facing emails ───────────────────────────────────────────────────────

export async function sendWelcomeEmail(toEmail: string, name: string): Promise<void> {
  await send(
    toEmail,
    "Welcome to HyperLeezus 🏆",
    `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#e2e8f0;background:#07101e;padding:32px;border-radius:12px">
      <h1 style="font-size:22px;font-weight:900;margin:0 0 4px">Welcome, ${name}.</h1>
      <p style="color:#94a3b8;font-size:14px;margin:0 0 24px">You're in. Here's what HyperLeezus gives you.</p>

      <p style="font-size:14px;margin:0 0 16px">Your free account includes a daily preview of our top AI-generated picks — spread, moneyline, and totals powered by a multi-signal model that reads market consensus, team win rates, streaks, and pace data.</p>

      <div style="background:#0f1f35;border:1px solid rgba(249,115,22,0.2);border-radius:10px;padding:20px;margin:0 0 24px">
        <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#f97316;margin:0 0 12px">Upgrade to Pro — $9.99/mo</p>
        <ul style="font-size:13px;color:#cbd5e1;padding:0 0 0 16px;margin:0;line-height:2">
          <li>All picks across every league — no daily limit</li>
          <li>One-tap to DraftKings or Polymarket from each pick</li>
          <li>AI parlay suggestions combining your top edges</li>
          <li>Per-game model breakdown with edge % and reasoning</li>
          <li>Futures &amp; championship predictions</li>
          <li>Full bet tracking with P&amp;L history and ROI analytics</li>
        </ul>
      </div>

      <a href="${process.env.NEXT_PUBLIC_URL ?? ""}/upgrade"
        style="display:inline-block;background:#f97316;color:#fff;font-weight:700;font-size:13px;padding:12px 24px;border-radius:8px;text-decoration:none">
        Upgrade to Pro →
      </a>

      <p style="font-size:12px;color:#475569;margin:24px 0 0">Questions? Reply to this email anytime.</p>
    </div>
    `,
  );
}

export async function sendProConfirmationEmail(toEmail: string, name: string): Promise<void> {
  await send(
    toEmail,
    "You're now Pro on HyperLeezus ⚡",
    `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#e2e8f0;background:#07101e;padding:32px;border-radius:12px">
      <h1 style="font-size:22px;font-weight:900;margin:0 0 4px">Pro unlocked, ${name}.</h1>
      <p style="color:#94a3b8;font-size:14px;margin:0 0 24px">Every pick, every edge, every tool — fully yours.</p>

      <p style="font-size:14px;margin:0 0 24px">Head to the dashboard to see all picks, or go straight to the Analytics page to start tracking your bets and building your P&L history.</p>

      <a href="${process.env.NEXT_PUBLIC_URL ?? ""}"
        style="display:inline-block;background:#f97316;color:#fff;font-weight:700;font-size:13px;padding:12px 24px;border-radius:8px;text-decoration:none;margin-right:12px">
        View Today's Edges →
      </a>
      <a href="${process.env.NEXT_PUBLIC_URL ?? ""}/bets"
        style="display:inline-block;background:rgba(255,255,255,0.07);color:#e2e8f0;font-weight:700;font-size:13px;padding:12px 24px;border-radius:8px;text-decoration:none">
        Analytics
      </a>

      <p style="font-size:12px;color:#475569;margin:24px 0 0">Manage or cancel your subscription anytime through Stripe.</p>
    </div>
    `,
  );
}

// ─── Admin notifications ──────────────────────────────────────────────────────

export async function notifyAdminNewSignup(userEmail: string, userName: string): Promise<void> {
  const admins = adminEmails();
  if (!admins.length) return;
  await send(
    admins,
    `New signup: ${userName}`,
    `<p style="font-family:sans-serif;font-size:14px"><strong>${userName}</strong> (${userEmail}) just created an account on HyperLeezus.</p>`,
  );
}

export async function notifyAdminProUpgrade(userEmail: string, userName: string, method: "stripe" | "crypto"): Promise<void> {
  const admins = adminEmails();
  if (!admins.length) return;
  await send(
    admins,
    `Pro upgrade: ${userName}`,
    `<p style="font-family:sans-serif;font-size:14px"><strong>${userName}</strong> (${userEmail}) upgraded to Pro via <strong>${method}</strong>.</p>`,
  );
}

export async function notifyAdminBetTracked(
  userEmail: string,
  userName: string,
  pick: string,
  betType: string,
  odds: string,
  matchup: string,
  league: string,
): Promise<void> {
  const admins = adminEmails();
  if (!admins.length) return;
  await send(
    admins,
    `Bet tracked: ${pick} (${league})`,
    `
    <p style="font-family:sans-serif;font-size:14px;margin:0 0 8px">
      <strong>${userName}</strong> (${userEmail}) tracked a bet:
    </p>
    <table style="font-family:sans-serif;font-size:13px;border-collapse:collapse">
      <tr><td style="color:#94a3b8;padding:2px 12px 2px 0">Matchup</td><td>${matchup}</td></tr>
      <tr><td style="color:#94a3b8;padding:2px 12px 2px 0">Pick</td><td><strong>${pick}</strong></td></tr>
      <tr><td style="color:#94a3b8;padding:2px 12px 2px 0">Type</td><td>${betType}</td></tr>
      <tr><td style="color:#94a3b8;padding:2px 12px 2px 0">Odds</td><td>${odds}</td></tr>
      <tr><td style="color:#94a3b8;padding:2px 12px 2px 0">League</td><td>${league}</td></tr>
    </table>
    `,
  );
}
