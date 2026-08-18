import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireCompanyContext,
  AuthRequiredError,
  CompanyAccessError,
  canViewQuotes
} from "@/lib/company";
import { loadAnalysisImageFromS3 } from "@/lib/quote-pdf-s3";

export const runtime = "nodejs";

const paramsSchema = z.object({
  quoteId: z.string().cuid()
});

type RouteContext = {
  params: Promise<{
    quoteId: string;
  }>;
};

function parseDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    contentType: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const context = await requireCompanyContext();
    if (!canViewQuotes(context.membership?.role ?? "CUSTOMER")) {
      throw new CompanyAccessError("You do not have permission to view quotes.");
    }
    const parsed = paramsSchema.safeParse(await params);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const quote = await prisma.quote.findFirst({
      where: {
        id: parsed.data.quoteId,
        companyId: context.company.id
      },
      select: {
        id: true,
        analysis: {
          select: {
            sourceImageStorageKey: true,
            sourceImageMimeType: true,
            imageDataUrl: true
          }
        }
      }
    });

    if (!quote || !quote.analysis) {
      return NextResponse.json({ error: "Image not found." }, { status: 404 });
    }

    if (quote.analysis.sourceImageStorageKey) {
      const buffer = await loadAnalysisImageFromS3(quote.analysis.sourceImageStorageKey);
      if (buffer) {
        return new NextResponse(new Uint8Array(buffer), {
          status: 200,
          headers: {
            "Content-Type": quote.analysis.sourceImageMimeType || "image/jpeg",
            "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800"
          }
        });
      }
    }

    if (quote.analysis.imageDataUrl) {
      const parsedDataUrl = parseDataUrl(quote.analysis.imageDataUrl);
      if (parsedDataUrl) {
        return new NextResponse(new Uint8Array(parsedDataUrl.buffer), {
          status: 200,
          headers: {
            "Content-Type": parsedDataUrl.contentType,
            "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800"
          }
        });
      }
    }

    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof CompanyAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load image." },
      { status: 500 }
    );
  }
}
