import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadQuotePdfFromS3 } from "@/lib/quote-pdf-s3";
import { contentTypeFor3DFormat } from "@/lib/meshy/storage";

export const runtime = "nodejs";

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const format = (searchParams.get("format") || "glb").toLowerCase() as "glb" | "usdz" | "obj" | "fbx";

    const modelRecord = await prisma.quote3DModel.findUnique({
      where: { id }
    });

    if (!modelRecord || modelRecord.status !== "SUCCEEDED") {
      return NextResponse.json({ error: "3D model not ready or not found" }, { status: 404 });
    }

    let storageKey: string | null = null;
    let fallbackUrl: string | null = null;

    if (format === "glb") {
      storageKey = modelRecord.glbStorageKey;
      fallbackUrl = modelRecord.glbUrl;
    } else if (format === "usdz") {
      storageKey = modelRecord.usdzStorageKey;
      fallbackUrl = modelRecord.usdzUrl;
    } else if (format === "obj") {
      storageKey = modelRecord.objStorageKey;
      fallbackUrl = modelRecord.objUrl;
    } else if (format === "fbx") {
      fallbackUrl = modelRecord.fbxUrl;
    }

    if (storageKey) {
      const fileBuffer = await loadQuotePdfFromS3(storageKey);
      if (fileBuffer) {
        const contentType = contentTypeFor3DFormat(format);
        return new Response(fileBuffer, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="jewelry-3d-model-${modelRecord.id.slice(-6)}.${format}"`
          }
        });
      }
    }

    if (fallbackUrl) {
      return NextResponse.redirect(fallbackUrl);
    }

    return NextResponse.json({ error: `Format .${format} not available for this model.` }, { status: 404 });
  } catch (error: any) {
    console.error("[3D Download Error]", error);
    return NextResponse.json({ error: error?.message || "Failed to download 3D model" }, { status: 500 });
  }
}
