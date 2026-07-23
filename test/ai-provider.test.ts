import { describe, expect, test, vi } from "vitest";
import { createOpenAIJewelryAnalysisProvider } from "@/lib/ai/providers/openai";
import { runReviewAttempt } from "@/lib/ai/runner";

describe("openai jewelry analysis provider", () => {
  test("uses Responses structured outputs with store false", async () => {
    const parseMock = vi.fn().mockResolvedValue({
      id: "resp_123",
      usage: {
        input_tokens: 120,
        output_tokens: 48,
        total_tokens: 168
      },
      output_parsed: {
        jewelry_type: "ring",
        selected_metal: "14K",
        metal_weight_grams: 6.2,
        center_diamond_weight_ct: 1.1,
        side_diamond_total_weight_ct: 0.4,
        side_diamond_quantity: 12,
        center_shape: "round",
        confidence: "high",
        assumptions: ["The image appears to be a ring."]
      }
    });

    const moderationsMock = vi.fn().mockResolvedValue({
      model: "omni-moderation-latest",
      results: [
        {
          flagged: false
        }
      ]
    });

    const provider = createOpenAIJewelryAnalysisProvider(
      {
        responses: { parse: parseMock },
        moderations: { create: moderationsMock }
      } as never,
      { model: "gpt-5-mini", modelVersion: "gpt-5-mini", promptVersion: "jewelry-analysis-v1" }
    );

    const moderation = await provider.moderateImage({
      imageDataUrl: "data:image/png;base64,AAAA"
    });
    const result = await provider.analyzeImage({
      imageDataUrl: "data:image/png;base64,AAAA",
      selectedMetal: "14K",
      attemptNumber: 1
    });

    expect(moderationsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "omni-moderation-latest"
      })
    );
    expect(moderation.flagged).toBe(false);
    expect(parseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-5-mini",
        store: false,
        input: expect.arrayContaining([
          expect.objectContaining({ role: "developer" }),
          expect.objectContaining({
            role: "user",
            content: expect.arrayContaining([
              expect.objectContaining({ type: "input_text" }),
              expect.objectContaining({ type: "input_image" })
            ])
          })
        ])
      })
    );
    expect(result.responseId).toBe("resp_123");
    expect(result.output.jewelry_type).toBe("ring");
    expect(result.usage).toEqual({
      inputTokens: 120,
      outputTokens: 48,
      totalTokens: 168
    });
  });

  test("retries transient review failures without advancing the customer usage flow", async () => {
    const transientError = Object.assign(new Error("server error"), {
      status: 503,
      code: "server_error"
    });

    const provider = {
      name: "mock",
      model: "mock-model",
      modelVersion: "mock-model-version",
      promptVersion: "mock-prompt-v1",
      moderateImage: vi.fn().mockResolvedValue({
        model: "omni-moderation-latest",
        flagged: false,
        rawResponse: { flagged: false }
      }),
      analyzeImage: vi
        .fn()
        .mockRejectedValueOnce(transientError)
        .mockResolvedValue({
          responseId: "resp_retry",
          output: {
            jewelry_type: "ring",
            selected_metal: "14K",
            metal_weight_grams: 5.8,
            center_diamond_weight_ct: 1.2,
            side_diamond_total_weight_ct: 0.5,
            side_diamond_quantity: 14,
            confidence: "medium",
            assumptions: ["The ring appears solid."],
            center_shape: "round"
          },
          latencyMs: 12,
          retryCount: 0,
          usage: {
            inputTokens: 90,
            outputTokens: 30,
            totalTokens: 120
          },
          rawResponse: { id: "resp_retry" }
        })
    };

    const result = await runReviewAttempt({
      provider: provider as never,
      imageDataUrl: "data:image/png;base64,AAAA",
      selectedMetal: "14K",
      attemptNumber: 2
    });

    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.retryCount).toBe(1);
      expect(provider.analyzeImage).toHaveBeenCalledTimes(2);
      expect(result.result.output.center_diamond_weight_ct).toBe(1.2);
    }
  });
});
