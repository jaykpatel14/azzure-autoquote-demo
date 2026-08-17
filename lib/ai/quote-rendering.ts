import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { resolveRuntimeSetting } from "@/lib/app-settings";
import {
  buildQuoteRenderingStorageKey,
  storeQuoteRenderingInS3
} from "@/lib/quote-pdf-s3";

export const QUOTE_RENDERING_MODEL = "gpt-image-2";
export const QUOTE_RENDERING_SIZE = "1024x1536";
export const QUOTE_RENDERING_QUALITY = "medium";

function buildRenderingPrompt(quote: {
  metalType: string;
  metalWeightGrams: unknown;
  centerDiamondCarats: unknown;
  sideDiamondCarats: unknown;
  sideDiamondQuantity: number;
  analysis: {
    jewelryType: string | null;
    centerShape: string | null;
    centerClarity: string | null;
    settingType: string | null;
  } | null;
}) {
  const jewelryType = quote.analysis?.jewelryType || "fine jewelry piece";
  const centerShape = quote.analysis?.centerShape || "proportionate center stone";
  const settingType = quote.analysis?.settingType || "professionally appropriate setting";

  return [
    `Create one photorealistic presentation rendering of a ${jewelryType}.`,
    `Use ${quote.metalType} metal, approximately ${Number(quote.metalWeightGrams).toFixed(2)} grams.`,
    `Use a ${centerShape} center diamond of approximately ${Number(quote.centerDiamondCarats).toFixed(2)} carats`,
    `in a ${settingType}, with ${quote.sideDiamondQuantity} side diamonds totaling approximately ${Number(quote.sideDiamondCarats).toFixed(2)} carats.`,
    quote.analysis?.centerClarity ? `The center diamond clarity specification is ${quote.analysis.centerClarity}.` : "",
    "Show only one complete jewelry piece in a refined three-quarter product view.",
    "Realistic precious-metal reflections, physically believable gemstone refraction, crisp edges, premium jewelry studio lighting, neutral warm-gray seamless background, subtle natural shadow, centered composition.",
    "No hands, no person, no packaging, no text, no logo, no watermark, no dimensions, no duplicate jewelry, no exploded view.",
    "This is a customer-facing visualization, not a technical CAD drawing."
  ].filter(Boolean).join(" ");
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
          settingType: true
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

    // Keep quote creation responsive: do not multiply a slow generation with SDK retries.
    const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 75_000 });
    const response = await client.images.generate({
      model: QUOTE_RENDERING_MODEL,
      prompt: buildRenderingPrompt(quote),
      size: QUOTE_RENDERING_SIZE,
      quality: QUOTE_RENDERING_QUALITY,
      output_format: "jpeg",
      output_compression: 85,
      n: 1
    });
    const base64 = response.data?.[0]?.b64_json;
    if (!base64) throw new Error("The image model returned no rendering data.");

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
