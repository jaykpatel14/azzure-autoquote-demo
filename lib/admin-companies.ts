import type { MembershipRole, Prisma, PrismaClient, SubscriptionStatus } from "@prisma/client";
import { getEffectiveMonthlyLimit } from "@/lib/billing";
import { generateToken } from "@/lib/tokens";
import { ensureBasePlans } from "@/lib/plan-bootstrap";

type PrismaCompanyClient =
  | Pick<
      PrismaClient,
      "company" | "user" | "membership" | "pricingProfile" | "auditLog" | "plan" | "subscription" | "usagePeriod"
    >
  | Pick<
      Prisma.TransactionClient,
      "company" | "user" | "membership" | "pricingProfile" | "auditLog" | "plan" | "subscription" | "usagePeriod"
    >;

type AdminMemberInput = {
  email: string;
  name?: string | null;
  password?: string | null;
  role?: MembershipRole;
};

type AdminCompanyInput = AdminMemberInput & {
  companyName: string;
  companySlug?: string | null;
};

type AdminBillingInput = {
  companyName: string;
  companySlug?: string | null;
  logoUrl?: string | null;
  quoteSequence: number;
  subscription: {
    planId?: string | null;
    status: SubscriptionStatus;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripeProductId?: string | null;
    stripePriceId?: string | null;
    cancelAtPeriodEnd: boolean;
    overageEnabled: boolean;
    overagePriceCents?: number | null;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
  };
};

function slugifyCompanyName(name: string) {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildAdminCompanySlug(name: string, suppliedSlug?: string | null) {
  const normalizedSuppliedSlug = suppliedSlug?.trim() ? slugifyCompanyName(suppliedSlug.trim()) : "";
  if (normalizedSuppliedSlug) {
    return normalizedSuppliedSlug;
  }

  const normalizedName = slugifyCompanyName(name);
  const base = normalizedName || "company";
  return `${base}-${generateToken().slice(0, 8)}`;
}

async function findUniqueCompanySlug(
  client: PrismaCompanyClient,
  name: string,
  suppliedSlug?: string | null
) {
  const normalizedSuppliedSlug = suppliedSlug?.trim() ? slugifyCompanyName(suppliedSlug.trim()) : "";
  if (normalizedSuppliedSlug) {
    const existing = await client.company.findUnique({
      where: { slug: normalizedSuppliedSlug },
      select: { id: true }
    });

    if (existing) {
      throw new Error("Company slug already exists.");
    }

    return normalizedSuppliedSlug;
  }

  const normalizedName = slugifyCompanyName(name);
  const base = normalizedName || "company";

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = `${base}-${generateToken().slice(0, 8)}`;
    const existing = await client.company.findUnique({
      where: { slug: candidate },
      select: { id: true }
    });

    if (!existing) {
      return candidate;
    }
  }

  return `${base}-${generateToken().slice(0, 12)}`;
}

async function createOrReuseUser(
  client: PrismaCompanyClient,
  input: Pick<AdminMemberInput, "email" | "name" | "password">
) {
  const email = input.email.trim().toLowerCase();
  const existing = await client.user.findUnique({
    where: { email },
    select: { id: true }
  });

  if (existing) {
    return { id: existing.id, created: false as const };
  }

  if (!input.password || input.password.trim().length < 8) {
    throw new Error("Password is required when creating a new user.");
  }

  const { hashPassword } = await import("@/lib/password");
  const user = await client.user.create({
    data: {
      email,
      name: input.name?.trim() || null,
      passwordHash: hashPassword(input.password),
      emailVerifiedAt: new Date()
    },
    select: { id: true }
  });

  return { id: user.id, created: true as const };
}

export async function createAdminCompanyWithMember(
  client: PrismaCompanyClient,
  adminUserId: string,
  input: AdminCompanyInput
) {
  const companySlug = await findUniqueCompanySlug(client, input.companyName, input.companySlug);

  const company = await client.company.create({
    data: {
      name: input.companyName.trim(),
      slug: companySlug,
      quoteSequence: 0,
      pricingProfile: { create: {} }
    }
  });

  const user = await createOrReuseUser(client, {
    email: input.email,
    name: input.name,
    password: input.password
  });

  await client.membership.create({
    data: {
      companyId: company.id,
      userId: user.id,
      role: "OWNER"
    }
  });

  await client.auditLog.create({
    data: {
      action: "COMPANY_CREATED",
      companyId: company.id,
      actorUserId: adminUserId,
      targetType: "Company",
      targetId: company.id,
      metadata: {
        companyName: company.name,
        companySlug
      }
    }
  });

  await client.auditLog.create({
    data: {
      action: "MEMBERSHIP_CREATED",
      companyId: company.id,
      actorUserId: adminUserId,
      targetType: "Membership",
      targetId: user.id,
      metadata: {
        email: input.email.trim().toLowerCase(),
        role: "OWNER",
        userCreated: user.created
      }
    }
  });

  return { company, userId: user.id };
}

