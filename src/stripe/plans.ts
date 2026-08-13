import { PLAN_FEATURES } from "@/lib/subscription-plans";

export const PLAN_STRIPE_PRICE_IDS = {
  starter: process.env.STRIPE_STARTER_PRICE_ID || null,
  professional: process.env.STRIPE_PROFESSIONAL_PRICE_ID || null,
  enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID || null
} as const;

export { PLAN_FEATURES };

export function getPlanRank(planCode: string) {
  switch (planCode) {
    case "starter":
      return 0;
    case "professional":
      return 1;
    case "enterprise":
      return 2;
    default:
      return 0;
  }
}
