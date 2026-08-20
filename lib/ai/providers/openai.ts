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
  TokenUsageSnapshot
} from "@/lib/ai/provider";
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
  learnedGuidance: string[] = []
) {
  const metal = METAL_TYPES.includes(selectedMetal as (typeof METAL_TYPES)[number])
    ? selectedMetal
    : "14K";

  const prompt = [
    "You are an expert master jeweler and custom jewelry production estimator.",
    `This is independent review ${attemptNumber}.`,
    `The currently selected finished metal is ${metal}.`,
    "Estimate the piece from the design description and/or reference image and return a realistic production assessment.",
    "Benchmark guidelines for realistic finished casting weights (Standard US finger size 6.5-7 in 14K Gold):",
    "- Dainty plain solitaire (1.5-1.8mm shank): 3.0g to 4.2g.",
    "- Classic solitaire with hidden halo or cathedral prongs: 4.2g to 5.4g.",
    "- Halo engagement ring or 3-Stone ring with side diamonds: 5.2g to 7.5g.",
    "- Split-shank or wide bridal mounting: 6.5g to 9.5g.",
    "- Two-piece bridal set (ring + matching wedding band): 7.0g to 11.5g total.",
    "- Men's band or heavy signet: 7.0g to 14.0g.",
    "(Note: Platinum density is ~1.65x higher than 14K Gold; 18K is ~1.15x higher).",
    "Side Stone Benchmarks:",
    "- 3-stone rings (trapezoids, baguettes, pears, trillons): typically 0.20ct to 0.50ct each.",
    "- Hidden halos / micro-pave halos: 0.01ct to 0.02ct each (14-28 count).",
    "- Pave bands: 0.015ct to 0.03ct each.",
    "Identify accurately:",
    "- jewelry_type: e.g. Ring, Pendant, Earrings, Bracelet, etc.",
    "- selected_metal: the selected metal.",
    "- isTwoTone: true if the piece combines white gold and yellow/rose gold in the same item, false otherwise.",
    "- hasWeddingBand: true if there appear to be two separate ring bands (an engagement ring and a wedding band), false otherwise.",
    "- metal_weight_grams: estimated realistic metal weight in grams based on the piece architecture.",
    "- centerStone: the primary/largest stone. Provide its shape (e.g. oval, round, radiant, cushion, marquise, emerald, pear) and estimated carat weight.",
    "- sideStones: all other stones. Group by shape and setting type. For each group, provide the shape (round, baguette, trapezoid, pear, etc.), estimated carat weight of each individual stone, the count of stones in this group, and the setting type (prong, bezel, pavé, channel, bar, etc.).",
    "- colorClarity: always return 'E VS1' — do not attempt to assess from the image.",
    "- confidence: low, medium, or high.",
    "- assumptions: list of key assumptions made during analysis.",
    customerDescription?.trim()
      ? `Customer-provided design description: ${customerDescription.trim()}. Match specifications mentioned in the description.`
      : "No customer description was supplied."
  ];

  if (learnedGuidance.length) {
    prompt.push(
      "The following tenant-specific examples come from previously saved and human-confirmed quotes. Use them only as pattern guidance when visually relevant; never copy values blindly:",
      ...learnedGuidance.map((guidance, index) => `${index + 1}. ${guidance}`)
    );
  }

  return prompt.join(" ");
}

export async function createOpenAIJewelryAnalysisProvider(
  clientOrOverrides?: OpenAI | Partial<{
    model: string;
    modelVersion: string;
    promptVersion: string;
  }>,
  overrides?: Partial<{
    model: string;
    modelVersion: string;
    promptVersion: string;
  }>
): Promise<JewelryAnalysisProvider> {
  const isClientLike =
    typeof clientOrOverrides === "object" &&
    clientOrOverrides !== null &&
    ("responses" in clientOrOverrides || "moderations" in clientOrOverrides);
  const maybeClient = isClientLike ? (clientOrOverrides as OpenAI) : undefined;
  const runtimeOverrides = isClientLike ? overrides : clientOrOverrides;

  let client = maybeClient;
  if (!client) {
    const apiKey =
      (await resolveRuntimeSetting("OPENAI_API_KEY", process.env.OPENAI_API_KEY)) || null;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }

    // Retry policy is owned by the analysis runner so requests are not retried
    // once by the SDK and then again by the application.
    client = new OpenAI({ apiKey, maxRetries: 0 });
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
    async moderateImage({ imageDataUrl, imageDataUrls, text }: { imageDataUrl?: string | null; imageDataUrls?: string[] | null; text?: string | null }): Promise<ModerationSnapshot> {
      const images = (imageDataUrls?.length ? imageDataUrls : imageDataUrl ? [imageDataUrl] : []).filter(Boolean);

      if (images.length > 0) {
        const response = await client.moderations.create({
          model: "omni-moderation-latest",
          input: images.map((url) => ({
            type: "image_url" as const,
            image_url: { url }
          }))
        });

        return {
          model: response.model,
          flagged: response.results.some((result) => result.flagged),
          rawResponse: response
        };
      }

      if (text?.trim()) {
        const response = await client.moderations.create({
          input: text
        });

        return {
          model: response.model,
          flagged: response.results.some((result) => result.flagged),
          rawResponse: response
        };
      }

      return {
        model: "omni-moderation-latest",
        flagged: false,
        rawResponse: null
      };
    },
    async analyzeImage({ imageDataUrl, imageDataUrls, selectedMetal, attemptNumber, customerDescription, learnedGuidance }): Promise<JewelryReviewSnapshot> {
      const start = Date.now();
      const contentList: Array<
        | { type: "input_text"; text: string }
        | { type: "input_image"; image_url: string; detail: "high" }
      > = [
        {
          type: "input_text",
          text: buildPrompt(selectedMetal, attemptNumber, customerDescription, learnedGuidance)
        }
      ];

      const images = (imageDataUrls?.length ? imageDataUrls : imageDataUrl ? [imageDataUrl] : []).filter(Boolean);
      for (const imgUrl of images) {
        contentList.push({
          type: "input_image",
          image_url: imgUrl,
          detail: "high"
        });
      }

      const response = await client.responses.parse({
        model,
        store: false,
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
      return {
        responseId: response.id,
        output,
        latencyMs: Date.now() - start,
        retryCount: 0,
        usage: normalizeUsage(response.usage),
        rawResponse: response
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
