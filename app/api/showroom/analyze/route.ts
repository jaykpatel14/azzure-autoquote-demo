import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getActiveShowroom } from "@/lib/showroom";
import { hasAllowedImageSignature } from "@/lib/security";
import { getJewelryAnalysisProvider } from "@/lib/ai/provider-factory";
import { aggregateJewelryAnalysis, runModerationCheck, runReviewAttempt } from "@/lib/ai/runner";
import { prisma } from "@/lib/prisma";
import { buildAnalysisImageStorageKey, storeAnalysisImageInS3 } from "@/lib/quote-pdf-s3";
import { METAL_TYPES, type MetalType } from "@/lib/pricing";

const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const token = String(form.get("token") || "");
    const image = form.get("image");
    const requestedMetal = String(form.get("metalType") || "14K");
    const metalType: MetalType = METAL_TYPES.includes(requestedMetal as MetalType) ? requestedMetal as MetalType : "14K";
    const description = String(form.get("description") || "").trim().slice(0, 1000);
    const session = await getActiveShowroom(token);
    if (!session) return NextResponse.json({ error: "This kiosk is not active." }, { status: 401 });
    if (!(image instanceof File) || !TYPES.has(image.type) || image.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Use a JPG, PNG, or WEBP image smaller than 10 MB." }, { status: 400 });
    }
    const bytes = Buffer.from(await image.arrayBuffer());
    if (!hasAllowedImageSignature(bytes, image.type)) return NextResponse.json({ error: "The uploaded file is not a valid image." }, { status: 400 });
    const imageDataUrl = `data:${image.type};base64,${bytes.toString("base64")}`;
    const provider = await getJewelryAnalysisProvider();
    const record = await prisma.aiAnalysis.create({ data: { companyId: session.companyId, provider: provider.name, model: provider.model, modelVersion: provider.modelVersion, promptVersion: provider.promptVersion, selectedMetal: metalType, sourceImageMimeType: image.type, sourceImageSizeBytes: image.size, reviewCount: 3, status: "PROCESSING" } });
    const stored = await storeAnalysisImageInS3({ key: buildAnalysisImageStorageKey(session.companyId, record.id, image.type), buffer: bytes, contentType: image.type }).catch(() => null);
    await prisma.aiAnalysis.update({ where: { id: record.id }, data: stored ? { sourceImageStorageKey: stored.key } : { imageDataUrl } });
    const moderation = await runModerationCheck({ provider, imageDataUrl });
    if (moderation.flagged) throw new Error("That image cannot be analysed.");
    const confirmed = await prisma.quote.findMany({ where: { companyId: session.companyId, analysis: { isNot: null } }, orderBy: { createdAt: "desc" }, take: 8, select: { metalType: true, metalWeightGrams: true, centerDiamondCarats: true, sideDiamondCarats: true, sideDiamondQuantity: true, analysis: { select: { jewelryType: true, centerShape: true, settingType: true } } } });
    const learnedGuidance = confirmed.map((item) => `${item.analysis?.jewelryType || "Jewelry"}, ${item.metalType}, ${Number(item.metalWeightGrams).toFixed(2)} g, ${item.analysis?.centerShape || "unspecified"} ${Number(item.centerDiamondCarats).toFixed(2)} ct center, ${Number(item.sideDiamondCarats).toFixed(2)} ct across ${item.sideDiamondQuantity} side stones, ${item.analysis?.settingType || "unspecified"} setting`);
    const outputs = [];
    for (let attemptNumber = 1; attemptNumber <= 3; attemptNumber++) {
      const attempt = await runReviewAttempt({ provider, imageDataUrl, selectedMetal: metalType, attemptNumber, customerDescription: description || undefined, learnedGuidance });
      if (attempt.kind !== "success") throw new Error("Image analysis could not be completed.");
      outputs.push(attempt.result.output);
      await prisma.aiAttempt.create({ data: { analysisId: record.id, attemptNumber, provider: provider.name, model: provider.model, modelVersion: provider.modelVersion, promptVersion: provider.promptVersion, responseId: attempt.result.responseId, retryCount: attempt.retryCount, latencyMs: attempt.latencyMs, metalWeightGrams: attempt.result.output.metal_weight_grams, centerDiamondCarats: attempt.result.output.centerStone?.caratWeight || 0, sideDiamondCarats: (attempt.result.output.sideStones || []).reduce((n, s) => n + s.caratWeightEach * s.count, 0), sideDiamondQuantity: (attempt.result.output.sideStones || []).reduce((n, s) => n + s.count, 0), confidence: attempt.result.output.confidence, output: attempt.result.output as unknown as Prisma.InputJsonValue, rawResponse: attempt.result.rawResponse as Prisma.InputJsonValue } });
    }
    const merged = aggregateJewelryAnalysis(outputs, metalType);
    await prisma.aiAnalysis.update({ where: { id: record.id }, data: { status: "COMPLETED", completedAt: new Date(), jewelryType: merged.jewelryType, metalWeightGrams: merged.metalWeightGrams, centerDiamondCarats: merged.centerDiamondCarats, sideDiamondCarats: merged.sideDiamondCarats, sideDiamondQuantity: merged.sideDiamondQuantity, confidence: merged.confidence, centerShape: merged.centerShape, centerClarity: "E VS1", settingType: merged.settingType, assumptions: merged.assumptions, notes: merged.notes, output: merged } });
    return NextResponse.json({ analysisId: record.id, jewelryType: merged.jewelryType, selectedMetal: merged.selectedMetal, metalWeightGrams: merged.metalWeightGrams, centerDiamondCarats: merged.centerDiamondCarats, sideDiamondCarats: merged.sideDiamondCarats, sideDiamondQuantity: merged.sideDiamondQuantity, centerShape: merged.centerShape, settingType: merged.settingType, hasWeddingBand: merged.hasWeddingBand, isTwoTone: merged.isTwoTone });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Analysis failed." }, { status: 500 }); }
}
