import { getStripeClient } from "@/lib/stripe";

export async function recordQuoteOverage(params: { stripeCustomerId: string | null; analysisId: string }) {
  const eventName = process.env.STRIPE_QUOTE_OVERAGE_METER_EVENT_NAME?.trim();
  if (!eventName || !params.stripeCustomerId) {
    throw new Error("Stripe overage metering is not configured for this subscription.");
  }
  const stripe = await getStripeClient();
  await stripe.billing.meterEvents.create({
    event_name: eventName,
    identifier: `quote-overage-${params.analysisId}`,
    payload: { stripe_customer_id: params.stripeCustomerId, value: "1" }
  });
}
