import OpenAI, { toFile } from "openai";
import { prisma } from "@/lib/prisma";
import { resolveRuntimeSetting } from "@/lib/app-settings";
import { getCompanyPlanFeatures } from "@/src/stripe/plans";
import {
  buildQuoteRenderingStorageKey,
  buildAnalysisRenderingStorageKey,
  storeQuoteRenderingInS3,
  loadAnalysisImageFromS3
} from "@/lib/quote-pdf-s3";

export const QUOTE_RENDERING_MODEL = "dall-e-3";
export const QUOTE_RENDERING_SIZE = "1024x1024";
export const QUOTE_RENDERING_QUALITY = "standard";

const PLAIN_BACKGROUND_INSTRUCTION =
  "Plain, seamless, evenly lit solid white studio background — no props, no gradients, no scenery, no surface texture.";

type RenderingSubject = {
  jewelryType: string | null;
  centerShape: string | null;
  centerClarity: string | null;
  settingType: string | null;
  metalType: string;
  metalColor: string | null;
  metalWeightGrams: unknown;
  centerDiamondCarats: unknown;
  sideDiamondCarats: unknown;
  sideDiamondQuantity: number | null;
  centerStoneColor: string | null;
  accentColorStones?: Array<{ stone: string; shape: string; count: number }> | null;
};

function buildRenderingPrompt(subject: RenderingSubject, hasReferencePhoto: boolean) {
  const jewelryType = subject.jewelryType || "fine jewelry piece";
  const centerShape = subject.centerShape || "proportionate center stone";
  const settingType = subject.settingType || null;
  const metalLabel =
    subject.metalColor && subject.metalType !== "Platinum" && subject.metalType !== "Silver"
      ? `${subject.metalType} ${subject.metalColor} gold`
      : subject.metalType;
  const centerStoneLabel = subject.centerStoneColor ? `${subject.centerStoneColor} ${centerShape}` : centerShape;
  const sideStoneInstruction =
    subject.sideDiamondQuantity && subject.sideDiamondQuantity > 0
      ? `Include ${subject.sideDiamondQuantity} side diamonds totaling approximately ${Number(subject.sideDiamondCarats ?? 0).toFixed(2)} carats.`
      : "Do not add side stones, pavé accents, or hidden halos unless they are clearly visible in the reference photo or explicitly requested.";

  // Bug 3 fix: build an explicit sentence listing every accent colored gemstone the customer requested
  const accentStonesInstruction =
    subject.accentColorStones && subject.accentColorStones.length > 0
      ? `Also incorporate the following accent colored gemstones explicitly requested by the customer: ${subject.accentColorStones
          .map((s) => `${s.count}x ${s.stone} (${s.shape} cut)`)
          .join(", ")}. Place them prominently on the shank or shoulders of the ring.`
      : "";

  return [
    hasReferencePhoto
      ? `Using the design specifications from the customer's reference piece, create one photorealistic studio product presentation rendering of this ${jewelryType}.`
      : `Create one photorealistic studio product presentation rendering of a ${jewelryType}.`,
    `Crafted in authentic ${metalLabel}, approximately ${Number(subject.metalWeightGrams ?? 0).toFixed(2)} grams.`,
    `Features a ${centerStoneLabel} center diamond of approximately ${Number(subject.centerDiamondCarats ?? 0).toFixed(2)} carats.`,
    settingType ? `Set in a ${settingType} setting.` : "",
    sideStoneInstruction,
    accentStonesInstruction,
    subject.centerClarity ? `Center diamond clarity: ${subject.centerClarity}.` : "",
    "Show only one complete jewelry piece in a refined three-quarter product view.",
    `Realistic precious-metal reflections, physically believable gemstone refraction, crisp edges, premium jewelry studio lighting. ${PLAIN_BACKGROUND_INSTRUCTION}`,
    "Subtle natural shadow directly beneath the piece, centered composition.",
    "No hands, no person, no packaging, no text, no logo, no watermark, no dimensions, no duplicate jewelry, no exploded view.",
    "This is a customer-facing visualization, not a technical CAD drawing."
  ].filter(Boolean).join(" ");
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

async function loadReferencePhoto(analysis: {
  sourceImageStorageKey: string | null;
  imageDataUrl: string | null;
  sourceImageMimeType: string | null;
} | null): Promise<{ buffer: Buffer; mimeType: string } | null> {
  if (!analysis) return null;

  if (analysis.sourceImageStorageKey) {
    const buffer = await loadAnalysisImageFromS3(analysis.sourceImageStorageKey);
    if (buffer) {
      return { buffer, mimeType: analysis.sourceImageMimeType || "image/jpeg" };
    }
  }

  if (analysis.imageDataUrl) {
    const match = analysis.imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      return { buffer: Buffer.from(match[2], "base64"), mimeType: match[1] };
    }
  }

  return null;
}

