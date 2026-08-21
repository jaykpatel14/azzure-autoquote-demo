import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireInternalAdminContext, InternalAdminAccessError } from "@/lib/internal-admin";
import { loadAnalysisImageFromS3 } from "@/lib/quote-pdf-s3";

export const runtime = "nodejs";

const paramsSchema = z.object({
  analysisId: z.string().cuid()
});

type RouteContext = {
  params: Promise<{
    analysisId: string;
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
    await requireInternalAdminContext();
    const parsed = paramsSchema.safeParse(await params);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid analysis id." }, { status: 400 });
    }

    const analysis = await prisma.aiAnalysis.findUnique({
      where: { id: parsed.data.analysisId },
      select: {
        renderingStorageKey: true,
        renderingDataUrl: true,
        renderingMimeType: true,
        sourceImageStorageKey: true,
        sourceImageMimeType: true,
        imageDataUrl: true
      }
    });

    if (!analysis) {
      return NextResponse.json({ error: "Analysis image not found." }, { status: 404 });
    }

    // 1. Try AI Visualization Render from S3
    if (analysis.renderingStorageKey) {
      const buffer = await loadAnalysisImageFromS3(analysis.renderingStorageKey);
      if (buffer) {
        return new NextResponse(new Uint8Array(buffer), {
          status: 200,
          headers: {
            "Content-Type": analysis.renderingMimeType || "image/jpeg",
            "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800"
          }
        });
      }
    }

    // 2. Try AI Visualization Render from Data URL
    if (analysis.renderingDataUrl) {
      const parsedData = parseDataUrl(analysis.renderingDataUrl);
      if (parsedData) {
        return new NextResponse(new Uint8Array(parsedData.buffer), {
          status: 200,
          headers: {
            "Content-Type": parsedData.contentType,
            "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800"
          }
        });
      }
    }

    // 3. Try Source Reference Image from S3
    if (analysis.sourceImageStorageKey) {
      const buffer = await loadAnalysisImageFromS3(analysis.sourceImageStorageKey);
      if (buffer) {
        return new NextResponse(new Uint8Array(buffer), {
          status: 200,
          headers: {
            "Content-Type": analysis.sourceImageMimeType || "image/jpeg",
            "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800"
          }
        });
      }
    }

    // 4. Try Source Reference Image from Data URL
    if (analysis.imageDataUrl) {
      const parsedData = parseDataUrl(analysis.imageDataUrl);
      if (parsedData) {
        return new NextResponse(new Uint8Array(parsedData.buffer), {
          status: 200,
          headers: {
            "Content-Type": parsedData.contentType,
            "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800"
          }
        });
      }
    }

    return NextResponse.json({ error: "No image found for this analysis." }, { status: 404 });
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load analysis image." },
      { status: 500 }
    );
  }
}
