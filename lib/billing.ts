import type { Plan, Subscription, SubscriptionStatus, UsagePeriod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TRIAL_QUOTE_CAP } from "@/lib/subscription-plans";

export const BILLABLE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ["TRIALING", "ACTIVE"];
export const TRIAL_MONTHLY_LIMIT = DEFAULT_TRIAL_QUOTE_CAP;

export class BillingAccessError extends Error {
  constructor(message = "Your subscription is inactive. Update billing to continue.") {
    super(message);
    this.name = "BillingAccessError";
  }
}

export type SubscriptionInput = {
  status: SubscriptionStatus;
  trialEndsAt?: Date | null;
  trialQuotesUsed?: number;
  trialQuoteCap?: number;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
};

export function isBillableSubscription(subscription: SubscriptionInput | null | undefined) {
  if (!subscription || !BILLABLE_SUBSCRIPTION_STATUSES.includes(subscription.status)) {
    return false;
  }

  // Check trial expiration
  if (subscription.status === "TRIALING") {
    const endsAt = subscription.trialEndsAt || subscription.currentPeriodEnd;
    if (endsAt && endsAt < new Date()) {
      return false;
    }
    if (
      subscription.trialQuotesUsed !== undefined &&
      subscription.trialQuoteCap !== undefined &&
      subscription.trialQuotesUsed >= subscription.trialQuoteCap
    ) {
      return false;
    }
  }

  return true;
}

export function assertBillableSubscription(subscription: SubscriptionInput | null | undefined) {
  if (!subscription) {
    throw new BillingAccessError("An active subscription is required to create estimates.");
  }

  const status = subscription.status as string;

  if (status === "CANCELED") {
    throw new BillingAccessError("Your subscription has been canceled. Please select a plan to continue.");
  }

  if (status === "PAST_DUE" || status === "UNPAID") {
    throw new BillingAccessError("Your subscription payment is past due. Please update your payment method to continue.");
  }

  if (status === "TRIALING") {
    const endsAt = subscription.trialEndsAt || subscription.currentPeriodEnd;
    if (endsAt && endsAt < new Date()) {
      throw new BillingAccessError("Your 14-day free trial has expired. Please choose a paid plan to continue creating quotes.");
    }
    const used = subscription.trialQuotesUsed ?? 0;
    const cap = subscription.trialQuoteCap ?? DEFAULT_TRIAL_QUOTE_CAP;
    if (used >= cap) {
      throw new BillingAccessError(`You have used all ${cap} trial estimates. Please upgrade to a paid plan to continue.`);
    }
    return;
  }

  if (status !== "ACTIVE") {
    throw new BillingAccessError(`Your subscription is ${status.toLowerCase()}. Please update billing to continue.`);
  }
}

export function getEffectiveMonthlyLimit(
  subscription: Pick<Subscription, "status"> & {
    trialQuoteCap?: number;
    plan: Pick<Plan, "monthlyLimit">;
  }
) {
  return subscription.status === "TRIALING"
    ? subscription.trialQuoteCap ?? TRIAL_MONTHLY_LIMIT
    : subscription.plan.monthlyLimit;
}

export function mapStripeSubscriptionStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
      return "PAST_DUE";
    case "canceled":
    case "paused":
    default:
      return "CANCELED";
  }
}

export type UsageSnapshot = Pick<UsagePeriod, "limit" | "used" | "reserved">;

export function getUsageRemaining(usage: UsageSnapshot) {
  return Math.max(usage.limit - usage.used - usage.reserved, 0);
}

export function isNearUsageLimit(usage: UsageSnapshot) {
  if (usage.limit <= 0) return false;
  const remaining = getUsageRemaining(usage);
  const warningThreshold = Math.max(Math.ceil(usage.limit * 0.2), 10);
  return remaining <= warningThreshold;
}

export function getUsageWarningMessage(usage: UsageSnapshot) {
  if (!isNearUsageLimit(usage)) return null;

  const remaining = getUsageRemaining(usage);
  return `You have ${remaining} estimates left in the current billing period.`;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getTrialDaysRemaining(
  subscription: (Pick<Subscription, "status"> & Partial<Pick<Subscription, "trialEndsAt" | "currentPeriodEnd" | "currentPeriodStart">>) | null | undefined,
  now = new Date()
) {
  if (!subscription || subscription.status !== "TRIALING") {
    return null;
  }

  const endsAt =
    subscription.trialEndsAt ||
    subscription.currentPeriodEnd ||
    (subscription.currentPeriodStart
      ? new Date(subscription.currentPeriodStart.getTime() + 14 * MS_PER_DAY)
      : new Date(now.getTime() + 14 * MS_PER_DAY));

  const diffMs = endsAt.getTime() - now.getTime();
  return Math.max(Math.ceil(diffMs / MS_PER_DAY), 0);
}

export function getTrialQuotesRemaining(
  subscription: (Pick<Subscription, "status"> & Partial<Pick<Subscription, "trialQuoteCap" | "trialQuotesUsed">>) | null | undefined
) {
  if (!subscription || subscription.status !== "TRIALING") {
    return null;
  }

  const cap = subscription.trialQuoteCap ?? DEFAULT_TRIAL_QUOTE_CAP;
  const used = subscription.trialQuotesUsed ?? 0;
  return Math.max(cap - used, 0);
}

export async function getCurrentUsagePeriod(companyId: string) {
  const now = new Date();
  return prisma.usagePeriod.findFirst({
    where: {
      companyId,
      periodStart: { lte: now },
      periodEnd: { gt: now }
    },
    orderBy: { periodStart: "desc" }
  });
}
