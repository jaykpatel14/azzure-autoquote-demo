import { stripNullBytes } from "@/lib/sanitize";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { ZodError, z } from "zod";
import { prisma } from "@/lib/prisma";
import { METAL_TYPES } from "@/lib/pricing";
import {
  requireCompanyContext,
  requireAdminSalesContext,
  AuthRequiredError,
  CompanyAccessError,
  canCreateQuotes
} from "@/lib/company";
import { assertBillableSubscription, BillingAccessError } from "@/lib/billing";
import {
  releaseMonthlyUsage,
  reserveMonthlyUsage,
  UsageLimitError
} from "@/lib/usage";
import { getJewelryAnalysisProvider } from "@/lib/ai/provider-factory";
import {
  aggregateJewelryAnalysis,
  runModerationCheck,
  runReviewAttempt
} from "@/lib/ai/runner";
import {
  AttemptFailedError,
  ModerationRejectedError,
  getAnalysisErrorMessage,
  serializeError
} from "@/lib/ai/errors";
import type { JewelryAnalysis } from "@/lib/ai/schema";
import { hasAllowedImageSignature, detectImageMimeType } from "@/lib/security";
import { getFeaturesForPlan, resolvePlanId } from "@/src/stripe/plans";
import {
  buildAnalysisImageStorageKey,
  storeAnalysisImageInS3,
  loadQuoteRenderingDataUrlFromS3
} from "@/lib/quote-pdf-s3";
import { recordQuoteOverage } from "@/lib/stripe-metering";
import { generateAnalysisRendering } from "@/lib/ai/quote-rendering";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const metalTypeSchema = z.enum(METAL_TYPES);

