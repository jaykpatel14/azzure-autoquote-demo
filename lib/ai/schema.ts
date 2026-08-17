import { z } from "zod";
import { METAL_TYPES } from "@/lib/pricing";

export const AI_ANALYSIS_PROMPT_VERSION = "jewelry-analysis-v2";

export const centerStoneSchema = z.object({
  shape: z.string().trim().min(1).max(120),
  caratWeight: z.number().min(0).max(100)
});

export const sideStoneGroupSchema = z.object({
  shape: z.string().trim().min(1).max(120),
  caratWeightEach: z.number().min(0).max(100),
  count: z.number().int().min(0).max(5000),
  settingType: z.string().trim().min(1).max(120)
});

export const jewelryAnalysisSchema = z.object({
  jewelry_type: z.string().trim().min(1).max(120),
  selected_metal: z.enum(METAL_TYPES),
  metal_weight_grams: z.number().min(0).max(500),
  isTwoTone: z.boolean(),
  hasWeddingBand: z.boolean(),
  centerStone: centerStoneSchema,
  sideStones: z.array(sideStoneGroupSchema),
  colorClarity: z.literal("E VS1"),
  confidence: z.enum(["low", "medium", "high"]),
  assumptions: z.array(z.string().trim().min(1).max(240)).min(1).max(12)
});

export type JewelryAnalysis = z.infer<typeof jewelryAnalysisSchema>;
export type CenterStoneSpec = z.infer<typeof centerStoneSchema>;
export type SideStoneSpec = z.infer<typeof sideStoneGroupSchema>;
