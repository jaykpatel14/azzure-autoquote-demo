import { createOpenAIJewelryAnalysisProvider } from "@/lib/ai/providers/openai";
import { AI_ANALYSIS_PROMPT_VERSION } from "@/lib/ai/schema";

export async function analyzeJewelryImage(
  imageDataUrl: string,
  selectedMetal: string,
  attemptNumber: number
) {
  const provider = await createOpenAIJewelryAnalysisProvider();
  const result = await provider.analyzeImage({
    imageDataUrl,
    selectedMetal,
    attemptNumber
  });

  return result.output;
}

export { AI_ANALYSIS_PROMPT_VERSION };
