import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageBilling, requireCompanyContext } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";
import { createCheckoutSession } from "@/src/services/subscriptions";
import { getPlanRank, PLAN_STRIPE_PRICE_IDS } from "@/src/stripe/plans";
import { buildPublicUrl } from "@/lib/security";

const changeSchema = z.object({
  planCode: z.enum(["starter", "professional", "enterprise"])
});

export async function POST(request: Request) {
  try {
    const context = await requireCompanyContext();
    if (!canManageBilling(context.membership?.role ?? "CUSTOMER")) {
      return NextResponse.json({ error: "You do not have permission to manage billing." }, { status: 403 });
    }

    const formData = await request.formData();
    const input = changeSchema.parse({
      planCode: String(formData.get("planCode") ?? "")
    });

    const subscription = context.company.subscription;
    const targetPlan = await prisma.plan.findUnique({ where: { code: input.planCode } });
    if (!targetPlan) {
      return NextResponse.json({ error: "Billing plan not found." }, { status: 404 });
    }

    if (!subscription) {
      const checkout = await createCheckoutSession({
        companyId: context.company.id,
        companyName: context.company.name,
        email: context.user.email,
        planCode: targetPlan.code
      });

      if ("error" in checkout) {
        return NextResponse.json({ error: checkout.error.userMessage }, { status: 409 });
      }

      return NextResponse.redirect(checkout.data.url, 303);
    }

    if (subscription.status === "TRIALING") {
      const checkout = await createCheckoutSession({
        companyId: context.company.id,
        companyName: context.company.name,
        email: context.user.email,
        planCode: targetPlan.code
      });

      if ("error" in checkout) {
        return NextResponse.json({ error: checkout.error.userMessage }, { status: 409 });
      }

      return NextResponse.redirect(checkout.data.url, 303);
    }

    const currentPlan = subscription.plan;
    const targetPlanCode = input.planCode;
    const targetRank = getPlanRank(targetPlanCode);
    const currentRank = getPlanRank(currentPlan.code);

    const stripeSubscriptionId = subscription.stripeSubscriptionId;
    if (!stripeSubscriptionId) {
      return NextResponse.json({ error: "Stripe subscription is not connected." }, { status: 409 });
    }

    const priceId = PLAN_STRIPE_PRICE_IDS[targetPlanCode];
    if (!priceId) {
      return NextResponse.json(
        { error: "This plan is missing a Stripe price id. Configure the env var first." },
        { status: 409 }
      );
    }

    const stripe = await getStripeClient();
    const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const subscriptionItem = stripeSubscription.items.data[0];
    if (!subscriptionItem) {
      return NextResponse.json({ error: "Stripe subscription item not found." }, { status: 409 });
    }

    if (targetRank >= currentRank) {
      await stripe.subscriptions.update(stripeSubscriptionId, {
        items: [{ id: subscriptionItem.id, price: priceId }],
        proration_behavior: "create_prorations",
        billing_cycle_anchor: "unchanged"
      });

      await prisma.subscription.update({
        where: { companyId: context.company.id },
        data: {
          planId: targetPlan.id,
          pendingPlanId: null,
          pendingPlanActiveAt: null,
          stripePriceId: priceId
        }
      });
    } else {
      await stripe.subscriptions.update(stripeSubscriptionId, {
        items: [{ id: subscriptionItem.id, price: priceId }],
        proration_behavior: "none",
        billing_cycle_anchor: "unchanged"
      });

      await prisma.subscription.update({
        where: { companyId: context.company.id },
        data: {
          pendingPlanId: targetPlan.id,
          pendingPlanActiveAt: subscription.currentPeriodEnd,
          stripePriceId: priceId
        }
      });
    }

    return NextResponse.redirect(buildPublicUrl("/settings/billing?billing=updated"), 303);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error && typeof error === "object" && "userMessage" in error
            ? String((error as { userMessage: string }).userMessage)
            : error instanceof Error
              ? error.message
              : "Unable to change subscription."
      },
      { status: 400 }
    );
  }
}
