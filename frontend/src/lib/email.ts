const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const FROM = process.env.EMAIL_FROM ?? "HyperLeezus <onboarding@resend.dev>";
const APP_URL = (process.env.NEXT_PUBLIC_URL ?? "https://hyperleez.us").replace(/\/$/, "");

// ─── Shared email shell ───────────────────────────────────────────────────────
// Email-safe HTML: tables for layout, inline styles only, no flex/grid.

function shell(body: string): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background-color:#040d17;">
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#040d17;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;">
  <!-- Header -->
  <tr>
    <td style="background:#07101e;border-radius:14px 14px 0 0;padding:22px 32px;border-bottom:1px solid rgba(249,115,22,0.45);">
      <span style="font-size:20px;font-weight:900;letter-spacing:-0.01em;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">HYPER</span><span style="font-size:20px;font-weight:900;letter-spacing:-0.01em;color:#f97316;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">LEEZUS</span>
    </td>
  </tr>
  <!-- Body -->
  <tr>
    <td style="background:#07101e;padding:36px 32px;border-left:1px solid rgba(255,255,255,0.05);border-right:1px solid rgba(255,255,255,0.05);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
      ${body}
    </td>
  </tr>
  <!-- Footer -->
  <tr>
    <td style="background:#050d1a;border-radius:0 0 14px 14px;padding:18px 32px;border:1px solid rgba(255,255,255,0.04);border-top:none;text-align:center;">
      <p style="font-size:11px;color:#334155;margin:0;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
        &copy; 2025 HyperLeezus &nbsp;&bull;&nbsp; hyperleez.us<br/>
        You received this because you have an account on HyperLeezus.
      </p>
    </td>
  </tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function featureRow(text: string, color = "#f97316"): string {
  return `<tr>
    <td width="18" style="color:${color};font-size:13px;padding:4px 10px 4px 0;vertical-align:top;line-height:1.5;">&rsaquo;</td>
    <td style="color:#cbd5e1;font-size:13px;padding:4px 0;line-height:1.6;">${text}</td>
  </tr>`;
}

function checkRow(text: string): string {
  return `<tr>
    <td width="18" style="color:#22c55e;font-size:13px;padding:4px 10px 4px 0;vertical-align:top;line-height:1.5;">&#10003;</td>
    <td style="color:#cbd5e1;font-size:13px;padding:4px 0;line-height:1.6;">${text}</td>
  </tr>`;
}

function ctaButton(href: string, label: string, primary = true): string {
  return primary
    ? `<a href="${href}" style="display:inline-block;background:#f97316;color:#ffffff;font-size:14px;font-weight:700;padding:14px 28px;border-radius:8px;text-decoration:none;letter-spacing:0.01em;">${label}</a>`
    : `<a href="${href}" style="display:inline-block;background:rgba(255,255,255,0.08);color:#e2e8f0;font-size:14px;font-weight:700;padding:14px 24px;border-radius:8px;text-decoration:none;">${label}</a>`;
}

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
    shell(`
      <h1 style="font-size:26px;font-weight:900;color:#f1f5f9;margin:0 0 8px;letter-spacing:-0.02em;">Reset your password</h1>
      <p style="font-size:14px;color:#94a3b8;margin:0 0 28px;line-height:1.6;">
        Hi ${name} &mdash; someone requested a password reset for your HyperLeezus account.
        Click the button below to set a new password. This link expires in <strong style="color:#f1f5f9;">1 hour</strong>.
      </p>

      ${ctaButton(resetUrl, "Set New Password &rarr;")}

      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#0a1628;border:1px solid rgba(255,255,255,0.07);border-radius:9px;margin:28px 0 0;">
        <tr>
          <td style="padding:16px 20px;">
            <p style="font-size:12px;color:#64748b;margin:0;line-height:1.65;">
              <strong style="color:#94a3b8;">Didn&apos;t request this?</strong>
              You can safely ignore this email &mdash; your password won&apos;t change unless you click the link above.
              If you&apos;re concerned, reply to this email and we&apos;ll help.
            </p>
          </td>
        </tr>
      </table>
    `),
  );
}

// ─── User-facing emails ───────────────────────────────────────────────────────

