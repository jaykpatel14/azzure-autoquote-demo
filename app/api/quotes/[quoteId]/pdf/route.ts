import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireCompanyContext,
  AuthRequiredError,
  CompanyAccessError,
  canViewQuotes
} from "@/lib/company";
import { deleteQuotePdfFromS3, buildQuotePdfStorageKey } from "@/lib/quote-pdf-s3";
import { generateAndStoreQuotePdf } from "@/src/services/quote-pdf";
import { assertPlanFeature, PlanError } from "@/src/stripe/plans";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    quoteId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const context = await requireCompanyContext();
    await assertPlanFeature(context.company.id, "canDownloadPDF");
    if (!canViewQuotes(context.membership?.role ?? "CUSTOMER")) {
      throw new CompanyAccessError("You do not have permission to view quote PDFs.");
    }
    const { quoteId } = await params;

    const result = await generateAndStoreQuotePdf({
      quoteId,
      companyId: context.company.id,
      customerNameFallback: context.user.name
    });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error.userMessage },
        { status: result.error.statusCode }
      );
    }

    return new NextResponse(new Uint8Array(result.data.buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${result.data.quoteNumber}.pdf"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    if (error instanceof PlanError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
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

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const context = await requireCompanyContext();
    const { quoteId } = await params;

    const quote = await prisma.quote.findFirst({
      where: {
        id: quoteId,
        companyId: context.company.id
      },
      select: {
        id: true,
        pdfStorageKey: true,
        quoteNumber: true,
        companyId: true
      }
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found." }, { status: 404 });
    }

    const storageKey = quote.pdfStorageKey || buildQuotePdfStorageKey(quote.companyId, quote.quoteNumber);
    await deleteQuotePdfFromS3(storageKey).catch(() => undefined);

    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        pdfStorageKey: null,
        pdfStoredAt: null,
        pdfContentType: null
      }
    });

    return NextResponse.json({
      ok: true,
      quoteNumber: quote.quoteNumber
    });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof CompanyAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete PDF." },
      { status: 400 }
    );
  }
}
