export const PLAN_CODES = ["starter", "professional", "enterprise"] as const;

export type PlanCode = (typeof PLAN_CODES)[number];

export type PlanFeatureKey =
  | "aiPasses"
  | "customMargins"
  | "brandedPdf"
  | "imageHistory"
  | "teamSeats"
  | "shareableLinks"
  | "whiteLabel"
  | "s3Storage"
  | "overageQuotes";

export type PlanFeatureMap = Record<PlanFeatureKey, boolean | number>;

export const TRIAL_DAYS = 14;
export const DEFAULT_TRIAL_QUOTE_CAP = 25;

export const BASE_PLAN_DEFINITIONS = [
  {
    id: "plan_starter",
    code: "starter",
    name: "Starter",
    monthlyPriceCents: 4900,
    monthlyLimit: 100,
    isConfigurable: false
  },
  {
    id: "plan_professional",
    code: "professional",
    name: "Professional",
    monthlyPriceCents: 9900,
    monthlyLimit: 500,
    isConfigurable: false
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

export const PLAN_FEATURES: Record<PlanCode, PlanFeatureMap> = {
  starter: {
    aiPasses: 1,
    customMargins: false,
    brandedPdf: false,
    imageHistory: false,
    teamSeats: 1,
    shareableLinks: false,
    whiteLabel: false,
    s3Storage: false,
    overageQuotes: false
  },
  professional: {
    aiPasses: 3,
    customMargins: true,
    brandedPdf: true,
    imageHistory: true,
    teamSeats: 5,
    shareableLinks: false,
    whiteLabel: false,
    s3Storage: true,
    overageQuotes: true
  },
  enterprise: {
    aiPasses: 3,
    customMargins: true,
    brandedPdf: true,
    imageHistory: true,
    teamSeats: Number.POSITIVE_INFINITY,
    shareableLinks: true,
    whiteLabel: true,
    s3Storage: true,
    overageQuotes: true
  }
};

export function isPlanCode(value: string): value is PlanCode {
  return (PLAN_CODES as readonly string[]).includes(value);
}

export function getPlanFeature(planCode: PlanCode, feature: PlanFeatureKey) {
  return PLAN_FEATURES[planCode][feature];
}

export function assertPlanFeature(planCode: PlanCode, feature: PlanFeatureKey) {
  const value = getPlanFeature(planCode, feature);
  const allowed = typeof value === "number" ? value > 0 : Boolean(value);

  if (!allowed) {
    throw new Error(`The ${planCode} plan does not include ${feature}.`);
  }

  return value;
}
