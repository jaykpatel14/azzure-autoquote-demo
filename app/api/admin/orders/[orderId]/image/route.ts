import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireInternalAdminContext, InternalAdminAccessError } from "@/lib/internal-admin";
import { loadAnalysisImageFromS3 } from "@/lib/quote-pdf-s3";

export const runtime = "nodejs";

const paramsSchema = z.object({
  orderId: z.string().cuid()
});

type RouteContext = {
  params: Promise<{
    orderId: string;
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
      return NextResponse.json({ error: "Invalid order id." }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: parsed.data.orderId },
      select: {
        id: true,
        quote: {
          select: {
            renderingStorageKey: true,
            renderingDataUrl: true,
            renderingMimeType: true,
            analysis: {
              select: {
                renderingStorageKey: true,
                renderingDataUrl: true,
                renderingMimeType: true,
                sourceImageStorageKey: true,
                sourceImageMimeType: true,
                imageDataUrl: true
              }
            }
          }
        }
      }
    });

    if (!order || !order.quote) {
      return NextResponse.json({ error: "Order image not found." }, { status: 404 });
    }

    // 1. Try Quote Presentation Render from S3
    const renderKey = order.quote.renderingStorageKey || order.quote.analysis?.renderingStorageKey;
    if (renderKey) {
      const buffer = await loadAnalysisImageFromS3(renderKey);
      if (buffer) {
        return new NextResponse(new Uint8Array(buffer), {
          status: 200,
          headers: {
            "Content-Type": order.quote.renderingMimeType || "image/jpeg",
            "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800"
          }
        });
      }
    }

    // 2. Try Quote Presentation Render from Data URL
    const renderDataUrl = order.quote.renderingDataUrl || order.quote.analysis?.renderingDataUrl;
    if (renderDataUrl) {
      const parsedData = parseDataUrl(renderDataUrl);
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
    if (order.quote.analysis?.sourceImageStorageKey) {
      const buffer = await loadAnalysisImageFromS3(order.quote.analysis.sourceImageStorageKey);
      if (buffer) {
        return new NextResponse(new Uint8Array(buffer), {
          status: 200,
          headers: {
            "Content-Type": order.quote.analysis.sourceImageMimeType || "image/jpeg",
            "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800"
          }
        });
      }
    }

    // 4. Try Source Reference Image from Data URL
    if (order.quote.analysis?.imageDataUrl) {
      const parsedData = parseDataUrl(order.quote.analysis.imageDataUrl);
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

    return NextResponse.json({ error: "No image found for this order." }, { status: 404 });
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load order image." },
      { status: 500 }
    );
  }
}