export async function POST(request: Request) {
  let analysisId: string | undefined;
  let reservation: { usagePeriodId: string; isOverage: boolean } | undefined;

  try {
    
    const form = await request.formData();
    const assignedCompanyId = form.get("assignedCompanyId") as string | null;

    let companyContext;
    if (assignedCompanyId) {
      companyContext = await requireAdminSalesContext(assignedCompanyId) as any;
    } else {
      companyContext = await requireCompanyContext();
    }
    if (!canCreateQuotes(companyContext.membership?.role ?? "CUSTOMER")) {
      throw new CompanyAccessError("You do not have permission to create estimates.");
    }
    if (companyContext.company.accountStatus !== "APPROVED" || !companyContext.company.pricingTier) {
      throw new CompanyAccessError("Account approval and a pricing tier are required to create quotes.");
    }
    if (assignedCompanyId !== "INTERNAL") {
      assertBillableSubscription(companyContext.company.subscription);
    }
    const rawImages = [
      ...form.getAll("images"),
      ...form.getAll("image"),
      ...form.getAll("files")
    ].filter((item): item is File => item instanceof File && item.size > 0);
    const selectedMetal = metalTypeSchema.parse(form.get("metalType") || "14K");
    const customerDescription = String(form.get("description") || "").trim().slice(0, 1000);

    const hasImages = rawImages.length > 0;
    const hasDescription = customerDescription.length > 0;

    if (!hasImages && !hasDescription) {
      return NextResponse.json(
        { error: "Please upload a reference photo or describe your custom design to analyze." },
        { status: 400 }
      );
    }

    const imageDataUrls: string[] = [];
    let primaryImageType: string | null = null;
    let primaryImageSizeBytes: number = 0;
    let primaryBytes: Buffer | null = null;

    for (const image of rawImages.slice(0, 1)) {
      if (image.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File "${image.name}" exceeds 10 MB.` },
          { status: 400 }
        );
      }

      const fileBytes = Buffer.from(await image.arrayBuffer());
      const detectedType = detectImageMimeType(fileBytes);
      if (!detectedType) {
        return NextResponse.json(
          { error: `File "${image.name}" is not a valid JPG, PNG, or WEBP image.` },
          { status: 400 }
        );
      }

      if (!primaryBytes) {
        primaryBytes = fileBytes;
        primaryImageType = detectedType;
        primaryImageSizeBytes = image.size;
      }

      imageDataUrls.push(`data:${detectedType};base64,${fileBytes.toString("base64")}`);
    }

    reservation = await reserveMonthlyUsage(companyContext.company.id);

    const provider = await getJewelryAnalysisProvider();
    const configuredReviewCount = Number(process.env.AI_REVIEW_COUNT || 3);
    const configuredLimit = Number.isFinite(configuredReviewCount)
      ? Math.max(1, Math.min(3, configuredReviewCount))
      : 3;
    const subscription = companyContext.company.subscription;
    if (!subscription) throw new BillingAccessError("An active subscription is required.");
    const features = getFeaturesForPlan(resolvePlanId(subscription.plan, subscription.status));
    const entitledReviewCount = features.aiPasses;
    const reviewCount = Math.min(configuredLimit, entitledReviewCount);
    const confirmedExamples = await prisma.quote.findMany({
      where: {
        companyId: companyContext.company.id,
        analysis: { isNot: null }
      },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        metalType: true,
        metalWeightGrams: true,
        centerDiamondCarats: true,
        sideDiamondCarats: true,
        sideDiamondQuantity: true,
        analysis: {
          select: {
            jewelryType: true,
            centerShape: true,
            settingType: true
          }
        }
      }
    });
    const learnedGuidance = confirmedExamples.map((example) =>
      [
        example.analysis?.jewelryType || "Jewelry",
        `${example.metalType} metal`,
        `${Number(example.metalWeightGrams).toFixed(2)} g`,
        `${example.analysis?.centerShape || "unspecified"} center at ${Number(example.centerDiamondCarats).toFixed(2)} ct`,
        `${Number(example.sideDiamondCarats).toFixed(2)} ct across ${example.sideDiamondQuantity} side stones`,
        `${example.analysis?.settingType || "unspecified"} setting`
      ].join(", ")
    );

    const analysis = await prisma.aiAnalysis.create({
      data: {
        companyId: companyContext.company.id,
        provider: provider.name,
        model: provider.model,
        modelVersion: provider.modelVersion,
        promptVersion: provider.promptVersion,
        imageDataUrl: null,
        sourceImageMimeType: primaryImageType,
        sourceImageSizeBytes: primaryImageSizeBytes,
        selectedMetal,
        reviewCount,
        status: "PROCESSING"
      }
    });
    analysisId = analysis.id;

    if (primaryBytes && primaryImageType) {
      const analysisImageStorageKey = buildAnalysisImageStorageKey(companyContext.company.id, analysis.id, primaryImageType);
      const storedImage = features.s3ImagePersistence
        ? await storeAnalysisImageInS3({ key: analysisImageStorageKey, buffer: primaryBytes, contentType: primaryImageType })
        : null;

      await prisma.aiAnalysis.update({
        where: { id: analysis.id },
        data: storedImage
          ? {
              sourceImageStorageKey: storedImage.key,
              imageDataUrl: null
            }
          : { imageDataUrl: features.s3ImagePersistence ? imageDataUrls[0] : null }
      });
    }

    const moderation = await runModerationCheck({
      provider,
      imageDataUrls,
      text: customerDescription
    });

    await prisma.aiAnalysis.update({
      where: { id: analysis.id },
      data: {
        moderationModel: moderation.model,
        moderationFlagged: moderation.flagged,
        moderationResult: stripNullBytes(moderation.rawResponse) as Prisma.InputJsonValue
      }
    });

    if (moderation.flagged) {
      throw new ModerationRejectedError();
    }

    const reviews: JewelryAnalysis[] = [];
    for (let attemptNumber = 1; attemptNumber <= reviewCount; attemptNumber += 1) {
      const attemptResult = await runReviewAttempt({
        provider,
        imageDataUrls,
        selectedMetal,
        attemptNumber,
        customerDescription: customerDescription || undefined,
        learnedGuidance
      });

      if (attemptResult.kind === "success") {
        reviews.push(attemptResult.result.output);

        await prisma.aiAttempt.create({
          data: {
            analysisId: analysis.id,
            attemptNumber,
            provider: provider.name,
            model: provider.model,
            modelVersion: provider.modelVersion,
            promptVersion: provider.promptVersion,
            responseId: attemptResult.result.responseId ? stripNullBytes(attemptResult.result.responseId) : null,
            retryCount: attemptResult.retryCount,
            latencyMs: attemptResult.latencyMs,
            promptTokens: attemptResult.result.usage?.inputTokens,
            completionTokens: attemptResult.result.usage?.outputTokens,
            totalTokens: attemptResult.result.usage?.totalTokens,
            metalWeightGrams: attemptResult.result.output.metal_weight_grams,
            centerDiamondCarats: attemptResult.result.output.centerStone?.caratWeight ?? 0,
            sideDiamondCarats: (attemptResult.result.output.sideStones || []).reduce(
              (acc, ss) => acc + ss.caratWeightEach * ss.count,
              0
            ),
            sideDiamondQuantity: (attemptResult.result.output.sideStones || []).reduce(
              (acc, ss) => acc + ss.count,
              0
            ),
            confidence: attemptResult.result.output.confidence,
            notes: stripNullBytes(attemptResult.result.output.assumptions.join(" | ")),
            output: stripNullBytes(attemptResult.result.output) as unknown as Prisma.InputJsonValue,
            rawResponse: stripNullBytes(attemptResult.result.rawResponse) as Prisma.InputJsonValue
          }
        });
        continue;
      }

      await prisma.aiAttempt.create({
        data: {
          analysisId: analysis.id,
          attemptNumber,
          provider: provider.name,
          model: provider.model,
          modelVersion: provider.modelVersion,
          promptVersion: provider.promptVersion,
          retryCount: attemptResult.retryCount,
          latencyMs: attemptResult.latencyMs,
          errorMessage: attemptResult.failure.error.message ? stripNullBytes(attemptResult.failure.error.message) : null,
          errorCode: attemptResult.failure.error.code ? stripNullBytes(attemptResult.failure.error.code) : null,
          errorType: attemptResult.failure.error.type ? stripNullBytes(attemptResult.failure.error.type) : null,
          rawResponse: stripNullBytes(attemptResult.failure.error) as Prisma.InputJsonValue
        }
      });

      throw new AttemptFailedError(
        attemptResult.failure.error.message,
        attemptResult.retryCount,
        attemptResult.latencyMs,
        attemptResult.failure.error
      );
    }

    if (reviews.length === 0) {
      throw new Error("No analysis reviews were completed.");
    }

    const merged = aggregateJewelryAnalysis(reviews, selectedMetal);
    const usagePeriodId = reservation.usagePeriodId;
    if (reservation.isOverage) {
      await recordQuoteOverage({ stripeCustomerId: subscription.stripeCustomerId, analysisId: analysis.id });
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.aiAnalysis.update({
        where: { id: analysis.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          jewelryType: merged.jewelryType ? stripNullBytes(merged.jewelryType) : null,
          selectedMetal: merged.selectedMetal ? stripNullBytes(merged.selectedMetal) : selectedMetal,
          metalWeightGrams: merged.metalWeightGrams,
          centerDiamondCarats: merged.centerDiamondCarats,
          sideDiamondCarats: merged.sideDiamondCarats,
          sideDiamondQuantity: merged.sideDiamondQuantity,
          confidence: merged.confidence ? stripNullBytes(merged.confidence) : "medium",
          centerShape: merged.centerShape ? stripNullBytes(merged.centerShape) : null,
          centerClarity: merged.centerClarity ? stripNullBytes(merged.centerClarity) : null,
          settingType: merged.settingType ? stripNullBytes(merged.settingType) : null,
          assumptions: stripNullBytes(merged.assumptions) as Prisma.InputJsonValue,
          notes: stripNullBytes(merged.notes),
          output: stripNullBytes(merged) as unknown as Prisma.InputJsonValue
        }
      });
      await tx.usagePeriod.update({
        where: { id: usagePeriodId },
        data: {
          reserved: { decrement: 1 },
          used: { increment: 1 }
        }
      });
      if (subscription.status === "TRIALING") {
        await tx.subscription.update({ where: { companyId: companyContext.company.id }, data: { trialQuotesUsed: { increment: 1 } } });
      }
    });
    reservation = undefined;

    let renderingImageUrl: string | null = null;
    let renderingStatus: "COMPLETED" | "FAILED" | "SKIPPED" = "SKIPPED";

    if (features.canGenerateAIImages) {
      const rendering = await generateAnalysisRendering({
        analysisId: analysis.id,
        companyId: companyContext.company.id
      });
      renderingStatus = rendering.status;

      if (rendering.status === "COMPLETED") {
        renderingImageUrl = rendering.storageKey
          ? await loadQuoteRenderingDataUrlFromS3(rendering.storageKey)
          : rendering.imageUrl;
      }
    }

    return NextResponse.json({
      analysisId: analysis.id,
      provider: provider.name,
      modelVersion: provider.modelVersion,
      promptVersion: provider.promptVersion,
      renderingStatus,
      renderingImageUrl,
      ...merged
    });
  } catch (error) {
    if (reservation) {
      await releaseMonthlyUsage(reservation.usagePeriodId).catch(() => undefined);
    }

    if (analysisId) {
      await prisma.aiAnalysis.update({
        where: { id: analysisId },
        data: {
          status: "FAILED",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          output: error instanceof Error ? { ...serializeError(error) } : undefined
        }
      }).catch(() => undefined);
    }

    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof CompanyAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof BillingAccessError) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }

    if (error instanceof ModerationRejectedError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    if (error instanceof UsageLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }

    if (error instanceof AttemptFailedError) {
      return NextResponse.json(
        { error: getAnalysisErrorMessage(error.serializedError), retryCount: error.retryCount },
        { status: 502 }
      );
    }

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid request." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed." },
      { status: 500 }
    );
  }
}