async function requestRenderingBase64(params: {
  apiKey: string;
  prompt: string;
  referencePhoto: { buffer: Buffer; mimeType: string } | null;
}): Promise<string> {
  const client = new OpenAI({ apiKey: params.apiKey, maxRetries: 0, timeout: 75_000 });
  const candidateModels = ["dall-e-3", "gpt-image-2", "dall-e-2"];
  let lastError: unknown = null;

  for (const model of candidateModels) {
    try {
      const response = await client.images.generate({
        model,
        prompt: params.prompt.slice(0, 4000),
        size: "1024x1024",
        quality: "standard",
        response_format: "b64_json",
        n: 1
      });

      const dataItem = response.data?.[0];
      if (dataItem?.b64_json) {
        return dataItem.b64_json;
      }
      if (dataItem?.url) {
        const fetched = await fetch(dataItem.url);
        const arrayBuffer = await fetched.arrayBuffer();
        return Buffer.from(arrayBuffer).toString("base64");
      }
    } catch (err: any) {
      console.warn(`[requestRenderingBase64] Model ${model} failed, trying fallback:`, err?.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error("The image model returned no rendering data.");
}

/** Helper to safely extract accentColorStones from a stored analysis output JSON blob */
function extractAccentColorStones(
  analysisOutput: Record<string, unknown> | null
): Array<{ stone: string; shape: string; count: number }> | null {
  if (!analysisOutput) return null;
  const raw = analysisOutput.accentColorStones;
  if (!Array.isArray(raw)) return null;
  return raw
    .filter(
      (item): item is { stone: string; shape: string; count: number } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Record<string, unknown>).stone === "string" &&
        typeof (item as Record<string, unknown>).shape === "string" &&
        typeof (item as Record<string, unknown>).count === "number"
    )
    .map((item) => ({ stone: item.stone, shape: item.shape, count: item.count }));
}

export async function generateQuoteRendering(params: { quoteId: string; companyId: string }) {
  const quote = await prisma.quote.findFirst({
    where: { id: params.quoteId, companyId: params.companyId },
    include: {
      analysis: {
        select: {
          jewelryType: true,
          centerShape: true,
          centerClarity: true,
          settingType: true,
          output: true,
          sourceImageStorageKey: true,
          imageDataUrl: true,
          sourceImageMimeType: true
        }
      }
    }
  });

  if (!quote) throw new Error("Quote not found for rendering.");

  await prisma.quote.update({
    where: { id: quote.id },
    data: { renderingStatus: "PROCESSING", renderingError: null }
  });

  try {
    const apiKey = (await resolveRuntimeSetting("OPENAI_API_KEY", process.env.OPENAI_API_KEY)) || null;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

    const referencePhoto = await loadReferencePhoto(quote.analysis);
    const analysisOutput = quote.analysis?.output as Record<string, unknown> | null;
    const prompt = buildRenderingPrompt(
      {
        jewelryType: quote.analysis?.jewelryType ?? null,
        centerShape: quote.analysis?.centerShape ?? null,
        centerClarity: quote.analysis?.centerClarity ?? null,
        settingType: quote.analysis?.settingType ?? null,
        metalType: quote.metalType,
        metalColor: typeof analysisOutput?.metalColor === "string" ? analysisOutput.metalColor : null,
        metalWeightGrams: quote.metalWeightGrams,
        centerDiamondCarats: quote.centerDiamondCarats,
        sideDiamondCarats: quote.sideDiamondCarats,
        sideDiamondQuantity: quote.sideDiamondQuantity,
        centerStoneColor:
          typeof analysisOutput?.centerStone === "object" && analysisOutput.centerStone !== null && typeof (analysisOutput.centerStone as Record<string, unknown>).color === "string"
            ? String((analysisOutput.centerStone as Record<string, unknown>).color)
            : null,
        accentColorStones: extractAccentColorStones(analysisOutput)
      },
      Boolean(referencePhoto)
    );

    const base64 = await requestRenderingBase64({ apiKey, prompt, referencePhoto });

    const buffer = Buffer.from(base64, "base64");
    const storageKey = buildQuoteRenderingStorageKey(quote.companyId, quote.id);
    const stored = await storeQuoteRenderingInS3({
      key: storageKey,
      buffer,
      contentType: "image/jpeg"
    });

    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        renderingStatus: "COMPLETED",
        renderingStorageKey: stored?.key ?? null,
        renderingDataUrl: stored ? null : `data:image/jpeg;base64,${base64}`,
        renderingMimeType: "image/jpeg",
        renderingModel: QUOTE_RENDERING_MODEL,
        renderingError: null,
        renderingCreatedAt: new Date()
      }
    });

    return { status: "COMPLETED" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate the presentation rendering.";
    await prisma.quote.update({
      where: { id: quote.id },
      data: { renderingStatus: "FAILED", renderingModel: QUOTE_RENDERING_MODEL, renderingError: message.slice(0, 1000) }
    });
    return { status: "FAILED" as const, error: message };
  }
}

