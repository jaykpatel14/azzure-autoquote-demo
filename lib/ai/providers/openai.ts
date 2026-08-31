import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { isTransientAIError, serializeError } from "@/lib/ai/errors";
import {
  AI_ANALYSIS_PROMPT_VERSION,
  jewelryAnalysisSchema,
  type JewelryAnalysis
} from "@/lib/ai/schema";
import type {
  JewelryAnalysisProvider,
  JewelryReviewSnapshot,
  ModerationSnapshot,
  TaggedImageInput,
  TokenUsageSnapshot
} from "@/lib/ai/provider";
import { extractJewelryTagData, type JewelryTagData } from "@/lib/ai/tag-ocr";
import { resolveRuntimeSetting } from "@/lib/app-settings";
import { METAL_TYPES } from "@/lib/pricing";

function normalizeUsage(usage: unknown): TokenUsageSnapshot | undefined {
  if (!usage || typeof usage !== "object") return undefined;

  const record = usage as Record<string, unknown>;
  const inputTokens =
    typeof record.input_tokens === "number"
      ? record.input_tokens
      : typeof record.prompt_tokens === "number"
        ? record.prompt_tokens
        : undefined;
  const outputTokens =
    typeof record.output_tokens === "number" ? record.output_tokens : undefined;
  const totalTokens =
    typeof record.total_tokens === "number"
      ? record.total_tokens
      : typeof record.completion_tokens === "number" && typeof inputTokens === "number"
        ? inputTokens + record.completion_tokens
        : undefined;

  return { inputTokens, outputTokens, totalTokens };
}

