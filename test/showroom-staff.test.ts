import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getStaffRecentQuotes,
  getStaffQuoteDetail
} from "@/lib/showroom-staff";
import { normalizeShowroomCode } from "@/lib/showroom";

const prismaShowroomQuoteFindManyMock = vi.hoisted(() => vi.fn());
const prismaShowroomQuoteFindUniqueMock = vi.hoisted(() => vi.fn());
const prismaShowroomQuoteUpdateMock = vi.hoisted(() => vi.fn());
const prismaQuoteUpdateMock = vi.hoisted(() => vi.fn());
const prismaAiAnalysisUpdateMock = vi.hoisted(() => vi.fn());
const prismaCompanyFindUniqueMock = vi.hoisted(() => vi.fn());
const loadAnalysisImageDataUrlFromS3Mock = vi.hoisted(() => vi.fn());
const loadQuoteRenderingDataUrlFromS3Mock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: {
    showroomQuote: {
      findMany: prismaShowroomQuoteFindManyMock,
      findUnique: prismaShowroomQuoteFindUniqueMock,
      update: prismaShowroomQuoteUpdateMock
    },
    quote: {
      update: prismaQuoteUpdateMock
    },
    aiAnalysis: {
      update: prismaAiAnalysisUpdateMock
    },
    company: {
      findUnique: prismaCompanyFindUniqueMock
    },
    appSetting: {
      findUnique: vi.fn().mockResolvedValue(null)
    }
  }
}));

vi.mock("@/lib/quote-pdf-s3", () => ({
  loadAnalysisImageDataUrlFromS3: loadAnalysisImageDataUrlFromS3Mock,
  loadQuoteRenderingDataUrlFromS3: loadQuoteRenderingDataUrlFromS3Mock
}));

vi.mock("@/lib/metal-pricing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/metal-pricing")>();
  return {
    ...actual,
    resolveMetalPricing: vi.fn().mockResolvedValue({
      source: "company_custom",
      pricingProfile: {
        goldSpotPerOz: 4500,
        platinumSpotPerOz: 2000,
        silverSpotPerOz: 300,
        cadCharge: 25,
        centerSettingPerCarat: 20,
        sideSettingPerStone: 3,
        sellingMarginDivisor: 0.7,
        finalMultiplier: 2,
        platinumLaborPct: 40,
        goldWastagePct: 25,
        roundSideSettingPerStone: 1.25,
        fancySideSettingPerStone: 5,
        waxPerPiece: 10,
        polishingPerPiece: 15
      }
    })
  };
});

describe("Showroom Code Normalization", () => {
  it("formats short and unformatted codes to canonical QT-XXXX", () => {
    expect(normalizeShowroomCode("4821")).toBe("QT-4821");
    expect(normalizeShowroomCode("qt-4821")).toBe("QT-4821");
    expect(normalizeShowroomCode("QT4821")).toBe("QT-4821");
    expect(normalizeShowroomCode("1")).toBe("QT-0001");
    expect(normalizeShowroomCode("42")).toBe("QT-0042");
  });

  it("returns null for invalid codes", () => {
    expect(normalizeShowroomCode("invalid_code")).toBeNull();
    expect(normalizeShowroomCode("")).toBeNull();
    expect(normalizeShowroomCode("12345")).toBeNull();
  });
});

