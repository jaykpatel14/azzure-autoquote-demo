import { NextResponse, after } from "next/server";
import { type Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import {
  requireCompanyContext,
  requireAdminSalesContext,
  AuthRequiredError,
  CompanyAccessError,
  canCreateQuotes,
  isCompanyApproved,
  isCompanySuspended
} from "@/lib/company";
import { assertBillableSubscription, BillingAccessError } from "@/lib/billing";


import { assertPlanFeature, getCompanyPlanFeatures, PlanError } from "@/src/stripe/plans";
import { generateQuoteRendering } from "@/lib/ai/quote-rendering";
import { loadQuoteRenderingDataUrlFromS3 } from "@/lib/quote-pdf-s3";
import { processAndCreateQuote } from "@/src/services/quote-orchestrator";

export async function POST(request: Request) {
  try {
    
    const body = await request.json();
    const assignedCompanyId = body.assignedCompanyId as string | null;

    let companyContext;
    if (assignedCompanyId) {
      companyContext = await requireAdminSalesContext(assignedCompanyId);
    } else {
      companyContext = await requireCompanyContext();
    }

    if (assignedCompanyId !== "INTERNAL") {
      assertBillableSubscription(companyContext.company.subscription);
      await assertPlanFeature(companyContext.company.id, "canCreateQuotes");
    }
    
    if (!canCreateQuotes(companyContext.membership?.role ?? "CUSTOMER")) {
      throw new CompanyAccessError("You do not have permission to create quotes.");
    }
    if (isCompanySuspended(companyContext.company)) {
      throw new CompanyAccessError("Your account has been suspended. Contact Azzure support.");
    }
    if (!isCompanyApproved(companyContext.company)) {
      throw new CompanyAccessError("Your account is pending approval. You cannot create quotes yet.");
    }
    const { quoteResult, input, features } = await processAndCreateQuote(
      companyContext,
      assignedCompanyId,
      body
    );

    let renderingImageUrl: string | null = null;
    let renderingStatus: "COMPLETED" | "SKIPPED" | "PROCESSING" = "SKIPPED";

    if (features.canGenerateAIImages) {
      // The analysis step already generates a rendering automatically. Reuse it
      // instead of paying for a second OpenAI image generation on save.
      const existingRendering = input.analysisId
        ? await prisma.aiAnalysis.findUnique({
            where: { id: input.analysisId },
            select: {
              renderingStatus: true,
              renderingStorageKey: true,
              renderingDataUrl: true,
              renderingMimeType: true,
              renderingModel: true,
              renderingCreatedAt: true
            }
          })
        : null;

      if (existingRendering?.renderingStatus === "COMPLETED") {
        await prisma.quote.update({
          where: { id: quoteResult.data.id },
          data: {
            renderingStatus: "COMPLETED",
            renderingStorageKey: existingRendering.renderingStorageKey,
            renderingDataUrl: existingRendering.renderingDataUrl,
            renderingMimeType: existingRendering.renderingMimeType,
            renderingModel: existingRendering.renderingModel,
            renderingCreatedAt: existingRendering.renderingCreatedAt
          }
        });
        renderingStatus = "COMPLETED";
        renderingImageUrl = existingRendering.renderingStorageKey
          ? await loadQuoteRenderingDataUrlFromS3(existingRendering.renderingStorageKey)
          : existingRendering.renderingDataUrl ?? null;
      } else {
        // No rendering to reuse — generating one fresh takes 30-75s (OpenAI image
        // round trip). Don't block the save response on it; that made saves look
        // hung and risked exceeding any upstream request timeout. Generate it in
        // the background instead; the quote's renderingStatus flips to COMPLETED
        // once it's ready and is picked up next time the quote is viewed.
        const quoteId = quoteResult.data.id;
        const companyId = companyContext.company.id;
        const scheduleRender = () => {
          generateQuoteRendering({ quoteId, companyId }).catch(() => undefined);
        };
        try {
          after(scheduleRender);
        } catch {
          setImmediate(scheduleRender);
        }
        renderingStatus = "PROCESSING";
      }
    }

    return NextResponse.json({
      id: quoteResult.data.id,
      quoteNumber: quoteResult.data.quoteNumber,
      estimatedPrice: Number(quoteResult.data.estimatedPrice),
      renderingStatus,
      renderingImageUrl
    });
  } catch (error) {
    console.error("Quotes API Error:", error);
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: { message: error.issues[0]?.message || "Invalid request.", code: "BAD_REQUEST" } },
        { status: 400 }
      );
    }
    
    if (error instanceof CompanyAccessError || error instanceof AuthRequiredError || error instanceof BillingAccessError || error instanceof PlanError) {
      return NextResponse.json({ error: { message: error.message, code: "UNAUTHORIZED" } }, { status: 403 });
    }

    if (error && typeof error === "object" && "statusCode" in error && "userMessage" in error) {
      const appError = error as any;
      return NextResponse.json(
        { error: { message: appError.userMessage, code: appError.code || "INTERNAL_ERROR" } },
        { status: appError.statusCode }
      );
    }

    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : "Unable to save quote.", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
