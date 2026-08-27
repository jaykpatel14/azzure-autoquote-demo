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

export const QUOTE_RENDERING_MODEL = "gpt-image-2";
export const QUOTE_RENDERING_SIZE = "1024x1536";
export const QUOTE_RENDERING_QUALITY = "medium";

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

  return [
    hasReferencePhoto
      ? `Using the attached reference photo as the design source, create one photorealistic presentation rendering of this ${jewelryType}.`
      : `Create one photorealistic presentation rendering of a ${jewelryType}.`,
    hasReferencePhoto
      ? "Match the design, silhouette, stone placement, and proportions shown in the reference photo as closely as possible — this must depict the same piece, re-rendered as a clean studio product shot, not a different design."
      : "",
    `Use ${metalLabel}, approximately ${Number(subject.metalWeightGrams ?? 0).toFixed(2)} grams.`,
    `Use a ${centerStoneLabel} center diamond of approximately ${Number(subject.centerDiamondCarats ?? 0).toFixed(2)} carats.`,
    settingType ? `Place it in a ${settingType} setting.` : "Do not invent a decorative setting unless it is clearly visible in the reference photo.",
    sideStoneInstruction,
    subject.centerClarity ? `The center diamond clarity specification is ${subject.centerClarity}.` : "",
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

  if (params.referencePhoto) {
    const file = await toFile(
      params.referencePhoto.buffer,
      `reference.${extensionForMimeType(params.referencePhoto.mimeType)}`,
      { type: params.referencePhoto.mimeType }
    );

    const response = await client.images.edit({
      model: QUOTE_RENDERING_MODEL,
      image: file,
      prompt: params.prompt,
      size: QUOTE_RENDERING_SIZE,
      quality: QUOTE_RENDERING_QUALITY,
      background: "opaque",
      output_format: "jpeg",
      output_compression: 85,
      n: 1
    });

    const base64 = response.data?.[0]?.b64_json;
    if (!base64) throw new Error("The image model returned no rendering data.");
    return base64;
  }

  const response = await client.images.generate({
    model: QUOTE_RENDERING_MODEL,
    prompt: params.prompt,
    size: QUOTE_RENDERING_SIZE,
    quality: QUOTE_RENDERING_QUALITY,
    background: "opaque",
    output_format: "jpeg",
    output_compression: 85,
    n: 1
  });

  const base64 = response.data?.[0]?.b64_json;
  if (!base64) throw new Error("The image model returned no rendering data.");
  return base64;
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

  const { features } = await getCompanyPlanFeatures(params.companyId).catch(() => ({ features: null }));
  if (!features?.canGenerateAIImages) {
    return { status: "SKIPPED" as const, error: "3D AI Concept Rendering is only available on the Ultra plan." };
  }

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
            : null
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

  const { features } = await getCompanyPlanFeatures(params.companyId).catch(() => ({ features: null }));
  if (!features?.canGenerateAIImages) {
    return { status: "SKIPPED" as const, imageUrl: null, storageKey: null };
  }

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
            : null
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
      imageUrl: stored ? null : `data:image/jpeg;base64,${base64}`,
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