function buildPrompt(
  selectedMetal: string,
  attemptNumber: number,
  customerDescription?: string,
  learnedGuidance: string[] = [],
  taggedImages?: TaggedImageInput[] | null,
  tagData?: JewelryTagData | null
) {
  const metal = METAL_TYPES.includes(selectedMetal as (typeof METAL_TYPES)[number])
    ? selectedMetal
    : "14K";

  const promptParts = [
    "You are an expert master jeweler, graduate gemologist, and custom fine jewelry production estimator.",
    `This is independent review ${attemptNumber}.`,
    `The currently selected finished metal is ${metal}.`,
    // Karat accuracy
    "IMPORTANT — Karat accuracy: If the customer description or jewelry tag explicitly states a karat (e.g. '18k', '18 karat', '18-karat', '18K', 'Platinum'), you MUST set selected_metal to that exact karat (e.g. '18K'). Do NOT downgrade or change the karat. The currently selected metal above is your fallback only when not specified.",
    "Evaluate the piece from the reference images and customer description with highest precision for production casting and gem pricing.",
    // Multi-angle evaluation hierarchy
    "MULTI-ANGLE PHOTO HIERARCHY & CANONICAL FACE-VIEW ANCHORING RULES:",
    "1. PRIMARY FACE/TOP VIEW ANCHOR: The top/face-on view is the CANONICAL ANCHOR for center diamond shape (Round, Oval, Emerald, Radiant, Cushion, Pear, Marquise, Princess, Asscher, Heart) and carat weight proportion. The center stone observed in the face view is the primary focus of the piece.",
    "2. SIDE/ANGLE PROFILE ROLE: Side profile and perspective shots are evaluated strictly to confirm setting architecture (e.g. cathedral, filigree under-gallery, petal basket, hidden halo, peg head) and accent side-stone counts. CRITICAL: A side view showing filigree/petals or basket mounting MUST NEVER override or erase a center diamond clearly visible from the face shot. Do NOT confuse the under-gallery structure with the center stone!",
    "3. JEWELRY TAG / RECEIPT AS GROUND TRUTH: If a jewelry tag, dumbbell sticker, or receipt is visible in the photos (or tag OCR data is provided below), the printed diamond carat weights (e.g. '3.020 ct' center, '0.320 ct' side) and metal purity MUST BE TREATED AS 100% GROUND TRUTH and override any loose visual approximations.",
    "Geometric and physical benchmarks for center diamonds (use millimeter-to-carat proportion against standard 1.8mm-2.0mm ring shanks):",
    "- Round Brilliant: 1.0ct (~6.5mm), 1.5ct (~7.4mm), 2.0ct (~8.1mm), 2.5ct (~8.8mm), 3.0ct (~9.3mm).",
    "- Oval Cut: 1.0ct (~7.5x5.3mm), 1.5ct (~8.5x6.0mm), 2.0ct (~9.5x7.0mm), 2.5ct (~10.2x7.5mm), 3.0ct (~11.0x8.0mm).",
    "- Emerald / Radiant Cut: 1.5ct (~7.8x5.6mm), 2.0ct (~8.5x6.2mm), 2.5ct (~9.2x6.8mm), 3.0ct (~10.0x7.5mm).",
    "- Cushion / Princess: 1.5ct (~6.8x6.8mm), 2.0ct (~7.5x7.5mm), 2.5ct (~8.2x8.2mm), 3.0ct (~8.8x8.8mm).",
    "- Pear / Marquise: 1.5ct (~9.5x6.0mm), 2.0ct (~10.5x6.8mm), 2.5ct (~11.5x7.3mm), 3.0ct (~12.5x8.0mm).",
    "Benchmark finished casting weights (US finger size 6.5-7 in 14K gold):",
    "- Dainty plain solitaire (1.5mm - 1.8mm shank): 3.0g to 4.2g.",
    "- Classic solitaire with hidden halo, cathedral prongs, or peg head: 4.2g to 5.4g.",
    "- Pave band engagement ring with hidden collar: 4.8g to 6.2g.",
    "- Classic halo or 3-stone ring with side diamonds/trapezoids: 5.2g to 7.5g.",
    "- Split-shank, vintage filigree, or wide bridal mounting: 6.5g to 9.5g.",
    "- Two-piece bridal set (engagement ring + matching pave band): 7.0g to 11.5g total.",
    "- Men's wedding band or heavy signet: 7.0g to 14.0g.",
    "(Note: 18K gold density is about 1.15x higher than 14K; Platinum 950 density is about 1.65x higher than 14K gold; Sterling Silver is about 0.80x of 14K).",
    "Do not collapse metal karat and metal color into one field. selected_metal is the karat/base metal and metalColor is the visible hue/finish (yellow, white, or rose). If the customer says rose gold, keep selected_metal as 18K/14K/10K and set metalColor to rose.",
    "If the customer or image specifies a gemstone color, capture it on centerStone.color. For example, green diamonds should keep the center stone shape and set centerStone.color to a concise color word like green.",
    "Side stone calculations:",
    "- 3-stone trilogy side stones (pears, trapezoids, baguettes, tapered baguettes): typically 0.20ct to 0.50ct each.",
    "- Hidden halo / under-gallery micro-pave collar: 0.010ct to 0.015ct each (about 14 to 28 stones = 0.15ct to 0.35ct total).",
    "- Pave shank diamonds (3/4 eternity): 0.015ct to 0.03ct each (about 16 to 24 stones = 0.30ct to 0.60ct total).",
    "- Full eternity band: 0.03ct to 0.08ct each (about 18 to 26 stones = 0.60ct to 1.80ct total).",
    "Identify accurately:",
    "- jewelry_type: Ring, Pendant, Earrings, Bracelet, Necklace, etc.",
    "- selected_metal: the karat/base metal as described above. Never change a customer-stated karat.",
    "- metalColor: the visible metal hue/finish, if the customer or image specifies it. Use yellow, white, or rose; otherwise null.",
    "- isTwoTone: true if the design combines white metal and yellow or rose gold, false otherwise.",
    "- hasWeddingBand: true if there are two distinct interlocking bands (engagement ring + wedding band), false otherwise.",
    "- metal_weight_grams: realistic finished metal weight in grams based on structural shank volume and finger size.",
    "- centerStone: the primary center gemstone. Accurately identify shape (Round, Oval, Emerald, Radiant, Cushion, Pear, Marquise, Princess, Asscher, Heart), realistic carat weight, and color when one is explicitly present.",
    "- sideStones: all accent diamond groups, each with shape, caratWeightEach, count, and settingType (prong, bezel, pave, channel, micro-prong). Do not invent side stones or setting types unless clearly visible in the image or explicitly described.",
    "- settingStyle: the OVERALL named ring setting style, exactly as stated by the customer or clearly visible in the image. Examples: 'hidden halo', 'cathedral', 'bezel', 'tension', 'solitaire', 'three-stone', 'pave band', 'vintage filigree'.",
    "- accentColorStones: if the customer explicitly requests additional named colored gemstones BEYOND the primary center stone (e.g. 'with ruby and sapphire'), list EACH stone as a separate entry.",
    "- colorClarity: always return E VS1.",
    "- confidence: low, medium, or high.",
    "- assumptions: list of key technical assumptions made during CAD analysis, each under 200 characters.",
    customerDescription?.trim()
      ? `Customer-provided design description: ${customerDescription.trim()}. Match ALL specifications - karat, metal color, setting style, and every gemstone - exactly as the customer requested.`
      : "No customer description was supplied."
  ];

  if (tagData && tagData.hasTag) {
    promptParts.push(
      `HIGH-PRIORITY JEWELRY TAG GROUND TRUTH DETECTED: Center carat weight: ${tagData.centerCarats ?? "unspecified"}, Side diamond carat weight: ${tagData.sideCarats ?? "unspecified"}, Clarity: ${tagData.diamondClarity ?? "VS1"}, Purity: ${tagData.metalPurity ?? "14K"}. Raw tag transcript: "${tagData.rawText || ""}". YOU MUST SET centerStone.caratWeight TO EXACTLY ${tagData.centerCarats ?? "the detected weight"} AND USE THESE VALUES.`
    );
  }

  if (taggedImages && taggedImages.length > 0) {
    promptParts.push(
      `Photo Angle Mapping: ${taggedImages.map((img, idx) => `Photo ${idx + 1}: ${img.label || img.angle}`).join(", ")}.`
    );
  }

  if (learnedGuidance.length) {
    promptParts.push(
      "The following tenant-specific examples come from previously saved and human-confirmed quotes. Use them only as pattern guidance when visually relevant; never copy values blindly:",
      ...learnedGuidance.map((guidance, index) => `${index + 1}. ${guidance}`)
    );
  }

  return promptParts.join(" ");
}

