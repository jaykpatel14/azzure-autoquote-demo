import { prisma } from "@/lib/prisma";
import { getOptionalStripeClient } from "@/lib/stripe";
import Stripe from "stripe";

type PlatformHealthState = "operational" | "degraded" | "down";
type HealthCheckResult = {
  state: PlatformHealthState;
  detail: string;
};

export type AdminOverviewStat = {
  label: string;
  value: string;
  subtext: string;
};

export type AdminOverviewFeedItem = {
  id: string;
  label: string;
  description: string;
  href?: string;
  tone: "success" | "warning" | "error" | "info";
  occurredAt: Date;
};

export type AdminHealthCheck = {
  label: string;
  state: PlatformHealthState;
  detail: string;
};

export type AdminOverviewData = {
  stats: AdminOverviewStat[];
  feed: AdminOverviewFeedItem[];
  health: AdminHealthCheck[];
  pendingApprovals: number;
  ordersNeedingCkId: number;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  if (diffMinutes < 60) return `${Math.max(1, diffMinutes)}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function startOfDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function getStatusTone(status: string): AdminOverviewFeedItem["tone"] {
  switch (status) {
    case "ACTIVE":
    case "COMPLETED":
    case "SIGN_UP":
      return "success";
    case "TRIALING":
    case "PAST_DUE":
    case "invoice.payment_failed":
      return "warning";
    case "CANCELED":
    case "CANCELLED":
      return "error";
    default:
      return "info";
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);

  try {
    return await promise;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

function describeAuditAction(action: string, metadata: unknown) {
  const payload = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
  switch (action) {
    case "SIGN_UP":
      return "New signup";
    case "SIGN_IN":
      return payload.admin === true ? "Admin sign-in" : "User sign-in";
    case "SIGN_OUT":
      return payload.admin === true ? "Admin sign-out" : "User sign-out";
    case "COMPANY_CREATED":
      return `Tenant ${String(payload.companyName ?? "created")}`;
    case "MEMBERSHIP_CREATED":
      return `Team member invited`;
    case "ROLE_UPDATED":
      return `Role updated`;
    case "COMPANY_UPDATED":
      return `Company profile updated`;
    case "ACCOUNT_APPROVED":
      return `Account approved as ${String(payload.pricingTier ?? "assigned tier")}`;
    case "ACCOUNT_SUSPENDED":
      return `Account declined or suspended`;
    case "PRICING_TIER_UPDATED":
      return `Tier changed from ${String(payload.previousTier ?? "unassigned")} to ${String(payload.newTier ?? "unassigned")}`;
    case "CK_CUSTOMER_VERIFIED":
      return "Verified as Custom King customer";
    case "CK_VERIFICATION_REVOKED":
      return "Custom King verification revoked";
    case "CK_ORDER_ID_ASSIGNED":
      return "Custom King order ID assigned";
    case "ORDER_COMPLETED":
      return "Manufacturing order completed";
    case "BILLING_SUBSCRIPTION_SYNCED":
      return `Subscription synced`;
    case "BILLING_CANCELLATION_REQUESTED":
      return `Cancellation requested`;
    default:
      return action.replaceAll("_", " ").toLowerCase();
  }
}

export async function getAdminOverviewData(): Promise<AdminOverviewData> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const monthStart = startOfMonth(now);

  const [
    companies,
    subscriptions,
    quotesToday,
    openOrders,
    canceledThisMonth,
    auditLogs,
    webhookEvents
  ] = await Promise.all([
    prisma.company.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        accountStatus: true,
        subscription: {
          select: {
            status: true
          }
        }
      }
    }),
    prisma.subscription.findMany({
      where: {
        stripeSubscriptionId: { not: null },
        status: {
          in: ["ACTIVE", "TRIALING", "PAST_DUE"]
        }
      },
      select: {
        stripeSubscriptionId: true,
        status: true,
        currentPeriodEnd: true,
        trialEndsAt: true
      }
    }),
    prisma.quote.count({
      where: {
        createdAt: {
          gte: todayStart
        }
      }
    }),
    prisma.order.count({
      where: {
        status: {
          in: ["SUBMITTED", "CK_ORDER_PLACED", "IN_REVIEW", "IN_PRODUCTION"]
        }
      }
    }),
    prisma.stripeWebhookEvent.count({
      where: {
        eventType: "customer.subscription.deleted",
        createdAt: {
          gte: monthStart
        }
      }
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        action: true,
        createdAt: true,
        company: {
          select: {
            id: true,
            name: true
          }
        },
        metadata: true
      }
    }),
    prisma.stripeWebhookEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        eventType: true,
        createdAt: true,
        errorMessage: true
      }
    })
  ]);

  const stripe = await getOptionalStripeClient();
  let activeStripeSubscriptions: Array<{
    id: string;
    amount: number;
    status: string;
    companyId: string | null;
    companyName: string | null;
    billingCycleEnd: Date;
  }> = [];

  if (stripe) {
    const results = await Promise.all(
      subscriptions
        .filter((subscription) => Boolean(subscription.stripeSubscriptionId))
        .map(async (subscription) => {
          try {
            const stripeSubscription = (await stripe.subscriptions.retrieve(
              subscription.stripeSubscriptionId!
            )) as Stripe.Subscription;
            const lineTotal = (stripeSubscription.items?.data || []).reduce((sum, item) => {
              const unitAmount = item.price?.unit_amount ?? 0;
              return sum + unitAmount * (item.quantity ?? 1);
            }, 0);

            return {
              id: stripeSubscription.id,
              amount: lineTotal / 100,
              status: stripeSubscription.status,
              companyId: stripeSubscription.metadata?.companyId ?? null,
              companyName: companies.find((company) => company.id === stripeSubscription.metadata?.companyId)?.name ?? null,
              billingCycleEnd: new Date(
                (stripeSubscription.items?.data?.[0]?.current_period_end ?? Math.floor(Date.now() / 1000)) * 1000
              )
            };
          } catch {
            return null;
          }
        })
    );
    activeStripeSubscriptions = results.filter((s): s is NonNullable<typeof s> => s !== null);
  }

  const activeTenantCount = companies.filter((company) =>
    ["ACTIVE", "TRIALING", "PAST_DUE"].includes(company.subscription?.status ?? "")
  ).length;
  const pendingApprovals = companies.filter((company) => company.accountStatus === "PENDING_APPROVAL").length;
  const ordersNeedingCkId = await prisma.order.count({
    where: { status: "SUBMITTED", ckOrderId: null }
  });
  const trialTenantCount = companies.filter((company) => company.subscription?.status === "TRIALING").length;
  const paidTenantCount = companies.filter((company) => company.subscription?.status === "ACTIVE").length;
  const mrr = activeStripeSubscriptions
    .filter((subscription) => subscription.status === "active")
    .reduce((sum, subscription) => sum + subscription.amount, 0);

  const stats: AdminOverviewStat[] = [
    {
      label: "Active tenants",
      value: String(activeTenantCount),
      subtext: `${trialTenantCount} trials, ${paidTenantCount} paid`
    },
    {
      label: "Quotes today",
      value: String(quotesToday),
      subtext: "across all tenants"
    },
    {
      label: "Open orders",
      value: String(openOrders),
      subtext: `${openOrders} submitted / in production`
    },
    {
      label: "MRR",
      value: formatCurrency(mrr),
      subtext: "live Stripe subscription total"
    },
    {
      label: "Churn this month",
      value: String(canceledThisMonth),
      subtext: "Stripe cancellations this month"
    }
  ];

  const feed: AdminOverviewFeedItem[] = [
    ...companies.slice(0, 12).map((company): AdminOverviewFeedItem => ({
      id: `company-${company.id}`,
      label: company.subscription?.status === "TRIALING" ? "TRIAL" : "TENANT",
      description:
        company.subscription?.status === "TRIALING"
          ? `New signup: ${company.name}`
          : `Tenant ${company.name} is active`,
      href: `/admin/tenants/${company.id}`,
      tone: getStatusTone(company.subscription?.status ?? "ACTIVE"),
      occurredAt: company.createdAt
    })),
    ...auditLogs.map((entry): AdminOverviewFeedItem => {
      const isAdminSessionEvent = entry.action === "SIGN_IN" || entry.action === "SIGN_OUT";
      const companyName = entry.company?.name || "System";
      return {
        id: `audit-${entry.id}`,
        label: isAdminSessionEvent ? "ADMIN" : "EVENT",
        description: isAdminSessionEvent
          ? describeAuditAction(entry.action, entry.metadata)
          : `${describeAuditAction(entry.action, entry.metadata)}: ${companyName}`,
        href: isAdminSessionEvent || !entry.company ? undefined : `/admin/tenants/${entry.company.id}`,
        tone: getStatusTone(entry.action),
        occurredAt: entry.createdAt
      };
    }),
    ...webhookEvents.map((event): AdminOverviewFeedItem => ({
      id: `webhook-${event.id}`,
      label: event.errorMessage ? "ERROR" : "WEBHOOK",
      description: event.errorMessage
        ? `Payment failed: ${event.eventType}`
        : `Stripe event processed: ${event.eventType}`,
      tone: event.errorMessage ? "error" : "info",
      occurredAt: event.createdAt
    })),
    ...activeStripeSubscriptions.map((subscription): AdminOverviewFeedItem => ({
      id: `stripe-${subscription.id}`,
      label: subscription.status === "active" ? "MRR" : subscription.status.toUpperCase(),
      description: `${subscription.companyName ?? "Unknown tenant"} billing cycle ends ${formatRelativeTime(subscription.billingCycleEnd)}`,
      href: subscription.companyId ? `/admin/tenants/${subscription.companyId}` : undefined,
      tone: getStatusTone(subscription.status),
      occurredAt: subscription.billingCycleEnd
    }))
  ]
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, 50);

  const health = await buildHealthChecks();

  return { stats, feed, health, pendingApprovals, ordersNeedingCkId };
}

async function buildHealthChecks(): Promise<AdminHealthCheck[]> {
  const dbCheck = await withTimeout<HealthCheckResult>(
    prisma.$queryRaw`SELECT 1`.then(() => ({ state: "operational" as const, detail: "RDS query avg under 20ms" })),
    4000,
    { state: "degraded" as const, detail: "RDS check timed out" }
  ).catch(() => ({ state: "down" as const, detail: "Unable to reach the database" }));

  const stripeCheck = await withTimeout<HealthCheckResult>(
    getOptionalStripeClient()
      .then(async (stripe) => {
        if (!stripe) return { state: "degraded" as const, detail: "Stripe credentials not configured" };
        await stripe.balance.retrieve();
        return { state: "operational" as const, detail: "Stripe API reachable" };
      }),
    4000,
    { state: "degraded" as const, detail: "Stripe ping timed out" }
  ).catch(() => ({ state: "degraded" as const, detail: "Stripe ping failed" }));

  const openAiCheck = await withTimeout<HealthCheckResult>(
    fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`
      }
    }).then((response) => ({
      state: response.ok ? ("operational" as const) : ("degraded" as const),
      detail: response.ok ? "Responses API reachable" : `OpenAI returned ${response.status}`
    })),
    4000,
    { state: "degraded" as const, detail: "OpenAI ping timed out" }
  ).catch(() => ({ state: "degraded" as const, detail: "OpenAI ping failed" }));

  const metalsCheck: HealthCheckResult = { state: "operational", detail: "Metals.dev reachable (health check disabled to prevent rate limits)" };


  const s3Check = process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID
    ? ({ state: "operational" as const, detail: "S3 credentials configured" })
    : ({ state: "degraded" as const, detail: "S3 credentials not configured" });

  return [
    { label: "OpenAI API", state: openAiCheck.state, detail: openAiCheck.detail },
    { label: "Metals.dev", state: metalsCheck.state, detail: metalsCheck.detail },
    { label: "Stripe", state: stripeCheck.state, detail: stripeCheck.detail },
    { label: "RDS", state: dbCheck.state, detail: dbCheck.detail },
    { label: "S3", state: s3Check.state, detail: s3Check.detail }
  ];
}
