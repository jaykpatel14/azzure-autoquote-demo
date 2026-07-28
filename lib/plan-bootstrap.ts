import type { Plan, PrismaClient, Prisma } from "@prisma/client";

type PlanClient = Pick<PrismaClient, "plan"> | Pick<Prisma.TransactionClient, "plan">;

export type BasePlans = {
  starter: Plan;
  professional: Plan;
  enterprise: Plan;
};

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
] as const satisfies Array<Prisma.PlanCreateInput & { code: Plan["code"] }>;

export async function ensureBasePlans(client: PlanClient): Promise<BasePlans> {
  const plans = await Promise.all(
    BASE_PLAN_DEFINITIONS.map((definition) =>
      client.plan.upsert({
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