export async function addAdminCompanyMember(
  client: PrismaCompanyClient,
  adminUserId: string,
  companyId: string,
  input: AdminMemberInput
) {
  const company = await client.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, slug: true }
  });

  if (!company) {
    throw new Error("Company not found.");
  }

  const email = input.email.trim().toLowerCase();
  const user = await createOrReuseUser(client, {
    email,
    name: input.name,
    password: input.password
  });

  const existingMembership = await client.membership.findUnique({
    where: {
      companyId_userId: {
        companyId: company.id,
        userId: user.id
      }
    },
    select: { id: true }
  });

  if (existingMembership) {
    throw new Error("That user is already assigned to this company.");
  }

  await client.membership.create({
    data: {
      companyId: company.id,
      userId: user.id,
      role: input.role || "CUSTOMER"
    }
  });

  await client.auditLog.create({
    data: {
      action: "MEMBERSHIP_CREATED",
     companyId: company.id,
      actorUserId: adminUserId,
      targetType: "Membership",
      targetId: user.id,
      metadata: {
        email,
        role: input.role || "CUSTOMER",
        userCreated: user.created
      }
    }
  });

  return { company, userId: user.id };
}

function normalizeOptionalText(value?: string | null) {
  const trimmed = value?.trim() || "";
  return trimmed.length > 0 ? trimmed : null;
}

export async function updateAdminCompanyBilling(
  client: PrismaCompanyClient,
  adminUserId: string,
  companyId: string,
  input: AdminBillingInput
) {
  const company = await client.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, slug: true, quoteSequence: true }
  });

  if (!company) {
    throw new Error("Company not found.");
  }

  const plans = await ensureBasePlans(client);
  const fallbackPlanId = plans.starter.id;
  const selectedPlanId = input.subscription.planId?.trim() || fallbackPlanId;
  const selectedPlan = await client.plan.findUnique({
    where: { id: selectedPlanId }
  });

  if (!selectedPlan) {
    throw new Error("Billing plan not found.");
  }

  const updatedCompany = await client.company.update({
    where: { id: companyId },
    data: {
      name: input.companyName.trim(),
      slug: input.companySlug?.trim()
        ? buildAdminCompanySlug(input.companyName, input.companySlug)
        : company.slug,
      logoUrl: normalizeOptionalText(input.logoUrl),
      quoteSequence: Math.max(0, Math.floor(input.quoteSequence))
    }
  });

  const subscription = await client.subscription.upsert({
    where: { companyId },
    create: {
      companyId,
      planId: selectedPlan.id,
      status: input.subscription.status,
      stripeCustomerId: normalizeOptionalText(input.subscription.stripeCustomerId),
      stripeSubscriptionId: normalizeOptionalText(input.subscription.stripeSubscriptionId),
      stripeProductId: normalizeOptionalText(input.subscription.stripeProductId),
      stripePriceId: normalizeOptionalText(input.subscription.stripePriceId),
      cancelAtPeriodEnd: input.subscription.cancelAtPeriodEnd,
      overageEnabled: input.subscription.overageEnabled,
      overagePriceCents: input.subscription.overagePriceCents ?? null,
      currentPeriodStart: input.subscription.currentPeriodStart,
      currentPeriodEnd: input.subscription.currentPeriodEnd
    },
    update: {
      planId: selectedPlan.id,
      status: input.subscription.status,
      stripeCustomerId: normalizeOptionalText(input.subscription.stripeCustomerId),
      stripeSubscriptionId: normalizeOptionalText(input.subscription.stripeSubscriptionId),
      stripeProductId: normalizeOptionalText(input.subscription.stripeProductId),
      stripePriceId: normalizeOptionalText(input.subscription.stripePriceId),
      cancelAtPeriodEnd: input.subscription.cancelAtPeriodEnd,
      overageEnabled: input.subscription.overageEnabled,
      overagePriceCents: input.subscription.overagePriceCents ?? null,
      currentPeriodStart: input.subscription.currentPeriodStart,
      currentPeriodEnd: input.subscription.currentPeriodEnd
    }
  });

  await client.usagePeriod.upsert({
    where: {
      companyId_periodStart_periodEnd: {
        companyId,
        periodStart: input.subscription.currentPeriodStart,
        periodEnd: input.subscription.currentPeriodEnd
      }
    },
    create: {
      companyId,
      periodStart: input.subscription.currentPeriodStart,
      periodEnd: input.subscription.currentPeriodEnd,
      limit: getEffectiveMonthlyLimit({
        status: input.subscription.status,
        plan: selectedPlan
      })
    },
    update: {
      limit: getEffectiveMonthlyLimit({
        status: input.subscription.status,
        plan: selectedPlan
      })
    }
  });

  await client.auditLog.create({
    data: {
      action: "BILLING_ADMIN_UPDATED",
      companyId,
      actorUserId: adminUserId,
      targetType: "Company",
      targetId: companyId,
      metadata: {
        companyName: updatedCompany.name,
        companySlug: updatedCompany.slug,
        planCode: selectedPlan.code,
        subscriptionStatus: subscription.status,
        quoteSequence: updatedCompany.quoteSequence
      }
    }
  });

  return { company: updatedCompany, subscription, plan: selectedPlan };
}
