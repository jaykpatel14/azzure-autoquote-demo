import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext, requireAdminSalesContext, AuthRequiredError, CompanyAccessError } from "@/lib/company";
import { createMeshyImageTo3DTask } from "@/lib/meshy/client";
import { loadQuoteRenderingDataUrlFromS3 } from "@/lib/quote-pdf-s3";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { quoteId, analysisId, imageUrl: customImageUrl } = body;

    let companyId: string;
    try {
      const companyContext = await requireCompanyContext();
      companyId = companyContext.company.id;
    } catch (err) {
      if (err instanceof AuthRequiredError || err instanceof CompanyAccessError) {
        const adminContext = await requireAdminSalesContext(body.assignedCompanyId || "INTERNAL");
        companyId = adminContext.company.id;
      } else {
        throw err;
      }
    }

    let sourceImageUrl: string | null = customImageUrl || null;
    let targetQuoteId: string | null = quoteId || null;
    let targetAnalysisId: string | null = analysisId || null;

    if (quoteId) {
      const quote = await prisma.quote.findUnique({
        where: { id: quoteId },
        include: { threeDModels: true }
      });
      if (!quote) {
        return NextResponse.json({ error: "Quote not found" }, { status: 404 });
      }

      // Check if a model already exists or is in progress
      const existing = quote.threeDModels.find(
        (m) => m.status === "IN_PROGRESS" || m.status === "SUCCEEDED" || m.status === "PENDING"
      );
      if (existing) {
        return NextResponse.json({ success: true, model: existing, message: "Existing 3D model found" });
      }

      if (!sourceImageUrl) {
        if (quote.renderingDataUrl) {
          sourceImageUrl = quote.renderingDataUrl;
        } else if (quote.renderingStorageKey) {
          sourceImageUrl = await loadQuoteRenderingDataUrlFromS3(quote.renderingStorageKey);
        }
      }
    } else if (analysisId) {
      const analysis = await prisma.aiAnalysis.findUnique({
        where: { id: analysisId },
        include: { threeDModels: true }
      });
      if (!analysis) {
        return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
      }

      const existing = analysis.threeDModels.find(
        (m) => m.status === "IN_PROGRESS" || m.status === "SUCCEEDED" || m.status === "PENDING"
      );
      if (existing) {
        return NextResponse.json({ success: true, model: existing, message: "Existing 3D model found" });
      }

      if (!sourceImageUrl) {
        if (analysis.renderingDataUrl) {
          sourceImageUrl = analysis.renderingDataUrl;
        } else if (analysis.renderingStorageKey) {
          sourceImageUrl = await loadQuoteRenderingDataUrlFromS3(analysis.renderingStorageKey);
        }
      }
    }

    if (!sourceImageUrl) {
      return NextResponse.json(
        { error: "No valid image render found to generate 3D model. Generate an OpenAI render first." },
        { status: 400 }
      );
    }

    // Initiate Meshy AI task
    const { taskId } = await createMeshyImageTo3DTask({
      imageUrl: sourceImageUrl,
      enablePbr: true,
      surfaceMode: "hard_surface",
      shouldRemesh: true
    });

    // Save record to DB
    const modelRecord = await prisma.quote3DModel.create({
      data: {
        companyId,
        quoteId: targetQuoteId,
        analysisId: targetAnalysisId,
        meshyTaskId: taskId,
        status: "IN_PROGRESS",
        progress: 0,
        sourceImageUrl: sourceImageUrl.startsWith("data:") ? "Data URI" : sourceImageUrl
      }
    });

    return NextResponse.json({
      success: true,
      taskId,
      model: modelRecord
    });
  } catch (error: any) {
    console.error("[3D Generate Error]", error);
    return NextResponse.json(
      { error: error?.message || "Failed to initiate 3D model generation." },
      { status: 500 }
    );
  }
}
