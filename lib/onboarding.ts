import type { Prisma } from "@prisma/client";
import { getEffectiveMonthlyLimit } from "@/lib/billing";
import { ensureBasePlans } from "@/lib/plan-bootstrap";
import { generateToken } from "@/lib/tokens";

type OnboardingInput = {
  email: string;
  name?: string | null;
  passwordHash: string;
  companyName: string;
};

function slugifyCompanyName(name: string) {
  const normalized = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${normalized || "company"}-${generateToken().slice(0, 8)}`;
}

function startOfCurrentMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfNextMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
}

export async function onboardCompanyOwner(
  tx: Prisma.TransactionClient,
  input: OnboardingInput
) {
  const { starter: starterPlan } = await ensureBasePlans(tx);

  const user = await tx.user.create({
    data: {
      email: input.email,
      name: input.name ?? null,
      passwordHash: input.passwordHash
    }
  });

  const periodStart = startOfCurrentMonth();
  const periodEnd = startOfNextMonth();

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
      role: "CUSTOMER"
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
        role: "CUSTOMER"
      }
    }
  });

  await tx.subscription.create({
    data: {
      companyId: company.id,
      planId: starterPlan.id,
      status: "TRIALING",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd
    }
  });

  await tx.usagePeriod.create({
    data: {
      companyId: company.id,
      periodStart,
      periodEnd,
      limit: getEffectiveMonthlyLimit({
        status: "TRIALING",
        plan: starterPlan
      })
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
