import { NextResponse } from "next/server";
import { fetchUpcomingGames, derivePicks, activeSeasonSports } from "@/lib/odds";
import { fetchNews } from "@/lib/espn";
import { getAllUsers } from "@/lib/db";
import { sendNewsletterEmail } from "@/lib/email";
import type { BetRecommendation } from "@/lib/data";
import type { NewsItem } from "@/lib/espn";

const APP_URL = (process.env.NEXT_PUBLIC_URL ?? "https://hyperleez.us").replace(/\/$/, "");

// ─── HTML builders ────────────────────────────────────────────────────────────

function picksHtml(picks: BetRecommendation[]): string {
  if (!picks.length) return "";

  const rows = picks
    .map((p) => {
      const edgePct = Math.round(p.edge * 100);
      const hotBadge = p.hot
        ? `<span style="font-size:9px;font-weight:700;background:rgba(249,115,22,0.15);color:#f97316;border:1px solid rgba(249,115,22,0.3);border-radius:4px;padding:1px 6px;margin-left:6px;">HOT</span>`
        : "";
      const reasoning = p.reasoning
        ? `<tr><td colspan="2" style="padding-top:5px;"><p style="font-size:11px;color:#475569;margin:0;line-height:1.55;">${p.reasoning}</p></td></tr>`
        : "";
      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="vertical-align:top;padding-right:12px;">
                  <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;">${p.league} &middot; ${p.betType}</span>
                  <p style="font-size:14px;font-weight:700;color:#f1f5f9;margin:3px 0 2px;">${p.pick}${hotBadge}</p>
                  <p style="font-size:11px;color:#64748b;margin:0;">${p.matchup}</p>
                </td>
                <td style="text-align:right;vertical-align:top;white-space:nowrap;">
                  <p style="font-size:13px;font-weight:700;color:#cbd5e1;margin:0 0 3px;">${p.odds}</p>
                  <p style="font-size:12px;font-weight:700;color:#22c55e;margin:0;">${edgePct}% edge</p>
                </td>
              </tr>
              ${reasoning}
            </table>
          </td>
        </tr>`;
    })
    .join("");

  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
      style="background:#0a1628;border:1px solid rgba(249,115,22,0.2);border-radius:10px;margin:0 0 24px;">
      <tr><td style="padding:20px 24px;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#f97316;margin:0 0 4px;">
          Top Edges This Week
        </p>
        <p style="font-size:12px;color:#475569;margin:0 0 16px;">Highest-conviction picks from the model right now</p>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          ${rows}
        </table>
      </td></tr>
    </table>`;
}

function newsHtml(items: NewsItem[]): string {
  if (!items.length) return "";

  const rows = items
    .map((item) => {
      const sourceLabel =
        item.source === "Reddit" && item.subreddit
          ? `r/${item.subreddit}`
          : item.source === "NewsAPI" && item.outlet
          ? item.outlet
          : item.source ?? "ESPN";
      const desc = item.description
        ? `<p style="font-size:12px;color:#475569;margin:3px 0 0;line-height:1.5;">${item.description.slice(0, 130)}${item.description.length > 130 ? "&hellip;" : ""}</p>`
        : "";
      const headline = item.url
        ? `<a href="${item.url}" style="font-size:13px;font-weight:600;color:#cbd5e1;text-decoration:none;">${item.headline}</a>`
        : `<span style="font-size:13px;font-weight:600;color:#cbd5e1;">${item.headline}</span>`;
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <span style="font-size:10px;color:#64748b;">${sourceLabel}</span>
            <p style="margin:3px 0 0;">${headline}</p>
            ${desc}
          </td>
        </tr>`;
    })
    .join("");

  return `
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%"
      style="background:#0f1f35;border:1px solid rgba(255,255,255,0.07);border-radius:10px;margin:0 0 24px;">
      <tr><td style="padding:20px 24px;">
        <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#94a3b8;margin:0 0 16px;">
          Around the Leagues
        </p>
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          ${rows}
        </table>
      </td></tr>
    </table>`;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { planFilter?: string };
  const planFilter = body.planFilter ?? "all";

  // Fetch picks and news in parallel
  const activeLeagues = Object.values(activeSeasonSports()).slice(0, 4);

  const [games, newsArrays] = await Promise.all([
    fetchUpcomingGames(),
    Promise.all(activeLeagues.map((l) => fetchNews(l))),
  ]);

  const picks = derivePicks(games).slice(0, 5);
  const news = newsArrays
    .flat()
    .sort((a, b) => {
      const ta = a.published ? new Date(a.published).getTime() : 0;
      const tb = b.published ? new Date(b.published).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 5);

  if (!picks.length && !news.length) {
    return NextResponse.json({ error: "No content available to send" }, { status: 422 });
  }

  const dateStr = new Date().toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  const subject = `HyperLeezus Weekly · ${dateStr}`;
  const headline = `This week&apos;s edges &amp; news`;
  const bodyHtml = `
    <p style="font-size:14px;color:#94a3b8;margin:0 0 24px;line-height:1.65;">
      Your weekly digest &mdash; the top model-flagged edges and what&apos;s happening around the leagues.
    </p>
    ${picksHtml(picks)}
    ${newsHtml(news)}
  `;

  const users = await getAllUsers();
  const targets = planFilter === "all" ? users : users.filter((u) => u.plan === planFilter);

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i += 10) {
    const batch = targets.slice(i, i + 10);
    await Promise.all(
      batch.map(async (u) => {
        try {
          await sendNewsletterEmail(
            u.email, u.name, subject, headline, bodyHtml,
            "View Today’s Edges →", APP_URL,
          );
          sent++;
        } catch {
          failed++;
        }
      }),
    );
  }

  return NextResponse.json({
    sent, failed, total: targets.length,
    picks: picks.length, news: news.length,
  });
}
