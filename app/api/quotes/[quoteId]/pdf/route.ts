import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext, AuthRequiredError, CompanyAccessError } from "@/lib/company";
import { generateQuotePdfBuffer } from "@/lib/pdf/quote";
import {
  buildQuotePdfStorageKey,
  loadQuotePdfFromS3,
  storeQuotePdfInS3
} from "@/lib/quote-pdf-s3";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    quoteId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const context = await requireCompanyContext("ESTIMATOR");
    const { quoteId } = await params;

    const quote = await prisma.quote.findFirst({
      where: {
        id: quoteId,
        companyId: context.company.id
      },
      include: {
        company: {
          select: {
            name: true
          }
        },
        analysis: {
          select: {
            jewelryType: true,
            centerShape: true
          }
        }
      }
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found." }, { status: 404 });
    }

    if (quote.pdfStorageKey) {
      const storedPdf = await loadQuotePdfFromS3(quote.pdfStorageKey);
      if (storedPdf) {
        return new NextResponse(new Uint8Array(storedPdf), {
          headers: {
            "Content-Type": quote.pdfContentType || "application/pdf",
            "Content-Disposition": `attachment; filename="${quote.quoteNumber}.pdf"`,
            "Cache-Control": "no-store"
          }
        });
      }
    }

    const pdfBuffer = await generateQuotePdfBuffer({
      companyName: quote.company.name,
      quoteNumber: quote.quoteNumber,
      createdAt: quote.createdAt,
      customerName: quote.customerName,
      metalType: quote.metalType,
      metalWeightGrams: Number(quote.metalWeightGrams),
      centerDiamondCarats: Number(quote.centerDiamondCarats),
      sideDiamondCarats: Number(quote.sideDiamondCarats),
      sideDiamondQuantity: quote.sideDiamondQuantity,
      estimatedPrice: Number(quote.estimatedPrice),
      jewelryType: quote.analysis?.jewelryType,
      centerShape: quote.analysis?.centerShape
    });

    const storageKey = quote.pdfStorageKey || buildQuotePdfStorageKey(quote.companyId, quote.quoteNumber);
    const stored = await storeQuotePdfInS3({
      key: storageKey,
      buffer: pdfBuffer
    });

    if (stored) {
      await prisma.quote
        .update({
          where: { id: quote.id },
          data: {
            pdfStorageKey: stored.key,
            pdfStoredAt: new Date(),
            pdfContentType: "application/pdf"
          }
        })
        .catch(() => undefined);
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${quote.quoteNumber}.pdf"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof CompanyAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate PDF." },
      { status: 400 }
    );
  }
}
