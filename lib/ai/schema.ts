import { z } from "zod";
import { METAL_TYPES } from "@/lib/pricing";

export const AI_ANALYSIS_PROMPT_VERSION = "jewelry-analysis-v1";

export const jewelryAnalysisSchema = z.object({
  jewelry_type: z.string().trim().min(1).max(120),
  selected_metal: z.enum(METAL_TYPES),
  metal_weight_grams: z.number().min(0).max(500),
  center_diamond_weight_ct: z.number().min(0).max(100),
  side_diamond_total_weight_ct: z.number().min(0).max(100),
  side_diamond_quantity: z.number().int().min(0).max(5000),
  center_shape: z.string().trim().min(1).max(120).nullable(),
  center_clarity: z.string().trim().min(1).max(120).nullable(),
  setting_type: z.string().trim().min(1).max(120).nullable(),
  confidence: z.enum(["low", "medium", "high"]),
  assumptions: z.array(z.string().trim().min(1).max(240)).min(1).max(12)
});

export type JewelryAnalysis = z.infer<typeof jewelryAnalysisSchema>;
