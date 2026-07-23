import {
  AttemptFailedError,
  ModerationRejectedError,
  isTransientAIError,
  serializeError
} from "@/lib/ai/errors";
import type {
  JewelryAnalysisProvider,
  JewelryReviewFailure,
  JewelryReviewSnapshot,
  ModerationSnapshot
} from "@/lib/ai/provider";
import { median, mergeConfidence } from "@/lib/statistics";
import { METAL_TYPES, type MetalType } from "@/lib/pricing";
import type { JewelryAnalysis } from "@/lib/ai/schema";

export type AnalysisAttemptResult =
  | {
      kind: "success";
      attemptNumber: number;
      retryCount: number;
      latencyMs: number;
      result: JewelryReviewSnapshot;
    }
  | {
      kind: "failure";
      attemptNumber: number;
      retryCount: number;
      latencyMs: number;
      failure: JewelryReviewFailure;
    };

export type JewelryAnalysisRun = {
  moderation: ModerationSnapshot;
  attempts: AnalysisAttemptResult[];
  merged: {
    jewelryType: string;
    selectedMetal: MetalType;
    metalWeightGrams: number;
    centerDiamondCarats: number;
    sideDiamondCarats: number;
    sideDiamondQuantity: number;
    centerShape?: string;
    confidence: "low" | "medium" | "high";
    assumptions: string[];
    notes: string;
  };
};

async function withTransientRetries<T>(
  operation: () => Promise<T>,
  maxRetries = 2
): Promise<{ result: T; retryCount: number; latencyMs: number }> {
  const started = Date.now();
  let retryCount = 0;
  // We want automatic retries only for transient errors so an individual review
  // can recover without charging another customer usage unit.
  // The caller owns persistence of the successful or failed review.
  // Retry delays are intentionally omitted to keep the MVP deterministic.
  // If the provider keeps failing, the caller will receive the final error.
  // The operation itself should be side-effect free beyond the API request.
  while (true) {
    try {
      const result = await operation();
      return { result, retryCount, latencyMs: Date.now() - started };
    } catch (error) {
      if (retryCount >= maxRetries || !isTransientAIError(error)) {
        throw new AttemptFailedError(
          error instanceof Error ? error.message : "Analysis attempt failed.",
          retryCount,
          Date.now() - started,
          serializeError(error)
        );
      }

      retryCount += 1;
    }
  }
}

export function mergeAssumptions(outputs: JewelryAnalysis[]) {
  return Array.from(
    new Set(outputs.flatMap((output) => output.assumptions.map((value) => value.trim())).filter(Boolean))
  );
}

export function chooseMode(values: string[]) {
  if (values.length === 0) return undefined;

  const counts = new Map<string, { count: number; firstIndex: number }>();
  values.forEach((value, index) => {
    const entry = counts.get(value) ?? { count: 0, firstIndex: index };
    entry.count += 1;
    counts.set(value, entry);
  });

  let bestValue: string | undefined;
  let bestCount = -1;
  let bestIndex = Number.POSITIVE_INFINITY;

  for (const [value, entry] of counts.entries()) {
    if (entry.count > bestCount || (entry.count === bestCount && entry.firstIndex < bestIndex)) {
      bestValue = value;
      bestCount = entry.count;
      bestIndex = entry.firstIndex;
    }
  }

  return bestValue;
}

export async function runModerationCheck(params: {
  provider: JewelryAnalysisProvider;
  imageDataUrl: string;
  attemptLimit?: number;
}) {
  const execution = await withTransientRetries(
    () => params.provider.moderateImage({ imageDataUrl: params.imageDataUrl }),
    params.attemptLimit ?? 2
  );

  return {
    ...execution.result,
    latencyMs: execution.latencyMs,
    retryCount: execution.retryCount
  };
}

