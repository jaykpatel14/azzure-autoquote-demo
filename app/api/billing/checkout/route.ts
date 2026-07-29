import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext, AuthRequiredError, CompanyAccessError } from "@/lib/company";
import {
  buildAppUrl,
  getStripeClient,
  resolveCheckoutCustomerId,
  resolveCheckoutPriceId
} from "@/lib/stripe";

export const runtime = "nodejs";

const schema = z.object({
  planCode: z.string().trim().min(1).max(50)
});

async function parseInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return schema.parse(await request.json());
  }

  const formData = await request.formData();
  return schema.parse({
    planCode: formData.get("planCode")
  });
}

export async function POST(request: Request) {
  try {
    const context = await requireCompanyContext();
    const input = await parseInput(request);
    if (!context.company.subscription) {
      return NextResponse.json(
        { error: "Billing is not initialized for this company yet." },
        { status: 400 }
      );
    }

    const plan = await prisma.plan.findUnique({ where: { code: input.planCode } });

    if (!plan) {
      return NextResponse.json({ error: "Unknown billing plan." }, { status: 404 });
    }

    const checkoutPriceId = await resolveCheckoutPriceId(plan);

    if (!checkoutPriceId) {
      return NextResponse.json(
        {
          error:
            "This billing plan is not configured with a Stripe price. Use a price_ id, or attach a default recurring price to the product."
        },
        { status: 400 }
      );
    }

    const stripe = await getStripeClient();
    const stripeCustomerId = await resolveCheckoutCustomerId({
      stripe,
      stripeCustomerId: context.company.subscription.stripeCustomerId,
      email: context.user.email,
      companyName: context.company.name,
      companyId: context.company.id,
      planCode: plan.code,
      persistStripeCustomerId: async (customerId) => {
        await prisma.subscription.update({
          where: { companyId: context.company.id },
          data: { stripeCustomerId: customerId }
        });
      }
    });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [
        {
          price: checkoutPriceId,
          quantity: 1
        }
      ],
      allow_promotion_codes: true,
      success_url: buildAppUrl("/settings?billing=success&session_id={CHECKOUT_SESSION_ID}"),
      cancel_url: buildAppUrl("/settings?billing=cancel"),
      metadata: {
        companyId: context.company.id,
        planCode: plan.code
      },
      subscription_data: {
        metadata: {
          companyId: context.company.id,
          planCode: plan.code
        }
      }
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
    }

    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof CompanyAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid billing request." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start checkout." },
      { status: 400 }
    );
  }
}
