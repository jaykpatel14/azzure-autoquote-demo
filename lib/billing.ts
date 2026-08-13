import type { Plan, Subscription, SubscriptionStatus, UsagePeriod } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const BILLABLE_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ["TRIALING", "ACTIVE"];

export class BillingAccessError extends Error {
  constructor(message = "Your subscription is inactive. Update billing to continue.") {
    super(message);
    this.name = "BillingAccessError";
  }
}

export function isBillableSubscription(
  subscription: Pick<Subscription, "status"> | null | undefined
) {
  return Boolean(subscription && BILLABLE_SUBSCRIPTION_STATUSES.includes(subscription.status));
}

export function assertBillableSubscription(
  subscription: Pick<Subscription, "status"> | null | undefined
) {
  if (!isBillableSubscription(subscription)) {
    throw new BillingAccessError();
  }
}

export function getEffectiveMonthlyLimit(
  subscription: Pick<Subscription, "status"> & {
    trialQuoteCap?: number;
    plan: Pick<Plan, "monthlyLimit">;
  }
) {
  return subscription.status === "TRIALING"
    ? subscription.trialQuoteCap ?? subscription.plan.monthlyLimit
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
  subscription: Pick<Subscription, "status" | "trialEndsAt"> | null | undefined,
  now = new Date()
) {
  if (!subscription || subscription.status !== "TRIALING" || !subscription.trialEndsAt) {
    return null;
  }

  return Math.max(Math.ceil((subscription.trialEndsAt.getTime() - now.getTime()) / MS_PER_DAY), 0);
}

export function getTrialQuotesRemaining(
  subscription: Pick<Subscription, "status" | "trialQuoteCap" | "trialQuotesUsed"> | null | undefined
) {
  if (!subscription || subscription.status !== "TRIALING") {
    return null;
  }

  return Math.max(subscription.trialQuoteCap - subscription.trialQuotesUsed, 0);
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

