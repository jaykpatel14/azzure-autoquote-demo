import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

loadEnvConfig(process.cwd(), true);

const prisma = new PrismaClient();

const BASE_PLAN_DEFINITIONS = [
  {
    id: "plan_starter",
    code: "starter",
    name: "Starter",
    monthlyPriceCents: 4900,
    monthlyLimit: 100
  },
  {
    id: "plan_professional",
    code: "professional",
    name: "Professional",
    monthlyPriceCents: 9900,
    monthlyLimit: 500
  },
  {
    id: "plan_enterprise",
    code: "enterprise",
    name: "Enterprise",
    monthlyPriceCents: 19900,
    monthlyLimit: 2500,
    isConfigurable: true
  }
] as const;

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

async function ensureBasePlans() {
  const plans = await Promise.all(
    BASE_PLAN_DEFINITIONS.map((definition) =>
      prisma.plan.upsert({
        where: { code: definition.code },
        create: {
          ...definition,
          stripePriceId: null,
          stripeProductId: null
        },
        update: {
          ...definition
        }
      })
    )
  );

  return {
    starter: plans[0],
    professional: plans[1],
    enterprise: plans[2]
  };
}

async function main() {
  const companyId = "company_demo_jewelry";
  const ownerUserId = "user_demo_owner";
  const plans = await ensureBasePlans();

  await prisma.plan.update({
    where: { code: "professional" },
    data: {
      stripePriceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID || null,
      stripeProductId: process.env.STRIPE_PROFESSIONAL_PRODUCT_ID || null
    }
  });

  await prisma.plan.update({
    where: { code: "enterprise" },
    data: {
      stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || null,
      stripeProductId: process.env.STRIPE_ENTERPRISE_PRODUCT_ID || null
    }
  });

  const company = await prisma.company.upsert({
    where: { slug: "demo-jewelry" },
    create: {
      id: companyId,
      name: "Demo Jewelry",
      slug: "demo-jewelry",
      quoteSequence: 0,
      pricingProfile: { create: {} }
    },
    update: {
      name: "Demo Jewelry",
      quoteSequence: 0
    }
  });

  const professional = plans.professional;
  const owner = await prisma.user.upsert({
    where: { email: "owner@demojewelry.test" },
    create: {
      id: ownerUserId,
      email: "owner@demojewelry.test",
      name: "Demo Owner",
      passwordHash: hashPassword("demo-password"),
      emailVerifiedAt: new Date("2026-07-01T00:00:00.000Z")
    },
    update: {
      name: "Demo Owner",
      passwordHash: hashPassword("demo-password"),
      emailVerifiedAt: new Date("2026-07-01T00:00:00.000Z")
    }
  });

  const demoUser = await prisma.user.upsert({
    where: { email: "test@acme.com" },
    create: {
      id: "user_demo_acme",
      email: "test@acme.com",
      name: "Demo User",
      passwordHash: hashPassword("password123"),
      emailVerifiedAt: new Date("2026-07-01T00:00:00.000Z")
    },
    update: {
      name: "Demo User",
      passwordHash: hashPassword("password123"),
      emailVerifiedAt: new Date("2026-07-01T00:00:00.000Z")
    }
  });

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@azzure.com" },
    create: {
      id: "user_internal_admin",
      email: "admin@azzure.com",
      name: "Azzure Admin",
      passwordHash: hashPassword("password123"),
      emailVerifiedAt: new Date("2026-07-01T00:00:00.000Z")
    },
    update: {
      name: "Azzure Admin",
      passwordHash: hashPassword("password123"),
      emailVerifiedAt: new Date("2026-07-01T00:00:00.000Z")
    }
  });

  await prisma.membership.upsert({
    where: {
      companyId_userId: {
        companyId: company.id,
        userId: owner.id
      }
    },
    create: {
      companyId: company.id,
      userId: owner.id,
      role: "OWNER"
    },
    update: {
      role: "OWNER"
    }
  });

  await prisma.membership.upsert({
    where: {
      companyId_userId: {
        companyId: company.id,
        userId: demoUser.id
      }
    },
    create: {
      companyId: company.id,
      userId: demoUser.id,
      role: "ADMIN"
    },
    update: {
      role: "ADMIN"
    }
  });

  const periodStart = new Date("2026-07-01T00:00:00.000Z");
  const periodEnd = new Date("2026-08-01T00:00:00.000Z");

  await prisma.subscription.upsert({
    where: { companyId: company.id },
    create: {
      companyId: company.id,
      planId: professional.id,
      status: "ACTIVE",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd
    },
    update: {
      planId: professional.id,
      status: "ACTIVE",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd
    }
  });

  await prisma.usagePeriod.upsert({
    where: {
      companyId_periodStart_periodEnd: {
        companyId: company.id,
        periodStart,
        periodEnd
      }
    },
    create: {
      companyId: company.id,
      periodStart,
      periodEnd,
      limit: professional.monthlyLimit
    },
    update: {
      limit: professional.monthlyLimit
    }
  });

  console.log(`Seeded demo company: ${company.id}`);
  console.log(`Seeded demo owner: ${owner.email}`);
  console.log(`Seeded demo user: ${demoUser.email}`);
  console.log(`Seeded internal admin: ${adminUser.email}`);
  console.log("The demo company id can be used to inspect seeded data.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