export async function generateAnalysisRendering(params: { analysisId: string; companyId: string }) {
  const analysis = await prisma.aiAnalysis.findFirst({
    where: { id: params.analysisId, companyId: params.companyId }
  });

  if (!analysis) throw new Error("Analysis not found for rendering.");

  await prisma.aiAnalysis.update({
    where: { id: analysis.id },
    data: { renderingStatus: "PROCESSING", renderingError: null }
  });

  try {
    const apiKey = (await resolveRuntimeSetting("OPENAI_API_KEY", process.env.OPENAI_API_KEY)) || null;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

    const referencePhoto = await loadReferencePhoto(analysis);
    const analysisOutput = analysis.output as Record<string, unknown> | null;
    const prompt = buildRenderingPrompt(
      {
        jewelryType: analysis.jewelryType,
        centerShape: analysis.centerShape,
        centerClarity: analysis.centerClarity,
        settingType: analysis.settingType,
        metalType: analysis.selectedMetal,
        metalColor: typeof analysisOutput?.metalColor === "string" ? analysisOutput.metalColor : null,
        metalWeightGrams: analysis.metalWeightGrams,
        centerDiamondCarats: analysis.centerDiamondCarats,
        sideDiamondCarats: analysis.sideDiamondCarats,
        sideDiamondQuantity: analysis.sideDiamondQuantity,
        centerStoneColor:
          typeof analysisOutput?.centerStone === "object" && analysisOutput.centerStone !== null && typeof (analysisOutput.centerStone as Record<string, unknown>).color === "string"
            ? String((analysisOutput.centerStone as Record<string, unknown>).color)
            : null,
        accentColorStones: extractAccentColorStones(analysisOutput)
      },
      Boolean(referencePhoto)
    );

    const base64 = await requestRenderingBase64({ apiKey, prompt, referencePhoto });

    const buffer = Buffer.from(base64, "base64");
    const storageKey = buildAnalysisRenderingStorageKey(analysis.companyId, analysis.id);
    const stored = await storeQuoteRenderingInS3({
      key: storageKey,
      buffer,
      contentType: "image/jpeg"
    });

    await prisma.aiAnalysis.update({
      where: { id: analysis.id },
      data: {
        renderingStatus: "COMPLETED",
        renderingStorageKey: stored?.key ?? null,
        renderingDataUrl: stored ? null : `data:image/jpeg;base64,${base64}`,
        renderingMimeType: "image/jpeg",
        renderingModel: QUOTE_RENDERING_MODEL,
        renderingError: null,
        renderingCreatedAt: new Date()
      }
    });

    return {
      status: "COMPLETED" as const,
      imageUrl: `data:image/jpeg;base64,${base64}`,
      storageKey: stored?.key ?? null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate the presentation rendering.";
    await prisma.aiAnalysis.update({
      where: { id: analysis.id },
      data: { renderingStatus: "FAILED", renderingModel: QUOTE_RENDERING_MODEL, renderingError: message.slice(0, 1000) }
    });
    return { status: "FAILED" as const, error: message };
  }
}
