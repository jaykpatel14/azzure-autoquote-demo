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
import { type MetalType } from "@/lib/pricing";
import type { JewelryAnalysis, CenterStoneSpec, SideStoneSpec } from "@/lib/ai/schema";

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
    isTwoTone: boolean;
    hasWeddingBand: boolean;
    centerStone: CenterStoneSpec;
    sideStones: SideStoneSpec[];
    centerDiamondCarats: number;
    sideDiamondCarats: number;
    sideDiamondQuantity: number;
    centerShape?: string;
    centerClarity: string;
    settingType?: string;
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
}): Promise<
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
  const isTwoToneCount = outputs.filter((o) => o.isTwoTone).length;
  const isTwoTone = isTwoToneCount > outputs.length / 2;

  const hasWeddingBandCount = outputs.filter((o) => o.hasWeddingBand).length;
  const hasWeddingBand = hasWeddingBandCount > outputs.length / 2;

  const centerShape =
    chooseMode(outputs.map((output) => output.centerStone?.shape).filter(Boolean) as string[]) || "round";
  const centerCaratWeight = Number(
    median(outputs.map((output) => output.centerStone?.caratWeight || 0)).toFixed(2)
  );

  const centerStone: CenterStoneSpec = {
    shape: centerShape,
    caratWeight: centerCaratWeight
  };

  // Pick representative side stones from outputs
  const sideStones: SideStoneSpec[] =
    outputs.find((o) => (o.sideStones || []).length > 0)?.sideStones ||
    outputs[0]?.sideStones ||
    [];

  const sideDiamondCarats = Number(
    median(
      outputs.map((output) =>
        (output.sideStones || []).reduce((acc, ss) => acc + ss.caratWeightEach * ss.count, 0)
      )
    ).toFixed(2)
  );

  const sideDiamondQuantity = Math.round(
    median(
      outputs.map((output) =>
        (output.sideStones || []).reduce((acc, ss) => acc + ss.count, 0)
      )
    )
  );

  const settingType =
    chooseMode(
      outputs.flatMap((output) => (output.sideStones || []).map((ss) => ss.settingType)).filter(Boolean) as string[]
    ) || undefined;

  return {
    jewelryType: chooseMode(outputs.map((output) => output.jewelry_type)) || "Jewelry",
    selectedMetal:
      (chooseMode(outputs.map((output) => output.selected_metal)) as MetalType | undefined) ||
      selectedMetal,
    metalWeightGrams: Number(median(outputs.map((output) => output.metal_weight_grams)).toFixed(2)),
    isTwoTone,
    hasWeddingBand,
    centerStone,
    sideStones,
    centerDiamondCarats: centerCaratWeight,
    sideDiamondCarats,
    sideDiamondQuantity,
    centerShape,
    centerClarity: "E VS1",
    settingType,
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
}): Promise<JewelryAnalysisRun> {
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
