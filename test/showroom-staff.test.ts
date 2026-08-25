import { describe, expect, it, vi } from "vitest";
import {
  getStaffRecentQuotes,
  getStaffQuoteDetail
} from "@/lib/showroom-staff";
import { normalizeShowroomCode } from "@/lib/showroom";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    showroomQuote: {
      findMany: vi.fn().mockImplementation(async ({ where }: { where: { companyId: string } }) => {
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
      }),
      findUnique: vi.fn().mockImplementation(async ({ where }: { where: { companyId_displayCode: { companyId: string; displayCode: string } } }) => {
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
      })
    }
  }
}));

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
});
