import { createOpenAIJewelryAnalysisProvider } from "@/lib/ai/providers/openai";
import type { JewelryAnalysisProvider } from "@/lib/ai/provider";

export async function getJewelryAnalysisProvider(): Promise<JewelryAnalysisProvider> {
  return createOpenAIJewelryAnalysisProvider();
}