export async function sendWelcomeEmail(toEmail: string, name: string): Promise<void> {
  await send(
    toEmail,
    "Welcome to HyperLeezus",
    shell(`
      <h1 style="font-size:28px;font-weight:900;color:#f1f5f9;margin:0 0 8px;letter-spacing:-0.02em;">Welcome, ${name}.</h1>
      <p style="font-size:14px;color:#94a3b8;margin:0 0 28px;line-height:1.65;">
        You&apos;re in. HyperLeezus uses a multi-signal AI model to surface sharp edges across every major sport &mdash;
        factoring in market consensus, team form, rest schedules, injury reports, and pitcher/goalie data before the lines move.
      </p>

      <!-- Free features card -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#0f1f35;border:1px solid rgba(255,255,255,0.08);border-radius:10px;margin:0 0 16px;">
        <tr><td style="padding:20px 24px;">
          <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#94a3b8;margin:0 0 14px;">Your free account includes</p>
          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
            ${featureRow("Daily preview of today&apos;s top picks &mdash; spread, moneyline &amp; totals")}
            ${featureRow("Standings, stats &amp; injury reports across all major leagues")}
            ${featureRow("Multi-source news feed &mdash; ESPN, Reddit, and more")}
            ${featureRow("Bet tracker to log your picks and follow your P&amp;L")}
          </table>
        </td></tr>
      </table>

      <!-- Pro upsell card -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:rgba(249,115,22,0.05);border:1px solid rgba(249,115,22,0.25);border-radius:10px;margin:0 0 28px;">
        <tr><td style="padding:20px 24px;">
          <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#f97316;margin:0 0 14px;">Upgrade to Pro &mdash; $9.99/mo</p>
          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
            ${checkRow("All picks across every league &mdash; no daily limit")}
            ${checkRow("Per-game edge breakdown with full AI reasoning")}
            ${checkRow("One-tap to DraftKings or Polymarket from every pick")}
            ${checkRow("Full P&amp;L history, win rate &amp; ROI analytics")}
            ${checkRow("Futures &amp; playoff bracket predictions")}
          </table>
        </td></tr>
      </table>

      ${ctaButton(`${APP_URL}/upgrade`, "Upgrade to Pro &rarr;")}

      <p style="font-size:12px;color:#475569;margin:24px 0 0;line-height:1.6;">
        Questions? Reply to this email anytime &mdash; we read every message.
      </p>
    `),
  );
}

export async function sendProConfirmationEmail(toEmail: string, name: string): Promise<void> {
  await send(
    toEmail,
    "You're Pro on HyperLeezus",
    shell(`
      <h1 style="font-size:28px;font-weight:900;color:#f1f5f9;margin:0 0 8px;letter-spacing:-0.02em;">You&apos;re Pro, ${name}.</h1>
      <p style="font-size:14px;color:#94a3b8;margin:0 0 28px;line-height:1.65;">
        Your subscription is active. Every pick, every edge, every tool &mdash; fully unlocked.
      </p>

      <!-- Unlocked features card -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:rgba(34,197,94,0.04);border:1px solid rgba(34,197,94,0.18);border-radius:10px;margin:0 0 28px;">
        <tr><td style="padding:20px 24px;">
          <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#22c55e;margin:0 0 14px;">Unlocked for you</p>
          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
            ${checkRow("All picks across every league &mdash; no daily limit")}
            ${checkRow("Per-game edge breakdown with full AI reasoning")}
            ${checkRow("One-tap to DraftKings or Polymarket from every pick")}
            ${checkRow("Full P&amp;L history, win rate &amp; ROI analytics")}
            ${checkRow("Futures &amp; playoff bracket predictions")}
          </table>
        </td></tr>
      </table>

      <!-- Dual CTAs -->
      <table role="presentation" border="0" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-right:12px;">${ctaButton(APP_URL, "View Today&apos;s Edges &rarr;")}</td>
          <td>${ctaButton(`${APP_URL}/bets`, "Analytics", false)}</td>
        </tr>
      </table>

      <p style="font-size:12px;color:#475569;margin:24px 0 0;line-height:1.6;">
        Manage or cancel your subscription anytime from your account settings.
      </p>
    `),
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
    shell(`
      <h1 style="font-size:22px;font-weight:900;color:#f1f5f9;margin:0 0 6px;letter-spacing:-0.02em;">New bet tracked</h1>
      <p style="font-size:13px;color:#94a3b8;margin:0 0 24px;line-height:1.5;">
        <strong style="color:#f1f5f9;">${userName}</strong> &nbsp;&bull;&nbsp; ${userEmail}
      </p>

      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#0a1628;border:1px solid rgba(255,255,255,0.07);border-radius:9px;margin:0 0 20px;">
        <tr><td style="padding:18px 22px;">
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="color:#64748b;font-size:12px;padding:5px 16px 5px 0;vertical-align:top;white-space:nowrap;">Matchup</td>
              <td style="color:#cbd5e1;font-size:13px;padding:5px 0;font-weight:600;">${matchup}</td>
            </tr>
            <tr>
              <td style="color:#64748b;font-size:12px;padding:5px 16px 5px 0;vertical-align:top;white-space:nowrap;">Pick</td>
              <td style="color:#f97316;font-size:13px;padding:5px 0;font-weight:700;">${pick}</td>
            </tr>
            <tr>
              <td style="color:#64748b;font-size:12px;padding:5px 16px 5px 0;vertical-align:top;white-space:nowrap;">Type</td>
              <td style="color:#cbd5e1;font-size:13px;padding:5px 0;">${betType}</td>
            </tr>
            <tr>
              <td style="color:#64748b;font-size:12px;padding:5px 16px 5px 0;vertical-align:top;white-space:nowrap;">Odds</td>
              <td style="color:#cbd5e1;font-size:13px;padding:5px 0;">${odds}</td>
            </tr>
            <tr>
              <td style="color:#64748b;font-size:12px;padding:5px 16px 5px 0;vertical-align:top;white-space:nowrap;">League</td>
              <td style="color:#cbd5e1;font-size:13px;padding:5px 0;">${league}</td>
            </tr>
          </table>
        </td></tr>
      </table>

      ${ctaButton(`${APP_URL}/admin`, "View Admin Dashboard &rarr;")}
    `),
  );
}

