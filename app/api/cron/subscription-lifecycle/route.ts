import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildAppUrl } from "@/lib/stripe";
import { sendAuthMail } from "@/lib/mailer";

export const runtime = "nodejs";

function addMonths(date: Date, months: number) {
  const copy = new Date(date);
  copy.setUTCMonth(copy.getUTCMonth() + months);
  return copy;
}

function getDaysRemaining(target: Date, now = new Date()) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(Math.ceil((target.getTime() - now.getTime()) / msPerDay), 0);
}

function getBillingContactEmail(subscription: {
  company: {
    memberships: Array<{
      role: string;
      user: { email: string };
    }>;
  };
}) {
  const owner = subscription.company.memberships.find((membership) => membership.role === "OWNER");
  return owner?.user.email ?? subscription.company.memberships[0]?.user.email ?? null;
}

async function sendTrialReminder(email: string, daysRemaining: number, companyName: string) {
  const actionUrl = buildAppUrl("/settings/billing?upgrade=1");
  await sendAuthMail({
    to: email,
    subject: `${companyName} trial: ${daysRemaining} days remaining`,
    text: `Your AI AutoQuote trial has ${daysRemaining} days left. Upgrade now: ${actionUrl}`,
    html: `<p>Your AI AutoQuote trial has <strong>${daysRemaining}</strong> days left.</p><p><a href="${actionUrl}">Upgrade your plan</a></p>`
  });
}

async function sendTrialExpired(email: string, companyName: string) {
  const actionUrl = buildAppUrl("/settings/billing");
  await sendAuthMail({
    to: email,
    subject: `${companyName} trial ended`,
    text: `Your AI AutoQuote trial has ended. Visit ${actionUrl} to reactivate billing.`,
    html: `<p>Your AI AutoQuote trial has ended.</p><p><a href="${actionUrl}">Reactivate billing</a></p>`
  });
}

async function processPendingPlanActivation(
  subscription: {
    id: string;
    companyId: string;
    pendingPlanId: string | null;
    pendingPlanActiveAt: Date | null;
  },
  planLimit: number
) {
  if (!subscription.pendingPlanId || !subscription.pendingPlanActiveAt) {
    return false;
  }

  const now = new Date();
  if (subscription.pendingPlanActiveAt > now) {
    return false;
  }

  const nextPlanId = subscription.pendingPlanId;
  if (!nextPlanId) {
    return false;
  }

  const nextPeriodStart = subscription.pendingPlanActiveAt;
  const nextPeriodEnd = addMonths(nextPeriodStart, 1);

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        planId: nextPlanId,
        pendingPlanId: null,
        pendingPlanActiveAt: null,
        currentPeriodStart: nextPeriodStart,
        currentPeriodEnd: nextPeriodEnd
      }
    });

    await tx.usagePeriod.upsert({
      where: {
        companyId_periodStart_periodEnd: {
          companyId: subscription.companyId,
          periodStart: nextPeriodStart,
          periodEnd: nextPeriodEnd
        }
      },
      create: {
        companyId: subscription.companyId,
        periodStart: nextPeriodStart,
        periodEnd: nextPeriodEnd,
        limit: planLimit
      },
      update: {
        limit: planLimit
      }
    });
  });

  return true;
}

export async function POST(request: Request) {
  const secret = process.env.BILLING_LIFECYCLE_SECRET || process.env.CRON_SECRET;
  if (secret) {
    const provided = request.headers.get("x-cron-secret") || request.headers.get("authorization") || "";
    const bearer = provided.startsWith("Bearer ") ? provided.slice("Bearer ".length).trim() : provided.trim();
    if (bearer !== secret) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  const now = new Date();
  const subscriptions = await prisma.subscription.findMany({
    where: {
      OR: [
        { status: "TRIALING" },
        {
          pendingPlanId: { not: null },
          pendingPlanActiveAt: { not: null }
        }
      ]
    },
    include: {
      plan: true,
      company: {
        include: {
          memberships: {
            include: {
              user: {
                select: { email: true }
              }
            }
          }
        }
      }
    }
  });

  let remindersSent = 0;
  let expirationsProcessed = 0;
  let planActivations = 0;

  for (const subscription of subscriptions) {
    const email = getBillingContactEmail(subscription);

    if (subscription.status === "TRIALING" && subscription.trialEndsAt) {
      const daysRemaining = getDaysRemaining(subscription.trialEndsAt, now);

      if (daysRemaining === 13 && !subscription.reminderSentAt13) {
        if (email) {
          await sendTrialReminder(email, daysRemaining, subscription.company.name);
        }

        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { reminderSentAt13: now }
        });
        remindersSent += 1;
      }

      if (daysRemaining === 10 && !subscription.reminderSentAt10) {
        if (email) {
          await sendTrialReminder(email, daysRemaining, subscription.company.name);
        }

        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { reminderSentAt10: now }
        });
        remindersSent += 1;
      }

      if (subscription.trialEndsAt <= now) {
        if (email) {
          await sendTrialExpired(email, subscription.company.name);
        }

        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: "CANCELED",
            cancelAtPeriodEnd: false
          }
        });
        expirationsProcessed += 1;
      }
    }

    if (subscription.pendingPlanId && subscription.pendingPlanActiveAt && subscription.pendingPlanActiveAt <= now) {
      const targetPlan = await prisma.plan.findUnique({ where: { id: subscription.pendingPlanId } });
      if (targetPlan) {
        const activated = await processPendingPlanActivation(subscription, targetPlan.monthlyLimit);
        if (activated) {
          planActivations += 1;
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    remindersSent,
    expirationsProcessed,
    planActivations
  });
}
