import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext, AuthRequiredError, CompanyAccessError } from "@/lib/company";
import { buildQuotePdfStorageKey, deleteQuotePdfFromS3 } from "@/lib/quote-pdf-s3";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    quoteId: string;
  }>;
};

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
        companyId: true,
        quoteNumber: true,
        pdfStorageKey: true
      }
    });

    if (!quote) {
      return NextResponse.json({ error: "Quote not found." }, { status: 404 });
    }

    const storageKey = quote.pdfStorageKey || buildQuotePdfStorageKey(quote.companyId, quote.quoteNumber);
    if (storageKey) {
      await deleteQuotePdfFromS3(storageKey).catch(() => undefined);
    }

    await prisma.quote.delete({
      where: { id: quote.id }
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
      { error: error instanceof Error ? error.message : "Unable to delete quote." },
      { status: 400 }
    );
  }
}
