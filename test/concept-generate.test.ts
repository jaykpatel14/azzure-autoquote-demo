import { beforeEach, describe, expect, test, vi } from "vitest";

const companyContextMock = vi.hoisted(() => vi.fn());
const reserveUsageMock = vi.hoisted(() => vi.fn());
const releaseUsageMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const consumeUsageMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const prismaMock = vi.hoisted(() => ({
  aiAnalysis: {
    create: vi.fn()
  }
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock
}));

vi.mock("@/lib/company", () => ({
  requireCompanyContext: companyContextMock,
  CompanyAccessError: class CompanyAccessError extends Error {},
  canCreateQuotes: vi.fn((role) => role === "ADMIN" || role === "OWNER" || role === "ESTIMATOR")
}));

vi.mock("@/lib/billing", () => ({
  assertBillableSubscription: vi.fn(),
  BillingAccessError: class BillingAccessError extends Error {}
}));

vi.mock("@/lib/usage", () => ({
  reserveMonthlyUsage: reserveUsageMock,
  releaseMonthlyUsage: releaseUsageMock,
  consumeMonthlyUsage: consumeUsageMock,
  UsageLimitError: class UsageLimitError extends Error {}
}));

vi.mock("@/lib/app-settings", () => ({
  resolveRuntimeSetting: vi.fn(() => Promise.resolve(null))
}));

vi.mock("@/lib/quote-pdf-s3", () => ({
  buildAnalysisImageStorageKey: vi.fn(() => "analysis/c1/concept-123.jpg"),
  storeAnalysisImageInS3: vi.fn(() => Promise.resolve(null))
}));

vi.mock("@/src/stripe/plans", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/src/stripe/plans")>();
  return {
    ...actual,
    assertPlanFeature: vi.fn().mockResolvedValue(undefined)
  };
});

import { POST as generateConcept, extractSpecsFromPromptText } from "@/app/api/concept/generate/route";
import { applyRenderRefinements } from "@/lib/ai/render-refinement";

describe("POST /api/concept/generate", () => {
  test("corrective removal overrides side stones from the original prompt", () => {
    const specs = extractSpecsFromPromptText(
      "1.5ct oval ring with a halo and pave side diamonds",
      "18K",
      "Remove the side diamonds and omit the halo"
    );

    expect(specs.sideDiamondQuantity).toBe(0);
    expect(specs.sideDiamondCarats).toBe(0);
  });

  test("applies iterative revisions in order and allows later revisions to reverse earlier ones", () => {
    const specs = applyRenderRefinements({
      centerShape: "oval",
      centerDiamondCarats: 1.5,
      sideDiamondQuantity: 16,
      sideDiamondCarats: 0.4,
      settingType: "halo"
    }, "Remove the side diamonds. Change the center to 2ct pear. Then add 2 side diamonds");

    expect(specs).toMatchObject({
      centerShape: "pear",
      centerDiamondCarats: 2,
      sideDiamondQuantity: 2,
      sideDiamondCarats: 0.25,
      settingType: "prong"
    });
  });

  beforeEach(() => {
    companyContextMock.mockReset();
    reserveUsageMock.mockReset();
    releaseUsageMock.mockReset().mockResolvedValue(undefined);
    consumeUsageMock.mockReset().mockResolvedValue(undefined);
    prismaMock.aiAnalysis.create.mockReset();
  });

  test("successfully synthesizes concept from customer description prompt", async () => {
    companyContextMock.mockResolvedValue({
      company: {
        id: "company_test_1",
        accountStatus: "APPROVED",
        pricingTier: "TIER_1",
        subscription: { status: "ACTIVE", plan: "ENTERPRISE" }
      },
      membership: { role: "ADMIN" }
    });

    reserveUsageMock.mockResolvedValue({ usagePeriodId: "period_1", isOverage: false });

    prismaMock.aiAnalysis.create.mockResolvedValue({
      id: "analysis_concept_123",
      jewelryType: "Ring",
      selectedMetal: "18K",
      centerShape: "oval",
      centerClarity: "E VS1",
      settingType: "halo",
      metalWeightGrams: 3.8,
      centerDiamondCarats: 1.5,
      sideDiamondCarats: 0.4,
      sideDiamondQuantity: 20,
      confidence: "high",
      notes: "Customer Concept: 18K Oval 1.5ct Solitaire with Hidden Halo",
      imageDataUrl: null,
      sourceImageStorageKey: null,
      assumptions: ["Crafted in 18K"]
    });

    const request = new Request("http://localhost/api/concept/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "18K Oval 1.5ct Solitaire with Hidden Halo and Pavé band",
        metalType: "18K"
      })
    });

    const response = await generateConcept(request);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.analysisId).toBe("analysis_concept_123");
    expect(body.centerShape).toBe("oval");
    expect(body.centerDiamondCarats).toBe(1.5);
    expect(body.sideDiamondQuantity).toBe(20);
    expect(body.confidence).toBe("high");
  });

  test("rejects request if description prompt is too short", async () => {
    companyContextMock.mockResolvedValue({
      company: {
        id: "company_test_1",
        accountStatus: "APPROVED",
        pricingTier: "TIER_1",
        subscription: { status: "ACTIVE", plan: "ENTERPRISE" }
      },
      membership: { role: "ADMIN" }
    });

    reserveUsageMock.mockResolvedValue({ usagePeriodId: "period_1", isOverage: false });

    const request = new Request("http://localhost/api/concept/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "a",
        metalType: "14K"
      })
    });

    const response = await generateConcept(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Please enter a valid jewelry description");
  });
});