describe("Staff Quote Lookup & Data Sanitization", () => {
  beforeEach(() => {
    prismaShowroomQuoteFindManyMock.mockReset();
    prismaShowroomQuoteFindUniqueMock.mockReset();
    prismaShowroomQuoteUpdateMock.mockReset();
    prismaQuoteUpdateMock.mockReset();
    prismaAiAnalysisUpdateMock.mockReset();
    prismaCompanyFindUniqueMock.mockReset();
    loadAnalysisImageDataUrlFromS3Mock.mockReset();
    loadQuoteRenderingDataUrlFromS3Mock.mockReset();

    prismaShowroomQuoteFindManyMock.mockImplementation(async ({ where }: { where: { companyId: string } }) => {
      if (where.companyId === "comp_123") {
        return [
          {
            id: "sq_1",
            displayCode: "QT-4821",
            status: "PENDING",
            createdAt: new Date("2026-08-25T12:00:00Z"),
            quote: {
              estimatedSellingPrice: 1666,
              estimatedPrice: 1666,
              metalType: "18K Yellow Gold",
              renderingDataUrl: "https://example.com/render.jpg",
              analysis: {
                jewelryType: "Ring",
                renderingImageUrl: "https://example.com/render.jpg"
              }
            }
          }
        ];
      }
      return [];
    });

    prismaShowroomQuoteFindUniqueMock.mockImplementation(async ({ where }: { where: { companyId_displayCode: { companyId: string; displayCode: string } } }) => {
      if (where.companyId_displayCode.companyId === "comp_123" && where.companyId_displayCode.displayCode === "QT-4821") {
        return {
          id: "sq_1",
          displayCode: "QT-4821",
          status: "PENDING",
          createdAt: new Date("2026-08-25T12:00:00Z"),
          customerNotes: "Engagement ring inquiry",
          quote: {
            metalType: "18K Yellow Gold",
            metalWeightGrams: 4.5,
            centerDiamondCarats: 1.5,
            sideDiamondCarats: 0.35,
            sideDiamondQuantity: 20,
            estimatedSellingPrice: 1666,
            estimatedPrice: 1666,
            renderingDataUrl: "https://example.com/render.jpg",
            analysis: {
              jewelryType: "Ring",
              centerShape: "Oval",
              settingType: "Prong",
              hasWeddingBand: false,
              isTwoTone: false,
              renderingImageUrl: "https://example.com/render.jpg"
            }
          }
        };
      }
      return null;
    });
  });

  it("loads staff images from S3 when only storage keys are present", async () => {
    loadAnalysisImageDataUrlFromS3Mock.mockResolvedValue("data:image/png;base64,uploaded");
    loadQuoteRenderingDataUrlFromS3Mock.mockResolvedValue("data:image/jpeg;base64,rendered");
    prismaShowroomQuoteFindUniqueMock.mockResolvedValueOnce({
      id: "sq_1",
      displayCode: "QT-4821",
      status: "PENDING",
      createdAt: new Date("2026-08-25T12:00:00Z"),
      customerNotes: "Engagement ring inquiry",
      quote: {
        metalType: "18K Yellow Gold",
        metalWeightGrams: 4.5,
        centerDiamondCarats: 1.5,
        sideDiamondCarats: 0.35,
        sideDiamondQuantity: 20,
        estimatedSellingPrice: 1666,
        estimatedPrice: 1666,
        renderingStorageKey: "renderings/comp_123/sq_1.jpg",
        renderingDataUrl: null,
        analysis: {
          jewelryType: "Ring",
          centerShape: "Oval",
          settingType: "Prong",
          hasWeddingBand: false,
          isTwoTone: false,
          sourceImageStorageKey: "analysis/comp_123/analysis_1.png",
          sourceImageMimeType: "image/png",
          imageDataUrl: null,
          renderingStorageKey: "renderings/comp_123/analysis-sq_1.jpg",
          renderingDataUrl: null
        }
      }
    } as never);

    const quote = await getStaffQuoteDetail("comp_123", "QT-4821");

    expect(quote?.uploadedImageUrl).toBe("data:image/png;base64,uploaded");
    expect(quote?.renderingImageUrl).toBe("data:image/jpeg;base64,rendered");
  });

  it("fetches recent showroom quotes without exposing internal cost fields", async () => {
    const quotes = await getStaffRecentQuotes("comp_123");
    expect(quotes.length).toBe(1);
    const q = quotes[0];
    expect(q.displayCode).toBe("QT-4821");
    expect(q.estimatedSellingPrice).toBe(1666);
    expect(q.metalType).toBe("18K Yellow Gold");

    // Ensure making price, margin divisor, and customerMarginPct are not exposed
    expect((q as Record<string, unknown>).makingPrice).toBeUndefined();
    expect((q as Record<string, unknown>).tierDivisor).toBeUndefined();
    expect((q as Record<string, unknown>).customerMarginPct).toBeUndefined();
  });

  it("fetches quote details scoped to the requesting company", async () => {
    const quote = await getStaffQuoteDetail("comp_123", "QT-4821");
    expect(quote).not.toBeNull();
    expect(quote?.displayCode).toBe("QT-4821");
    expect(quote?.specs.metalType).toBe("18K Yellow Gold");
    expect(quote?.specs.centerCarats).toBe(1.5);
    expect(quote?.specs.centerShape).toBe("Oval");
    expect(quote?.specs.sideDiamondQuantity).toBe(20);

    // Cross-tenant lookup must return null
    const foreignQuote = await getStaffQuoteDetail("other_comp", "QT-4821");
    expect(foreignQuote).toBeNull();
  });

  it("recalculates making price breakdown and updates quote when staff updates specs", async () => {
    const { updateStaffQuote } = await import("@/lib/showroom-staff");
    prismaCompanyFindUniqueMock.mockResolvedValue({
      accountStatus: "ACTIVE",
      pricingTier: "TIER_2",
      subscription: {
        status: "ACTIVE",
        plan: { id: "plan_enterprise", code: "enterprise" }
      }
    });
    prismaQuoteUpdateMock.mockResolvedValue({ id: "q_1" });
    prismaAiAnalysisUpdateMock.mockResolvedValue({ id: "analysis_1" });
    prismaShowroomQuoteUpdateMock.mockResolvedValue({ id: "sq_1" });

    await updateStaffQuote("comp_123", "QT-4821", {
      metalType: "Platinum",
      metalWeightGrams: 6.0,
      centerCarats: 2.0,
      centerShape: "Round",
      sideCarats: 0.5,
      sideDiamondQuantity: 10,
      customerNotes: "Customer requested platinum upgrade"
    });

    expect(prismaQuoteUpdateMock).toHaveBeenCalled();
    const updateArgs = prismaQuoteUpdateMock.mock.calls[0][0];
    expect(updateArgs.data.metalType).toBe("Platinum");
    expect(updateArgs.data.metalWeightGrams).toBe(6.0);
    expect(updateArgs.data.centerDiamondCarats).toBe(2.0);
    expect(updateArgs.data.makingPriceBreakdown).toBeDefined();
    expect(updateArgs.data.makingPriceBreakdown.subtotal).toBeGreaterThan(0);
    expect(updateArgs.data.makingPriceBreakdown.makingPrice).toBeGreaterThan(0);
    expect(updateArgs.data.makingPriceBreakdown.metalCost).toBeGreaterThan(0);
  });

  it("normalizes legacy or input status COMPLETED to valid ShowroomQuoteStatus CONVERTED", async () => {
    const { updateStaffQuote } = await import("@/lib/showroom-staff");
    prismaCompanyFindUniqueMock.mockResolvedValue({
      accountStatus: "ACTIVE",
      pricingTier: "TIER_2",
      subscription: {
        status: "ACTIVE",
        plan: { id: "plan_enterprise", code: "enterprise" }
      }
    });
    prismaQuoteUpdateMock.mockResolvedValue({ id: "q_1" });
    prismaShowroomQuoteUpdateMock.mockResolvedValue({ id: "sq_1" });

    await updateStaffQuote("comp_123", "QT-4821", {
      status: "COMPLETED" as any
    });

    expect(prismaShowroomQuoteUpdateMock).toHaveBeenCalled();
    const sqArgs = prismaShowroomQuoteUpdateMock.mock.calls[0][0];
    expect(sqArgs.data.status).toBe("CONVERTED");
    expect(sqArgs.data.convertedAt).toBeInstanceOf(Date);
  });
});

