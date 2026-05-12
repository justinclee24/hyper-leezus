import { NextResponse } from "next/server";
import { getAllUsers } from "@/lib/db";
import { sendNewsletterEmail } from "@/lib/email";

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    subject: string;
    headline: string;
    bodyHtml: string;
    ctaLabel?: string;
    ctaUrl?: string;
    planFilter?: "all" | "free" | "pro";
  };

  const { subject, headline, bodyHtml, ctaLabel, ctaUrl, planFilter = "all" } = body;

  if (!subject || !headline || !bodyHtml) {
    return NextResponse.json({ error: "subject, headline, and bodyHtml are required" }, { status: 400 });
  }

  const users = await getAllUsers();
  const targets = planFilter === "all" ? users : users.filter((u) => u.plan === planFilter);

  let sent = 0;
  let failed = 0;

  // Send in batches of 10 to stay within rate limits
  for (let i = 0; i < targets.length; i += 10) {
    const batch = targets.slice(i, i + 10);
    await Promise.all(
      batch.map(async (u) => {
        try {
          await sendNewsletterEmail(u.email, u.name, subject, headline, bodyHtml, ctaLabel, ctaUrl);
          sent++;
        } catch {
          failed++;
        }
      }),
    );
  }

  return NextResponse.json({ sent, failed, total: targets.length });
}