function isClientLike(value: unknown): value is OpenAI {
  return (
    typeof value === "object" &&
    value !== null &&
    ("responses" in value || "moderations" in value)
  );
}

type ProviderOverrides = Partial<{
  model: string;
  modelVersion: string;
  promptVersion: string;
}>;

function isProviderOverrides(value: unknown): value is ProviderOverrides {
  return typeof value === "object" && value !== null && !isClientLike(value);
}

export async function createOpenAIJewelryAnalysisProvider(
  clientOrOverrides?: OpenAI | ProviderOverrides,
  overrides?: ProviderOverrides
): Promise<JewelryAnalysisProvider> {
  const client = isClientLike(clientOrOverrides) ? clientOrOverrides : undefined;
  const runtimeOverrides = client
    ? overrides
    : isProviderOverrides(clientOrOverrides)
      ? clientOrOverrides
      : undefined;

  let openai = client;
  if (!openai) {
    const apiKey =
      (await resolveRuntimeSetting("OPENAI_API_KEY", process.env.OPENAI_API_KEY)) || null;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }

    openai = new OpenAI({ apiKey, maxRetries: 0 });
  }

  const model =
    runtimeOverrides?.model ||
    (await resolveRuntimeSetting("OPENAI_MODEL", process.env.OPENAI_MODEL)) ||
    "gpt-5-mini";
  const modelVersion = runtimeOverrides?.modelVersion || model;
  const promptVersion = runtimeOverrides?.promptVersion || AI_ANALYSIS_PROMPT_VERSION;

  return {
    name: "openai",
    model,
    modelVersion,
    promptVersion,
    async moderateImage({
      imageDataUrl,
      imageDataUrls,
      text
    }: {
      imageDataUrl?: string | null;
      imageDataUrls?: string[] | null;
      text?: string | null;
    }): Promise<ModerationSnapshot> {
      const images = (imageDataUrls?.length ? imageDataUrls : imageDataUrl ? [imageDataUrl] : []).filter(Boolean);

      if (images.length > 0) {
        // OpenAI omni-moderation-latest supports at most 1 image per request.
        // Send all images in parallel to check each one.
        const responses = await Promise.all(
          images.map((url) =>
            openai.moderations.create({
              model: "omni-moderation-latest",
              input: [
                {
                  type: "image_url" as const,
                  image_url: { url }
                }
              ]
            })
          )
        );

        const flagged = responses.some((res) => res.results.some((result) => result.flagged));
        const firstModel = responses[0]?.model || "omni-moderation-latest";
        return {
          model: firstModel,
          flagged,
          rawResponse: {
            ids: responses.map((r) => r.id),
            model: firstModel,
            results: responses.flatMap((r) => r.results)
          }
        };
      }

      if (text?.trim()) {
        const response = await openai.moderations.create({ input: text });
        return {
          model: response.model,
          flagged: response.results.some((result) => result.flagged),
          rawResponse: {
            id: response.id,
            model: response.model,
            results: response.results
          }
        };
      }

      return {
        model: "omni-moderation-latest",
        flagged: false,
        rawResponse: null
      };
    },
    async analyzeImage({
      imageDataUrl,
      imageDataUrls,
      taggedImages,
      tagData: passedTagData,
      selectedMetal,
      attemptNumber,
      customerDescription,
      learnedGuidance
    }): Promise<JewelryReviewSnapshot> {
      const start = Date.now();

      // Collect all images
      const images: string[] = [];
      if (taggedImages && taggedImages.length > 0) {
        taggedImages.forEach((img) => {
          if (img.dataUrl) images.push(img.dataUrl);
        });
      } else if (imageDataUrls && imageDataUrls.length > 0) {
        images.push(...imageDataUrls.filter(Boolean));
      } else if (imageDataUrl) {
        images.push(imageDataUrl);
      }

      // Check for tag/receipt images or run tag OCR if needed
      let resolvedTagData = passedTagData;
      if (!resolvedTagData && images.length > 0) {
        // Check tag-tagged slot first, or check the last image
        const tagCandidate = taggedImages?.find((img) => img.angle === "tag_receipt")?.dataUrl || images[images.length - 1];
        if (tagCandidate) {
          resolvedTagData = await extractJewelryTagData(openai, tagCandidate, model);
        }
      }

      const contentList: Array<
        | { type: "input_text"; text: string }
        | { type: "input_image"; image_url: string; detail: "high" }
      > = [
        {
          type: "input_text",
          text: buildPrompt(selectedMetal, attemptNumber, customerDescription, learnedGuidance, taggedImages, resolvedTagData)
        }
      ];

      for (const imageUrl of images) {
        contentList.push({
          type: "input_image",
          image_url: imageUrl,
          detail: "high"
        });
      }

      const response = await openai.responses.parse({
        model,
        store: false,
        tools: [{ type: "web_search_preview", search_context_size: "medium" }],
        input: [
          {
            role: "developer",
            content:
              "Return only structured jewelry analysis data. The estimate is approximate and editable."
          },
          {
            role: "user",
            content: contentList
          }
        ],
        text: {
          format: zodTextFormat(jewelryAnalysisSchema, "jewelry_analysis")
        }
      });

      if (!response.output_parsed) {
        throw new Error("The model returned an incomplete analysis.");
      }

      const output = response.output_parsed as JewelryAnalysis;

      // Apply ground truth overrides if tag OCR extracted hard data
      if (resolvedTagData && resolvedTagData.hasTag) {
        if (resolvedTagData.centerCarats && resolvedTagData.centerCarats > 0) {
          output.centerStone.caratWeight = resolvedTagData.centerCarats;
          if (output.centerStone.shape.toLowerCase() === "none") {
            output.centerStone.shape = resolvedTagData.centerShape || "Pear";
          }
        }
        if (resolvedTagData.sideCarats && resolvedTagData.sideCarats > 0) {
          if (output.sideStones.length === 0) {
            output.sideStones.push({
              shape: "pear",
              caratWeightEach: resolvedTagData.sideCount ? resolvedTagData.sideCarats / resolvedTagData.sideCount : resolvedTagData.sideCarats / 2,
              count: resolvedTagData.sideCount || 2,
              settingType: "prong"
            });
          } else {
            const totalCount = output.sideStones.reduce((sum, ss) => sum + ss.count, 0) || 1;
            output.sideStones.forEach((ss) => {
              ss.caratWeightEach = Number((resolvedTagData!.sideCarats! / totalCount).toFixed(3));
            });
          }
        }
        if (resolvedTagData.metalPurity) {
          const normPurity = resolvedTagData.metalPurity.toUpperCase();
          if (normPurity.includes("18")) output.selected_metal = "18K";
          else if (normPurity.includes("14")) output.selected_metal = "14K";
          else if (normPurity.includes("10")) output.selected_metal = "10K";
          else if (normPurity.includes("PLAT")) output.selected_metal = "Platinum";
        }
        output.assumptions.unshift(
          `Tag Ground Truth: ${resolvedTagData.centerCarats ? `${resolvedTagData.centerCarats}ct center, ` : ""}${resolvedTagData.sideCarats ? `${resolvedTagData.sideCarats}ct side stones, ` : ""}${resolvedTagData.diamondClarity || ""} verified from jewelry tag.`
        );
      }

      return {
        responseId: response.id,
        output,
        latencyMs: Date.now() - start,
        retryCount: 0,
        usage: normalizeUsage(response.usage),
        rawResponse: {
          id: response.id,
          model: response.model,
          usage: response.usage
        }
      };
    }
  };
}

export function isRetryableAnalysisError(error: unknown) {
  return isTransientAIError(error);
}

export function serializeAnalysisError(error: unknown) {
  return serializeError(error);
}

