import { NextRequest, NextResponse } from "next/server";
import { updateUserPlan } from "@/lib/db";
import { sendProConfirmationEmail, notifyAdminProUpgrade } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    return new NextResponse("Stripe not configured", { status: 503 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  const { default: Stripe } = await import("stripe");
  const stripe = new Stripe(secretKey);

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return new NextResponse("Webhook signature verification failed", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as { metadata?: { userId?: string }; customer_email?: string | null };
    const userId = session.metadata?.userId;
    if (userId) {
      await updateUserPlan(userId, "pro");
      const userEmail = session.customer_email ?? "";
      if (userEmail) {
        const { findUserByEmail } = await import("@/lib/db");
        const u = await findUserByEmail(userEmail).catch(() => null);
        const name = u?.name ?? userEmail;
        void sendProConfirmationEmail(userEmail, name);
        void notifyAdminProUpgrade(userEmail, name, "stripe");
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    // Downgrade: look up user via customer email, then downgrade plan
    const sub = event.data.object as { customer?: string };
    if (sub.customer) {
      try {
        const customer = await stripe.customers.retrieve(sub.customer as string) as { email?: string | null };
        if (customer.email) {
          const { findUserByEmail } = await import("@/lib/db");
          const user = await findUserByEmail(customer.email);
          if (user) await updateUserPlan(user.id, "free");
        }
      } catch {
        // Non-fatal — manual intervention may be needed
      }
    }
  }

  return new NextResponse("OK", { status: 200 });
}
