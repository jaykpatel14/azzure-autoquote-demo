import { describe, expect, test } from "vitest";
import { generateQuotePdfBuffer } from "@/lib/pdf/quote";

describe("quote pdf generation", () => {
  test("creates a PDF buffer containing the quote number, images on pro/enterprise, and customer-safe summary", async () => {
    const buffer = await generateQuotePdfBuffer({
      companyName: "Demo Jewelry",
      quoteNumber: "Q-2026-001",
      createdAt: new Date("2026-07-28T12:00:00.000Z"),
      customerName: "Acme",
      customerImageDataUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5o1e0AAAAASUVORK5CYII=",
      metalType: "14K",
      metalWeightGrams: 5.2,
      centerDiamondCarats: 1,
      sideDiamondCarats: 0.35,
      sideDiamondQuantity: 18,
      estimatedPrice: 2196.8,
      jewelryType: "ring",
      centerShape: "round",
      hasPdfImages: true,
      branding: "custom_logo"
    });

    const pdfText = buffer.toString("latin1");
    expect(pdfText.startsWith("%PDF")).toBe(true);
    expect(pdfText).toContain("Q-2026-001");
    expect(pdfText).toContain("Demo Jewelry");
    expect(pdfText).toContain("/Subtype /Image");
  });

  test("Starter PDFs omit images and contain the AI AutoQuote watermark while white-label PDFs do not", async () => {
    const common = {
      companyName: "Demo Jewelry", quoteNumber: "Q-2026-002", createdAt: new Date("2026-07-28T12:00:00.000Z"),
      metalType: "14K", metalWeightGrams: 5, centerDiamondCarats: 1, sideDiamondCarats: 0.2, sideDiamondQuantity: 10, estimatedPrice: 2000,
      customerImageDataUrl:
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5o1e0AAAAASUVORK5CYII="
    };
    const starter = (await generateQuotePdfBuffer({ ...common, branding: "azzure_watermark", hasPdfImages: false })).toString("latin1");
    const enterprise = (await generateQuotePdfBuffer({ ...common, branding: "white_label", hasPdfImages: true })).toString("latin1");
    expect(starter).toContain("AI AutoQuote");
    expect(starter).not.toContain("/Subtype /Image");
    expect(enterprise).not.toContain("AI AutoQuote");
    expect(enterprise).toContain("/Subtype /Image");
  });
});
