import type { JewelryAnalysis } from "@/lib/ai/schema";
import type { SerializedError } from "@/lib/ai/errors";

export type TokenUsageSnapshot = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type ModerationSnapshot = {
  model: string;
  flagged: boolean;
  rawResponse: unknown;
};

export type JewelryReviewSnapshot = {
  responseId: string;
  output: JewelryAnalysis;
  latencyMs: number;
  retryCount: number;
  usage?: TokenUsageSnapshot;
  rawResponse: unknown;
};

export type JewelryReviewFailure = {
  latencyMs: number;
  retryCount: number;
  error: SerializedError;
};

export interface JewelryAnalysisProvider {
  readonly name: string;
  readonly model: string;
  readonly modelVersion: string;
  readonly promptVersion: string;
  moderateImage(input: { imageDataUrl?: string | null; text?: string | null }): Promise<ModerationSnapshot>;
  analyzeImage(input: {
    imageDataUrl?: string | null;
    selectedMetal: string;
    attemptNumber: number;
    customerDescription?: string;
    learnedGuidance?: string[];
  }): Promise<JewelryReviewSnapshot>;
}
