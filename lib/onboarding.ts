import type { Prisma } from "@prisma/client";
import { ensureBasePlans } from "@/lib/plan-bootstrap";
import { DEFAULT_TRIAL_QUOTE_CAP, TRIAL_DAYS, isPlanCode } from "@/lib/subscription-plans";
import { generateToken } from "@/lib/tokens";

type OnboardingInput = {
  email: string;
  name?: string | null;
  passwordHash: string;
  companyName: string;
  planCode?: string | null;
};

function slugifyCompanyName(name: string) {
  const normalized = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${normalized || "company"}-${generateToken().slice(0, 8)}`;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function onboardCompanyOwner(
  tx: Prisma.TransactionClient,
  input: OnboardingInput
) {
  const plans = await ensureBasePlans(tx);
  const selectedPlan = input.planCode && isPlanCode(input.planCode) ? plans[input.planCode] : plans.professional;
  const now = new Date();
  const trialEndsAt = addDays(now, TRIAL_DAYS);

  const user = await tx.user.create({
    data: {
      email: input.email,
      name: input.name ?? null,
      passwordHash: input.passwordHash
    }
  });

  const periodStart = now;
  const periodEnd = trialEndsAt;

  const company = await tx.company.create({
    data: {
      name: input.companyName,
      slug: slugifyCompanyName(input.companyName),
      quoteSequence: 0,
      pricingProfile: { create: {} }
    }
  });

  await tx.membership.create({
    data: {
      companyId: company.id,
      userId: user.id,
      role: "OWNER"
    }
  });

  await tx.auditLog.create({
    data: {
      action: "COMPANY_CREATED",
      companyId: company.id,
      actorUserId: user.id,
      targetType: "Company",
      targetId: company.id,
      metadata: {
        companyName: input.companyName
      }
    }
  });

  await tx.auditLog.create({
    data: {
      action: "MEMBERSHIP_CREATED",
      companyId: company.id,
      actorUserId: user.id,
      targetType: "Membership",
      targetId: user.id,
      metadata: {
        role: "OWNER"
      }
    }
  });

  await tx.subscription.create({
    data: {
      companyId: company.id,
      planId: selectedPlan.id,
      status: "TRIALING",
      trialStartedAt: periodStart,
      trialEndsAt,
      trialQuoteCap: DEFAULT_TRIAL_QUOTE_CAP,
      trialQuotesUsed: 0,
      pendingPlanId: selectedPlan.id,
      onboardingComplete: false,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd
    }
  });

  await tx.usagePeriod.create({
    data: {
      companyId: company.id,
      periodStart,
      periodEnd,
      limit: DEFAULT_TRIAL_QUOTE_CAP
    }
  });

  await tx.auditLog.create({
    data: {
      action: "SIGN_UP",
      companyId: company.id,
      actorUserId: user.id,
      targetType: "Company",
      targetId: company.id,
      metadata: {
        email: input.email,
        companyName: input.companyName
      }
    }
  });

  return { user, company };
}
