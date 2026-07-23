import { createOpenAIJewelryAnalysisProvider } from "@/lib/ai/providers/openai";
import type { JewelryAnalysisProvider } from "@/lib/ai/provider";

export function getJewelryAnalysisProvider(): JewelryAnalysisProvider {
  return createOpenAIJewelryAnalysisProvider();
}
