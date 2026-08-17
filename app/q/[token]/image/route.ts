import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { loadAnalysisImageFromS3 } from "@/lib/quote-pdf-s3";

export const runtime = "nodejs";

const paramsSchema = z.object({
  token: z.string().min(1)
});

type RouteContext = {
  params: Promise<{
    token: string;
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
    const parsed = paramsSchema.safeParse(await params);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const quote = await prisma.quote.findUnique({
      where: {
        publicShareToken: parsed.data.token
      },
      select: {
        id: true,
        sharedAt: true,
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

    const expiresAt = quote.sharedAt ? new Date(quote.sharedAt.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
    if (!expiresAt || expiresAt <= new Date()) {
      return NextResponse.json({ error: "Quote link expired." }, { status: 404 });
    }

    if (quote.analysis.sourceImageStorageKey) {
      const buffer = await loadAnalysisImageFromS3(quote.analysis.sourceImageStorageKey);
      if (buffer) {
        return new NextResponse(new Uint8Array(buffer), {
          status: 200,
          headers: {
            "Content-Type": quote.analysis.sourceImageMimeType || "image/jpeg",
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800"
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
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800"
          }
        });
      }
    }

    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load image." },
      { status: 500 }
    );
  }
}
