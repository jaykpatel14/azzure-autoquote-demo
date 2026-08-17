import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageBilling, requireCompanyContext } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { getStripeClient, resolveCheckoutPriceId } from "@/lib/stripe";
import { createCheckoutSession } from "@/src/services/subscriptions";
import { getPlanRank, PLAN_STRIPE_PRICE_IDS } from "@/src/stripe/plans";
import { buildPublicUrl, getRequestBaseUrl } from "@/lib/security";

export const runtime = "nodejs";

const changeSchema = z.object({
  planCode: z.enum(["starter", "professional", "enterprise"])
});

async function parseInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return changeSchema.parse(await request.json());
  }

  const formData = await request.formData();
  return changeSchema.parse({
    planCode: String(formData.get("planCode") ?? "")
  });
}

function wantsJson(request: Request) {
  const accept = request.headers.get("accept") || "";
  const contentType = request.headers.get("content-type") || "";
  return accept.includes("application/json") || contentType.includes("application/json");
}

function handleResponseError(request: Request, message: string, status = 400) {
  if (wantsJson(request)) {
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.redirect(
    buildPublicUrl(`/settings/billing?error=${encodeURIComponent(message)}`),
    303
  );
}

export async function GET() {
  return NextResponse.redirect(buildPublicUrl("/settings/billing"), 303);
}

export async function POST(request: Request) {
  try {
    const context = await requireCompanyContext();
    if (!canManageBilling(context.membership?.role ?? "CUSTOMER")) {
      return handleResponseError(request, "You do not have permission to manage billing.", 403);
    }

    const input = await parseInput(request);
    const subscription = context.company.subscription;
    const targetPlan = await prisma.plan.findUnique({ where: { code: input.planCode } });
    if (!targetPlan) {
      return handleResponseError(request, "Billing plan not found.", 404);
    }

    const stripeSubscriptionId = subscription?.stripeSubscriptionId;

    // If there is no existing subscription, or the status is TRIALING, or there is no connected Stripe subscription ID:
    // Create a Stripe checkout session so the user can connect payment and start/activate their Stripe subscription.
    if (!subscription || subscription.status === "TRIALING" || !stripeSubscriptionId) {
      const checkout = await createCheckoutSession({
        companyId: context.company.id,
        companyName: context.company.name,
        email: context.user.email,
        planCode: targetPlan.code,
        baseUrl: getRequestBaseUrl(request)
      });

      if ("error" in checkout) {
        return handleResponseError(
          request,
          checkout.error.userMessage,
          checkout.error.statusCode || 409
        );
      }

      return NextResponse.redirect(checkout.data.url, 303);
    }

    const currentPlan = subscription.plan;
    const targetPlanCode = input.planCode;
    const targetRank = getPlanRank(targetPlanCode);
    const currentRank = getPlanRank(currentPlan.code);

    const priceId =
      (await resolveCheckoutPriceId(targetPlan)) ||
      PLAN_STRIPE_PRICE_IDS[targetPlanCode as keyof typeof PLAN_STRIPE_PRICE_IDS];

    if (!priceId) {
      return handleResponseError(
        request,
        "This plan is missing a Stripe price configuration.",
        409
      );
    }

    const stripe = await getStripeClient();
    const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const subscriptionItem = stripeSubscription.items.data[0];
    if (!subscriptionItem) {
      return handleResponseError(request, "Stripe subscription item not found.", 409);
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
    const message =
      error && typeof error === "object" && "userMessage" in error
        ? String((error as { userMessage: string }).userMessage)
        : error instanceof Error
          ? error.message
          : "Unable to change subscription.";

    return handleResponseError(request, message, 400);
  }
}
