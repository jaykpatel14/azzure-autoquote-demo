import type { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type PdfBrandingType = "custom_logo" | "azzure_watermark" | "white_label";

export const PLAN_FEATURES = {
  plan_starter: { quotesPerMonth: 300, aiPasses: 3, canCreateQuotes: true, canDownloadPDF: true, canViewQuoteHistory: true, canShareQuoteLink: false, canUseCustomPricingProfile: false, pdfBranding: "custom_logo" as PdfBrandingType, canPlaceManufacturingOrder: false, maxSeats: 3, overageEnabled: false, s3ImagePersistence: true, canGenerateAIImages: false, canUseShowroomMode: false, canCustomizeShowroomBranding: false, hasPdfImages: true },
  plan_professional: { quotesPerMonth: 1200, aiPasses: 3, canCreateQuotes: true, canDownloadPDF: true, canViewQuoteHistory: true, canShareQuoteLink: true, canUseCustomPricingProfile: true, pdfBranding: "custom_logo" as PdfBrandingType, canPlaceManufacturingOrder: false, maxSeats: Number.POSITIVE_INFINITY, overageEnabled: true, s3ImagePersistence: true, canGenerateAIImages: false, canUseShowroomMode: false, canCustomizeShowroomBranding: false, hasPdfImages: true },
  plan_enterprise: { quotesPerMonth: 2500, aiPasses: 3, canCreateQuotes: true, canDownloadPDF: true, canViewQuoteHistory: true, canShareQuoteLink: true, canUseCustomPricingProfile: true, pdfBranding: "custom_logo" as PdfBrandingType, canPlaceManufacturingOrder: true, maxSeats: Number.POSITIVE_INFINITY, overageEnabled: true, s3ImagePersistence: true, canGenerateAIImages: true, canUseShowroomMode: true, canCustomizeShowroomBranding: true, hasPdfImages: true }
} as const;

export type PlanId = keyof typeof PLAN_FEATURES;
export type PlanFeatures = (typeof PLAN_FEATURES)["plan_starter"];
export type PlanFeature = keyof PlanFeatures;

export class PlanError extends Error {
  statusCode = 403;
  constructor(public feature: PlanFeature, message = "Your subscription does not include this feature.") {
    super(message);
    this.name = "PlanError";
  }
}

export function isPlanId(value: string): value is PlanId { return Object.prototype.hasOwnProperty.call(PLAN_FEATURES, value); }
export function resolvePlanId(plan: { id: string; code: string }, status: SubscriptionStatus): PlanId {
  if (status === "TRIALING") return "plan_professional";
  const candidate = plan.id || `plan_${plan.code}`;
  if (!isPlanId(candidate)) throw new Error(`Unknown planId: ${candidate}`);
  return candidate;
}
export function getFeaturesForPlan(planId: PlanId): PlanFeatures { return PLAN_FEATURES[planId] as PlanFeatures; }

export async function getCompanyPlanFeatures(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { accountStatus: true, pricingTier: true, subscription: { select: { status: true, plan: { select: { id: true, code: true } } } } }
  });
  if (!company?.subscription) throw new PlanError("canCreateQuotes", "An active subscription is required.");
  const planId = resolvePlanId(company.subscription.plan, company.subscription.status);
  return { company, planId, features: getFeaturesForPlan(planId) };
}

export async function assertPlanFeature(companyId: string, feature: PlanFeature): Promise<void> {
  const { features } = await getCompanyPlanFeatures(companyId);
  const value = features[feature];
  const allowed = typeof value === "boolean" ? value : typeof value === "number" ? value > 0 : Boolean(value);
  if (!allowed) throw new PlanError(feature);
}

export const PLAN_STRIPE_PRICE_IDS = { starter: process.env.STRIPE_STARTER_PRICE_ID || null, professional: process.env.STRIPE_PROFESSIONAL_PRICE_ID || null, enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID || null } as const;
export const TRIAL_DAYS = 14;
export const DEFAULT_TRIAL_QUOTE_CAP = 25;
export const BASE_PLAN_DEFINITIONS = [
  { id: "plan_starter", code: "starter", name: "Starter", monthlyPriceCents: 9900, monthlyLimit: 300, isConfigurable: false },
  { id: "plan_professional", code: "professional", name: "Professional", monthlyPriceCents: 19900, monthlyLimit: 1200, isConfigurable: false },
  { id: "plan_enterprise", code: "enterprise", name: "Enterprise", monthlyPriceCents: 29900, monthlyLimit: 2500, isConfigurable: true }
] as const;
export const PLAN_CODES = ["starter", "professional", "enterprise"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];
export function isPlanCode(value: string): value is PlanCode { return (PLAN_CODES as readonly string[]).includes(value); }
export function getPlanRank(code: string) { return PLAN_CODES.indexOf(code as PlanCode); }
