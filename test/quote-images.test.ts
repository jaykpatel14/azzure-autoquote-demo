import { beforeEach, describe, expect, test, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  quote: {
    findFirst: vi.fn(),
    findUnique: vi.fn()
  },
  aiAnalysis: {
    findFirst: vi.fn()
  }
}));

const companyContextMock = vi.hoisted(() => vi.fn());
const loadAnalysisImageFromS3Mock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock
}));

vi.mock("@/lib/company", () => ({
  requireCompanyContext: companyContextMock,
  AuthRequiredError: class AuthRequiredError extends Error {},
  CompanyAccessError: class CompanyAccessError extends Error {},
  canViewQuotes: vi.fn(() => true)
}));

vi.mock("@/lib/quote-pdf-s3", () => ({
  loadAnalysisImageFromS3: loadAnalysisImageFromS3Mock
}));

import { GET as getQuoteImage } from "@/app/api/quotes/[quoteId]/image/route";
import { GET as getAnalysisImage } from "@/app/api/analyze/[analysisId]/image/route";
import { GET as getPublicQuoteImage } from "@/app/q/[token]/image/route";

describe("quote and analysis image endpoints", () => {
  const samplePngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const sampleDataUrl = "data:image/png;base64,iVBORw0KGgo=";

  beforeEach(() => {
    companyContextMock.mockReset();
    loadAnalysisImageFromS3Mock.mockReset();
    prismaMock.quote.findFirst.mockReset();
    prismaMock.quote.findUnique.mockReset();
    prismaMock.aiAnalysis.findFirst.mockReset();
  });

  describe("GET /api/quotes/[quoteId]/image", () => {
    test("serves image buffer from S3 when sourceImageStorageKey is present", async () => {
      companyContextMock.mockResolvedValue({
        company: { id: "company_1" },
        membership: { role: "ADMIN" }
      });
      prismaMock.quote.findFirst.mockResolvedValue({
        id: "clxyz12345678901234567890",
        analysis: {
          sourceImageStorageKey: "analysis/company_1/analysis_1.png",
          sourceImageMimeType: "image/png",
          imageDataUrl: null
        }
      });
      loadAnalysisImageFromS3Mock.mockResolvedValue(samplePngBuffer);

      const request = new Request("http://localhost/api/quotes/clxyz12345678901234567890/image");
      const response = await getQuoteImage(request, {
        params: Promise.resolve({ quoteId: "clxyz12345678901234567890" })
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("image/png");
      expect(response.headers.get("Cache-Control")).toContain("private");
      expect(loadAnalysisImageFromS3Mock).toHaveBeenCalledWith("analysis/company_1/analysis_1.png");
    });

    test("falls back to imageDataUrl when S3 key is not set", async () => {
      companyContextMock.mockResolvedValue({
        company: { id: "company_1" },
        membership: { role: "ESTIMATOR" }
      });
      prismaMock.quote.findFirst.mockResolvedValue({
        id: "clxyz12345678901234567890",
        analysis: {
          sourceImageStorageKey: null,
          sourceImageMimeType: null,
          imageDataUrl: sampleDataUrl
        }
      });

      const request = new Request("http://localhost/api/quotes/clxyz12345678901234567890/image");
      const response = await getQuoteImage(request, {
        params: Promise.resolve({ quoteId: "clxyz12345678901234567890" })
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("image/png");
    });

    test("returns 404 if quote is not found or has no image", async () => {
      companyContextMock.mockResolvedValue({
        company: { id: "company_1" },
        membership: { role: "ADMIN" }
      });
      prismaMock.quote.findFirst.mockResolvedValue(null);

      const request = new Request("http://localhost/api/quotes/clxyz12345678901234567890/image");
      const response = await getQuoteImage(request, {
        params: Promise.resolve({ quoteId: "clxyz12345678901234567890" })
      });

      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/analyze/[analysisId]/image", () => {
    test("serves image buffer from S3 for unsaved analysis", async () => {
      companyContextMock.mockResolvedValue({
        company: { id: "company_1" },
        membership: { role: "ADMIN" }
      });
      prismaMock.aiAnalysis.findFirst.mockResolvedValue({
        id: "clxyz12345678901234567890",
        sourceImageStorageKey: "analysis/company_1/analysis_2.jpg",
        sourceImageMimeType: "image/jpeg",
        imageDataUrl: null
      });
      loadAnalysisImageFromS3Mock.mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff]));

      const request = new Request("http://localhost/api/analyze/clxyz12345678901234567890/image");
      const response = await getAnalysisImage(request, {
        params: Promise.resolve({ analysisId: "clxyz12345678901234567890" })
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    });
  });

  describe("GET /q/[token]/image", () => {
    test("serves public shared quote image from S3 when valid and not expired", async () => {
      prismaMock.quote.findUnique.mockResolvedValue({
        id: "clxyz12345678901234567890",
        sharedAt: new Date(),
        analysis: {
          sourceImageStorageKey: "analysis/company_1/analysis_1.png",
          sourceImageMimeType: "image/png",
          imageDataUrl: null
        }
      });
      loadAnalysisImageFromS3Mock.mockResolvedValue(samplePngBuffer);

      const request = new Request("http://localhost/q/valid-token-123/image");
      const response = await getPublicQuoteImage(request, {
        params: Promise.resolve({ token: "valid-token-123" })
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("image/png");
      expect(response.headers.get("Cache-Control")).toContain("public");
    });

    test("returns 404 when public quote link has expired", async () => {
      const expiredDate = new Date();
      expiredDate.setDate(expiredDate.getDate() - 35); // 35 days ago

      prismaMock.quote.findUnique.mockResolvedValue({
        id: "clxyz12345678901234567890",
        sharedAt: expiredDate,
        analysis: {
          sourceImageStorageKey: "analysis/company_1/analysis_1.png",
          sourceImageMimeType: "image/png",
          imageDataUrl: null
        }
      });

      const request = new Request("http://localhost/q/expired-token-123/image");
      const response = await getPublicQuoteImage(request, {
        params: Promise.resolve({ token: "expired-token-123" })
      });

      expect(response.status).toBe(404);
    });
  });
});
