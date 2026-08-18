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

function buildPrompt(selectedMetal: string, attemptNumber: number) {
  const metal = METAL_TYPES.includes(selectedMetal as (typeof METAL_TYPES)[number])
    ? selectedMetal
    : "14K";

  return [
    "You are a jewelry production estimator.",
    `This is independent review ${attemptNumber}.`,
    `The currently selected finished metal is ${metal}.`,
    "Estimate the piece from the image and return a cautious preliminary assessment.",
    "Never claim exact manufacturing precision.",
    "Identify:",
    "- jewelry_type: e.g. Ring, Pendant, Earrings, Bracelet, etc.",
    "- selected_metal: the selected metal.",
    "- isTwoTone: true if the piece combines white gold and yellow gold in the same item, false otherwise.",
    "- hasWeddingBand: true if there appear to be two separate ring bands (an engagement ring and a wedding band), false otherwise.",
    "- metal_weight_grams: estimated metal weight in grams.",
    "- centerStone: the primary/largest stone. Provide its shape (e.g. oval, round, radiant, cushion, marquise, emerald, pear) and estimated carat weight.",
    "- sideStones: all other stones. Group by shape and setting type. For each group, provide the shape (round, baguette, trillion, etc.), estimated carat weight of each individual stone, the count of stones in this group, and the setting type (prong, bezel, pavé, channel, bar, etc.).",
    "- colorClarity: always return 'E VS1' — do not attempt to assess from the image.",
    "- confidence: low, medium, or high.",
    "- assumptions: list of key assumptions made during analysis."
  ].join(" ");
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
    async moderateImage({ imageDataUrl }): Promise<ModerationSnapshot> {
      const response = await client.moderations.create({
        model: "omni-moderation-latest",
        input: [
          {
            type: "image_url",
            image_url: { url: imageDataUrl }
          }
        ]
      });

      return {
        model: response.model,
        flagged: response.results.some((result) => result.flagged),
        rawResponse: response
      };
    },
    async analyzeImage({ imageDataUrl, selectedMetal, attemptNumber }): Promise<JewelryReviewSnapshot> {
      const start = Date.now();
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
            content: [
              {
                type: "input_text",
                text: buildPrompt(selectedMetal, attemptNumber)
              },
              {
                type: "input_image",
                image_url: imageDataUrl,
                detail: "high"
              }
            ]
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
