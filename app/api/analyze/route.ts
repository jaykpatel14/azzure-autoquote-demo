import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { ZodError, z } from "zod";
import { prisma } from "@/lib/prisma";
import { METAL_TYPES } from "@/lib/pricing";
import {
  requireCompanyContext,
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
import { hasAllowedImageSignature } from "@/lib/security";
import { getFeaturesForPlan, resolvePlanId } from "@/src/stripe/plans";
import {
  buildAnalysisImageStorageKey,
  storeAnalysisImageInS3
} from "@/lib/quote-pdf-s3";
import { recordQuoteOverage } from "@/lib/stripe-metering";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const metalTypeSchema = z.enum(METAL_TYPES);

export async function POST(request: Request) {
  let analysisId: string | undefined;
  let reservation: { usagePeriodId: string; isOverage: boolean } | undefined;

  try {
    const companyContext = await requireCompanyContext();
    if (!canCreateQuotes(companyContext.membership?.role ?? "CUSTOMER")) {
      throw new CompanyAccessError("You do not have permission to create estimates.");
    }
    if (companyContext.company.accountStatus !== "APPROVED" || !companyContext.company.pricingTier) {
      throw new CompanyAccessError("Account approval and a pricing tier are required to create quotes.");
    }
    assertBillableSubscription(companyContext.company.subscription);
    const form = await request.formData();
    const image = form.get("image");
    const selectedMetal = metalTypeSchema.parse(form.get("metalType") || "14K");

    if (!(image instanceof File)) {
      return NextResponse.json({ error: "Image is required." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(image.type) || image.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Use a JPG, PNG, or WEBP image smaller than 10 MB." },
        { status: 400 }
      );
    }

    const bytes = Buffer.from(await image.arrayBuffer());
    if (!hasAllowedImageSignature(bytes, image.type)) {
      return NextResponse.json(
        { error: "The uploaded file does not match its declared image type." },
        { status: 400 }
      );
    }

    reservation = await reserveMonthlyUsage(companyContext.company.id);

    const imageDataUrl = `data:${image.type};base64,${bytes.toString("base64")}`;
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

    const analysis = await prisma.aiAnalysis.create({
      data: {
        companyId: companyContext.company.id,
        provider: provider.name,
        model: provider.model,
        modelVersion: provider.modelVersion,
        promptVersion: provider.promptVersion,
        imageDataUrl: null,
        sourceImageMimeType: image.type,
        sourceImageSizeBytes: image.size,
        selectedMetal,
        reviewCount,
        status: "PROCESSING"
      }
    });
    analysisId = analysis.id;

    const analysisImageStorageKey = buildAnalysisImageStorageKey(companyContext.company.id, analysis.id, image.type);
    const storedImage = features.s3ImagePersistence
      ? await storeAnalysisImageInS3({ key: analysisImageStorageKey, buffer: bytes, contentType: image.type })
      : null;

    await prisma.aiAnalysis.update({
      where: { id: analysis.id },
      data: storedImage
        ? {
            sourceImageStorageKey: storedImage.key,
            imageDataUrl: null
          }
        : { imageDataUrl: features.s3ImagePersistence ? imageDataUrl : null }
    });

    const moderation = await runModerationCheck({
      provider,
      imageDataUrl
    });

    await prisma.aiAnalysis.update({
      where: { id: analysis.id },
      data: {
        moderationModel: moderation.model,
        moderationFlagged: moderation.flagged,
        moderationResult: moderation.rawResponse as Prisma.InputJsonValue
      }
    });

    if (moderation.flagged) {
      throw new ModerationRejectedError();
    }

    const reviews: JewelryAnalysis[] = [];
    for (let attemptNumber = 1; attemptNumber <= reviewCount; attemptNumber += 1) {
      const attemptResult = await runReviewAttempt({
        provider,
        imageDataUrl,
        selectedMetal,
        attemptNumber
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
            responseId: attemptResult.result.responseId,
            retryCount: attemptResult.retryCount,
            latencyMs: attemptResult.latencyMs,
            promptTokens: attemptResult.result.usage?.inputTokens,
            completionTokens: attemptResult.result.usage?.outputTokens,
            totalTokens: attemptResult.result.usage?.totalTokens,
            metalWeightGrams: attemptResult.result.output.metal_weight_grams,
            centerDiamondCarats: attemptResult.result.output.center_diamond_weight_ct,
            sideDiamondCarats: attemptResult.result.output.side_diamond_total_weight_ct,
            sideDiamondQuantity: attemptResult.result.output.side_diamond_quantity,
            confidence: attemptResult.result.output.confidence,
            notes: attemptResult.result.output.assumptions.join(" | "),
            output: attemptResult.result.output,
            rawResponse: attemptResult.result.rawResponse as Prisma.InputJsonValue
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
          errorMessage: attemptResult.failure.error.message,
          errorCode: attemptResult.failure.error.code,
          errorType: attemptResult.failure.error.type,
          rawResponse: attemptResult.failure.error
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
          jewelryType: merged.jewelryType,
          selectedMetal: merged.selectedMetal,
          metalWeightGrams: merged.metalWeightGrams,
          centerDiamondCarats: merged.centerDiamondCarats,
          sideDiamondCarats: merged.sideDiamondCarats,
          sideDiamondQuantity: merged.sideDiamondQuantity,
          confidence: merged.confidence,
          centerShape: merged.centerShape,
          assumptions: merged.assumptions,
          notes: merged.notes,
          output: merged
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

    return NextResponse.json({
      analysisId: analysis.id,
      provider: provider.name,
      modelVersion: provider.modelVersion,
      promptVersion: provider.promptVersion,
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
