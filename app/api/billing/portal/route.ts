import { NextResponse } from "next/server";
import { requireCompanyContext, AuthRequiredError, CompanyAccessError } from "@/lib/company";
import { buildAppUrl, getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST() {
  try {
    const context = await requireCompanyContext("ADMIN");
    if (!context.company.subscription) {
      return NextResponse.json(
        { error: "Billing is not initialized for this company yet." },
        { status: 400 }
      );
    }

    const customerId = context.company.subscription.stripeCustomerId;

    if (!customerId) {
      return NextResponse.json(
        { error: "Billing portal is available after your first Stripe subscription is created." },
        { status: 400 }
      );
    }

    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: buildAppUrl("/settings")
    });

    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof CompanyAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to open billing portal." },
      { status: 400 }
    );
  }
}
