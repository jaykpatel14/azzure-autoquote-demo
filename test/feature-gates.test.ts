import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { PLAN_FEATURES, resolvePlanId } from "@/src/stripe/plans";

const source = (path: string) => readFileSync(path, "utf8");

describe("subscription feature matrix", () => {
  test("Starter has 300 quotes, 3-pass AI, quote history, 3 seats, and branded PDFs", () => {
    expect(PLAN_FEATURES.plan_starter).toMatchObject({
      quotesPerMonth: 300,
      aiPasses: 3,
      canViewQuoteHistory: true,
      canShareQuoteLink: false,
      canUseCustomPricingProfile: false,
      pdfBranding: "custom_logo",
      canPlaceManufacturingOrder: false,
      maxSeats: 3,
      overageEnabled: false,
      s3ImagePersistence: true,
      canGenerateAIImages: false,
      canUseShowroomMode: false,
      canCustomizeShowroomBranding: false,
      hasPdfImages: true
    });
  });
  test("Professional has 1,200 quotes, shareable links, custom pricing, and unlimited seats", () => {
    expect(PLAN_FEATURES.plan_professional).toMatchObject({
      quotesPerMonth: 1200,
      aiPasses: 3,
      canViewQuoteHistory: true,
      canShareQuoteLink: true,
      canUseCustomPricingProfile: true,
      pdfBranding: "custom_logo",
      canPlaceManufacturingOrder: false,
      maxSeats: Number.POSITIVE_INFINITY,
      overageEnabled: true,
      s3ImagePersistence: true,
      canGenerateAIImages: false,
      canUseShowroomMode: false,
      canCustomizeShowroomBranding: false,
      hasPdfImages: true
    });
  });
  test("Enterprise enables 2,500 quotes, 3D concept renders, showroom tablet mode, and CK auto-push", () => {
    expect(PLAN_FEATURES.plan_enterprise.quotesPerMonth).toBe(2500);
    expect(PLAN_FEATURES.plan_enterprise.canShareQuoteLink).toBe(true);
    expect(PLAN_FEATURES.plan_enterprise.canGenerateAIImages).toBe(true);
    expect(PLAN_FEATURES.plan_enterprise.canUseShowroomMode).toBe(true);
    expect(PLAN_FEATURES.plan_enterprise.canCustomizeShowroomBranding).toBe(true);
    expect(PLAN_FEATURES.plan_enterprise.canPlaceManufacturingOrder).toBe(true);
    expect(PLAN_FEATURES.plan_enterprise.pdfBranding).toBe("custom_logo");
    expect(PLAN_FEATURES.plan_enterprise.maxSeats).toBe(Number.POSITIVE_INFINITY);
    expect(PLAN_FEATURES.plan_enterprise.hasPdfImages).toBe(true);
  });
  test("trial users always resolve to Professional features", () => {
    expect(resolvePlanId({ id: "plan_enterprise", code: "enterprise" }, "TRIALING")).toBe("plan_professional");
    expect(PLAN_FEATURES[resolvePlanId({ id: "plan_enterprise", code: "enterprise" }, "TRIALING")].canShareQuoteLink).toBe(true);
    expect(PLAN_FEATURES[resolvePlanId({ id: "plan_enterprise", code: "enterprise" }, "TRIALING")].canPlaceManufacturingOrder).toBe(false);
  });
  test("unknown persisted plan IDs fail closed", () => {
    expect(() => resolvePlanId({ id: "price_unknown", code: "mystery" }, "ACTIVE")).toThrow("Unknown planId");
  });
});

describe("server enforcement wiring", () => {
  test("sharing and manufacturing services enforce their features", () => {
    expect(source("src/services/sharing.ts")).toContain('assertPlanFeature(params.companyId, "canShareQuoteLink")');
    expect(source("src/services/orders.ts")).toContain('assertPlanFeature(params.companyId, "canPlaceManufacturingOrder")');
  });
  test("share pages use random tokens rather than quote IDs", () => {
    expect(source("app/q/[token]/page.tsx")).toContain("where: { publicShareToken: token }");
    expect(source("src/services/sharing.ts")).toContain("randomBytes(24)");
  });
  test("Starter storage and AI pass count are plan driven", () => {
    const route = source("app/api/analyze/route.ts");
    expect(route).toContain("features.s3ImagePersistence");
    expect(route).toContain("features.aiPasses");
  });
  test("team endpoint enforces the matrix seat limit", () => {
    const route = source("app/api/settings/team/route.ts");
    expect(route).toContain("occupiedSeats >= features.maxSeats");
    expect(route).toContain("status: 403");
  });
  test("quote creation enforces billing, approval, tier and pricing-profile entitlement", () => {
    const route = source("app/api/quotes/route.ts");
    const orchestrator = source("src/services/quote-orchestrator.ts");
    expect(route).toContain("assertBillableSubscription");
    expect(route).toContain("isCompanyApproved");
    expect(orchestrator).toContain("!company.pricingTier");
    expect(orchestrator).toContain("features.canUseCustomPricingProfile");
  });
  test("overage is allowed only outside trials and is reported to Stripe", () => {
    expect(source("lib/usage.ts")).toContain('company.subscription?.status !== "TRIALING" && features.overageEnabled');
    expect(source("app/api/analyze/route.ts")).toContain("recordQuoteOverage");
    expect(source("lib/stripe-metering.ts")).toContain("stripe.billing.meterEvents.create");
  });
});