export async function runReviewAttempt(params: {
  provider: JewelryAnalysisProvider;
  imageDataUrl: string;
  selectedMetal: MetalType;
  attemptNumber: number;
  attemptLimit?: number;
}) : Promise<
  | {
      kind: "success";
      attemptNumber: number;
      retryCount: number;
      latencyMs: number;
      result: JewelryReviewSnapshot;
    }
  | {
      kind: "failure";
      attemptNumber: number;
      retryCount: number;
      latencyMs: number;
      failure: JewelryReviewFailure;
    }
> {
  try {
    const execution = await withTransientRetries(
      () =>
        params.provider.analyzeImage({
          imageDataUrl: params.imageDataUrl,
          selectedMetal: params.selectedMetal,
          attemptNumber: params.attemptNumber
        }),
      params.attemptLimit ?? 2
    );

    return {
      kind: "success",
      attemptNumber: params.attemptNumber,
      retryCount: execution.retryCount,
      latencyMs: execution.latencyMs,
      result: execution.result
    };
  } catch (error) {
    if (error instanceof AttemptFailedError) {
      return {
        kind: "failure",
        attemptNumber: params.attemptNumber,
        retryCount: error.retryCount,
        latencyMs: error.latencyMs,
        failure: {
          latencyMs: error.latencyMs,
          retryCount: error.retryCount,
          error: error.serializedError
        }
      };
    }

    throw error;
  }
}

export function aggregateJewelryAnalysis(outputs: JewelryAnalysis[], selectedMetal: MetalType) {
  return {
    jewelryType: chooseMode(outputs.map((output) => output.jewelry_type)) || "Jewelry",
    selectedMetal:
      (chooseMode(outputs.map((output) => output.selected_metal)) as MetalType | undefined) ||
      selectedMetal,
    metalWeightGrams: Number(median(outputs.map((output) => output.metal_weight_grams)).toFixed(2)),
    centerDiamondCarats: Number(median(outputs.map((output) => output.center_diamond_weight_ct)).toFixed(2)),
    sideDiamondCarats: Number(median(outputs.map((output) => output.side_diamond_total_weight_ct)).toFixed(2)),
    sideDiamondQuantity: Math.round(median(outputs.map((output) => output.side_diamond_quantity))),
    centerShape:
      chooseMode(outputs.map((output) => output.center_shape).filter(Boolean) as string[]) || undefined,
    confidence: mergeConfidence(outputs.map((output) => output.confidence)),
    assumptions: mergeAssumptions(outputs),
    notes: outputs.length
      ? `AI review values are approximate. Assumptions: ${mergeAssumptions(outputs).join(" | ")}`
      : "AI review values are approximate."
  };
}

export async function runJewelryAnalysis(params: {
  provider: JewelryAnalysisProvider;
  imageDataUrl: string;
  selectedMetal: MetalType;
  reviewCount: number;
  attemptLimit?: number;
}) : Promise<JewelryAnalysisRun> {
  const moderation = await runModerationCheck({
    provider: params.provider,
    imageDataUrl: params.imageDataUrl,
    attemptLimit: params.attemptLimit
  });

  if (moderation.flagged) {
    throw new ModerationRejectedError("The uploaded image was blocked by moderation.");
  }

  const attempts: AnalysisAttemptResult[] = [];
  const outputs: JewelryAnalysis[] = [];

  for (let attemptNumber = 1; attemptNumber <= params.reviewCount; attemptNumber += 1) {
    const execution = await runReviewAttempt({
      provider: params.provider,
      imageDataUrl: params.imageDataUrl,
      selectedMetal: params.selectedMetal,
      attemptNumber,
      attemptLimit: params.attemptLimit
    });

    if (execution.kind === "success") {
      attempts.push({
        kind: "success",
        attemptNumber,
        retryCount: execution.retryCount,
        latencyMs: execution.latencyMs,
        result: execution.result
      });
      outputs.push(execution.result.output);
      continue;
    }

    attempts.push(execution);
    throw new AttemptFailedError(
      execution.failure.error.message,
      execution.retryCount,
      execution.latencyMs,
      execution.failure.error
    );
  }

  return {
    moderation,
    attempts,
    merged: aggregateJewelryAnalysis(outputs, params.selectedMetal)
  };
}
