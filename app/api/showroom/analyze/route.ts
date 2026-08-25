import { stripNullBytes } from "@/lib/sanitize";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getActiveShowroom } from "@/lib/showroom";
import { hasAllowedImageSignature, detectImageMimeType } from "@/lib/security";
import { getJewelryAnalysisProvider } from "@/lib/ai/provider-factory";
import { aggregateJewelryAnalysis, runModerationCheck, runReviewAttempt } from "@/lib/ai/runner";
import { prisma } from "@/lib/prisma";
import {
  buildAnalysisImageStorageKey,
  storeAnalysisImageInS3,
  loadQuoteRenderingDataUrlFromS3
} from "@/lib/quote-pdf-s3";
import { METAL_TYPES, type MetalType } from "@/lib/pricing";
import { generateAnalysisRendering } from "@/lib/ai/quote-rendering";

export const runtime = "nodejs";

const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const token = String(form.get("token") || "");
    const rawImages = [
      ...form.getAll("images"),
      ...form.getAll("image"),
      ...form.getAll("files")
    ].filter((item): item is File => item instanceof File && item.size > 0);
    const requestedMetal = String(form.get("metalType") || "14K");
    const metalType: MetalType = METAL_TYPES.includes(requestedMetal as MetalType)
      ? (requestedMetal as MetalType)
      : "14K";
    const description = String(form.get("description") || "").trim().slice(0, 1000);

    const session = await getActiveShowroom(token);
    if (!session) {
      return NextResponse.json({ error: "This kiosk is not active." }, { status: 401 });
    }

    const hasImages = rawImages.length > 0;
    const hasDescription = description.length > 0;

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

    for (const image of rawImages.slice(0, 3)) {
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

    const provider = await getJewelryAnalysisProvider();
    const record = await prisma.aiAnalysis.create({
      data: {
        companyId: session.companyId,
        provider: provider.name,
        model: provider.model,
        modelVersion: provider.modelVersion,
        promptVersion: provider.promptVersion,
        selectedMetal: metalType,
        sourceImageMimeType: primaryImageType,
        sourceImageSizeBytes: primaryImageSizeBytes,
        reviewCount: 3,
        status: "PROCESSING"
      }
    });

    if (primaryBytes && primaryImageType) {
      const stored = await storeAnalysisImageInS3({
        key: buildAnalysisImageStorageKey(session.companyId, record.id, primaryImageType),
        buffer: primaryBytes,
        contentType: primaryImageType
      }).catch(() => null);

      await prisma.aiAnalysis.update({
        where: { id: record.id },
        data: stored ? { sourceImageStorageKey: stored.key } : { imageDataUrl: imageDataUrls[0] }
      });
    }

    const moderation = await runModerationCheck({
      provider,
      imageDataUrls,
      text: description
    });

    if (moderation.flagged) {
      throw new Error("That content cannot be analysed by our moderation system.");
    }

    const confirmed = await prisma.quote.findMany({
      where: { companyId: session.companyId, analysis: { isNot: null } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        metalType: true,
        metalWeightGrams: true,
        centerDiamondCarats: true,
        sideDiamondCarats: true,
        sideDiamondQuantity: true,
        analysis: { select: { jewelryType: true, centerShape: true, settingType: true } }
      }
    });

    const learnedGuidance = confirmed.map(
      (item) =>
        `${item.analysis?.jewelryType || "Jewelry"}, ${item.metalType}, ${Number(item.metalWeightGrams).toFixed(2)} g, ${item.analysis?.centerShape || "unspecified"} ${Number(item.centerDiamondCarats).toFixed(2)} ct center, ${Number(item.sideDiamondCarats).toFixed(2)} ct across ${item.sideDiamondQuantity} side stones, ${item.analysis?.settingType || "unspecified"} setting`
    );

    const outputs = [];
    for (let attemptNumber = 1; attemptNumber <= 3; attemptNumber++) {
      const attempt = await runReviewAttempt({
        provider,
        imageDataUrls,
        selectedMetal: metalType,
        attemptNumber,
        customerDescription: description || undefined,
        learnedGuidance
      });

      if (attempt.kind !== "success") {
        throw new Error("Jewelry analysis could not be completed.");
      }

      outputs.push(attempt.result.output);
      await prisma.aiAttempt.create({
        data: {
          analysisId: record.id,
          attemptNumber,
          provider: provider.name,
          model: provider.model,
          modelVersion: provider.modelVersion,
          promptVersion: provider.promptVersion,
          responseId: attempt.result.responseId ? stripNullBytes(attempt.result.responseId) : null,
          retryCount: attempt.retryCount,
          latencyMs: attempt.latencyMs,
          metalWeightGrams: attempt.result.output.metal_weight_grams,
          centerDiamondCarats: attempt.result.output.centerStone?.caratWeight || 0,
          sideDiamondCarats: (attempt.result.output.sideStones || []).reduce(
            (n, s) => n + s.caratWeightEach * s.count,
            0
          ),
          sideDiamondQuantity: (attempt.result.output.sideStones || []).reduce(
            (n, s) => n + s.count,
            0
          ),
          confidence: attempt.result.output.confidence,
          notes: stripNullBytes((attempt.result.output.assumptions || []).join(" | ")),
          output: stripNullBytes(attempt.result.output) as unknown as Prisma.InputJsonValue,
          rawResponse: stripNullBytes(attempt.result.rawResponse) as Prisma.InputJsonValue
        }
      });
    }

    const merged = aggregateJewelryAnalysis(outputs, metalType);

    await prisma.aiAnalysis.update({
      where: { id: record.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        jewelryType: merged.jewelryType ? stripNullBytes(merged.jewelryType) : null,
        selectedMetal: merged.selectedMetal ? stripNullBytes(merged.selectedMetal) : metalType,
        metalWeightGrams: merged.metalWeightGrams,
        centerDiamondCarats: merged.centerDiamondCarats,
        sideDiamondCarats: merged.sideDiamondCarats,
        sideDiamondQuantity: merged.sideDiamondQuantity,
        confidence: merged.confidence ? stripNullBytes(merged.confidence) : "medium",
        centerShape: merged.centerShape ? stripNullBytes(merged.centerShape) : null,
        centerClarity: "E VS1",
        settingType: merged.settingType ? stripNullBytes(merged.settingType) : null,
        assumptions: stripNullBytes(merged.assumptions) as Prisma.InputJsonValue,
        notes: stripNullBytes(merged.notes),
        output: stripNullBytes(merged) as unknown as Prisma.InputJsonValue
      }
    });

    let renderingImageUrl: string | null = null;
    let renderingStatus: "COMPLETED" | "FAILED" | "SKIPPED" = "SKIPPED";

    try {
      const rendering = await generateAnalysisRendering({
        analysisId: record.id,
        companyId: session.companyId
      });
      renderingStatus = rendering.status;
      if (rendering.status === "COMPLETED") {
        renderingImageUrl = rendering.storageKey
          ? await loadQuoteRenderingDataUrlFromS3(rendering.storageKey)
          : rendering.imageUrl;
      }
    } catch {
      renderingStatus = "FAILED";
    }

    return NextResponse.json({
      analysisId: record.id,
      jewelryType: merged.jewelryType,
      selectedMetal: merged.selectedMetal,
      metalWeightGrams: merged.metalWeightGrams,
      centerDiamondCarats: merged.centerDiamondCarats,
      sideDiamondCarats: merged.sideDiamondCarats,
      sideDiamondQuantity: merged.sideDiamondQuantity,
      centerShape: merged.centerShape,
      settingType: merged.settingType,
      hasWeddingBand: merged.hasWeddingBand,
      isTwoTone: merged.isTwoTone,
      renderingStatus,
      renderingImageUrl
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed." },
      { status: 500 }
    );
  }
}
