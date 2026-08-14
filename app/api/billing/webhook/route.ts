import { NextResponse } from "next/server";
import { getStripeClient, getStripeWebhookSecret } from "@/lib/stripe";
import { processStripeWebhookEvent } from "@/lib/billing-webhooks";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const body = await request.text();

  try {
    const stripe = await getStripeClient();
    const event = stripe.webhooks.constructEvent(body, signature, await getStripeWebhookSecret());

    try {
      await processStripeWebhookEvent(event, { stripe });
    } catch (error) {
      logger.error("Stripe webhook handler failed", {
        eventType: event.type,
        error
      });

      return NextResponse.json({ error: "Handler failed." }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.warn("Stripe webhook signature validation failed", {
      error
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed." },
      { status: 400 }
    );
  }
}