export async function sendBetTrackedEmail(
  toEmail: string,
  name: string,
  pick: string,
  betType: string,
  odds: string,
  matchup: string,
  league: string,
  gameDate?: string,
): Promise<void> {
  const gameDateStr = gameDate
    ? new Date(gameDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : null;

  await send(
    toEmail,
    `Bet tracked: ${pick}`,
    shell(`
      <h1 style="font-size:26px;font-weight:900;color:#f1f5f9;margin:0 0 6px;letter-spacing:-0.02em;">Bet confirmed</h1>
      <p style="font-size:14px;color:#94a3b8;margin:0 0 28px;line-height:1.6;">
        Hi ${name} &mdash; your pick has been logged to your bet tracker.
      </p>

      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:#0f1f35;border:1px solid rgba(249,115,22,0.2);border-radius:10px;margin:0 0 24px;">
        <tr><td style="padding:22px 26px;">
          <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#f97316;margin:0 0 16px;">${league} &nbsp;&bull;&nbsp; ${betType}</p>
          <p style="font-size:22px;font-weight:900;color:#f1f5f9;margin:0 0 4px;letter-spacing:-0.01em;">${pick}</p>
          <p style="font-size:13px;color:#64748b;margin:0 0 16px;">${matchup}${gameDateStr ? ` &nbsp;&bull;&nbsp; ${gameDateStr}` : ""}</p>
          <table role="presentation" border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-right:32px;">
                <p style="font-size:11px;color:#64748b;margin:0 0 2px;text-transform:uppercase;letter-spacing:0.08em;">Odds</p>
                <p style="font-size:16px;font-weight:700;color:#cbd5e1;margin:0;">${odds}</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>

      <table role="presentation" border="0" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding-right:12px;">${ctaButton(`${APP_URL}/bets`, "View Bet Tracker &rarr;")}</td>
          <td>${ctaButton(APP_URL, "Today&apos;s Edges", false)}</td>
        </tr>
      </table>

      <p style="font-size:12px;color:#475569;margin:24px 0 0;line-height:1.6;">
        Update your bet result anytime from the tracker once the game concludes.
      </p>
    `),
  );
}

// ─── Newsletter ───────────────────────────────────────────────────────────────

export async function sendNewsletterEmail(
  toEmail: string,
  name: string,
  subject: string,
  headline: string,
  bodyHtml: string,
  ctaLabel?: string,
  ctaUrl?: string,
): Promise<void> {
  const cta = ctaLabel && ctaUrl
    ? `<table role="presentation" border="0" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">\n        <tr><td>${ctaButton(ctaUrl, ctaLabel)}</td></tr>\n      </table>`
    : "";

  await send(
    toEmail,
    subject,
    shell(`
      <h1 style="font-size:26px;font-weight:900;color:#f1f5f9;margin:0 0 20px;letter-spacing:-0.02em;">${headline}</h1>

      <div style="font-size:14px;color:#94a3b8;line-height:1.75;">
        ${bodyHtml}
      </div>

      ${cta}

      <p style="font-size:12px;color:#475569;margin:28px 0 0;line-height:1.6;">
        You&apos;re receiving this as a HyperLeezus member, ${name}.
        To unsubscribe, manage your preferences in account settings.
      </p>
    `),
  );
}
