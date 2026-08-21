import type { Plan, Prisma, PrismaClient } from "@prisma/client";
import { BASE_PLAN_DEFINITIONS } from "@/lib/subscription-plans";

type PlanClient = Pick<PrismaClient, "plan"> | Pick<Prisma.TransactionClient, "plan">;

export type BasePlans = {
  starter: Plan;
  professional: Plan;
  enterprise: Plan;
};

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
