import { prisma } from "@/lib/prisma";
import { getEffectiveMonthlyLimit } from "@/lib/billing";
import { DEFAULT_TRIAL_QUOTE_CAP, TRIAL_DAYS } from "@/lib/subscription-plans";
import {
  buildAppUrl,
  getStripeClient,
  resolveCheckoutCustomerId,
  resolveCheckoutPriceId
} from "@/lib/stripe";
import { NotFoundError, type AppResult, ConflictError } from "@/src/lib/errors";

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function createCheckoutSession(params: {
  companyId: string;
  companyName: string;
  email: string;
  planCode: string;
}): Promise<AppResult<{ url: string }>> {
  const plan = await prisma.plan.findUnique({ where: { code: params.planCode } });
  if (!plan) {
    return { error: NotFoundError("Billing plan") };
  }

  let subscription = await prisma.subscription.findUnique({
    where: { companyId: params.companyId }
  });

  if (!subscription) {
    const starterPlan = await prisma.plan.findUnique({
      where: { code: "starter" }
    });

    if (!starterPlan) {
      return { error: NotFoundError("Starter billing plan") };
    }

    const periodStart = new Date();
    const periodEnd = addDays(periodStart, TRIAL_DAYS);

    subscription = await prisma.subscription.upsert({
      where: { companyId: params.companyId },
      create: {
        companyId: params.companyId,
        planId: plan.id,
        status: "TRIALING",
        trialStartedAt: periodStart,
        trialEndsAt: periodEnd,
        trialQuoteCap: DEFAULT_TRIAL_QUOTE_CAP,
        trialQuotesUsed: 0,
        pendingPlanId: plan.id,
        onboardingComplete: false,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd
      },
      update: {
        planId: plan.id,
        status: "TRIALING",
        trialStartedAt: periodStart,
        trialEndsAt: periodEnd,
        trialQuoteCap: DEFAULT_TRIAL_QUOTE_CAP,
        trialQuotesUsed: 0,
        pendingPlanId: plan.id,
        onboardingComplete: false,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd
      }
    });

    await prisma.usagePeriod.upsert({
      where: {
        companyId_periodStart_periodEnd: {
          companyId: params.companyId,
          periodStart,
          periodEnd
        }
      },
      create: {
        companyId: params.companyId,
        periodStart,
        periodEnd,
        limit: getEffectiveMonthlyLimit({
          status: "TRIALING",
          trialQuoteCap: DEFAULT_TRIAL_QUOTE_CAP,
          plan: starterPlan
        })
      },
      update: {
        limit: getEffectiveMonthlyLimit({
          status: "TRIALING",
          trialQuoteCap: DEFAULT_TRIAL_QUOTE_CAP,
          plan: starterPlan
        })
      }
    });
  }

  const checkoutPriceId = await resolveCheckoutPriceId(plan);
  if (!checkoutPriceId) {
    return {
      error: ConflictError(
        "This billing plan is not configured with a Stripe price. Use a price_ id, or attach a default recurring price to the product."
      )
    };
  }

  const stripe = await getStripeClient();
  const stripeCustomerId = await resolveCheckoutCustomerId({
    stripe,
    stripeCustomerId: subscription.stripeCustomerId,
    email: params.email,
    companyName: params.companyName,
    companyId: params.companyId,
    planCode: plan.code,
    persistStripeCustomerId: async (customerId) => {
      await prisma.subscription.update({
        where: { companyId: params.companyId },
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
    success_url: buildAppUrl("/settings/billing?billing=success&session_id={CHECKOUT_SESSION_ID}"),
    cancel_url: buildAppUrl("/settings/billing?billing=cancel"),
    metadata: {
      companyId: params.companyId,
      planCode: plan.code
    },
    subscription_data: {
      metadata: {
        companyId: params.companyId,
        planCode: plan.code
      }
    }
  });

  if (!session.url) {
    return { error: ConflictError("Stripe did not return a checkout URL.") };
  }

  return { data: { url: session.url } };
}

export async function createBillingPortalSession(params: {
  companyId: string;
}): Promise<AppResult<{ url: string }>> {
  const company = await prisma.company.findUnique({
    where: { id: params.companyId },
    select: {
      subscription: {
        select: {
          stripeCustomerId: true
        }
      }
    }
  });

  if (!company?.subscription) {
    return { error: NotFoundError("Billing subscription") };
  }

  if (!company.subscription.stripeCustomerId) {
    return {
      error: ConflictError("Billing portal is available after your first Stripe subscription is created.")
    };
  }

  const stripe = await getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: company.subscription.stripeCustomerId,
    return_url: buildAppUrl("/settings/billing")
  });

  return { data: { url: session.url } };
}
