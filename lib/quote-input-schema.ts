import { z } from "zod";
import { METAL_TYPES } from "@/lib/pricing";
import { validateEmail } from "@/lib/email-validation";

export const quoteModes = ["normal", "without-center", "without-center-and-side"] as const;

export const sideStoneItemSchema = z.object({
  shape: z.string().trim().default("round"),
  caratWeightEach: z.coerce.number().min(0),
  count: z.coerce.number().int().min(0),
  settingType: z.string().trim().default("prong")
});

export const quoteSchema = z.object({
  analysisId: z.string().optional(),
  analysisIds: z.array(z.string()).max(12).optional(),
  customerName: z.union([z.string().trim().min(1).max(200), z.literal("")]).optional(),
  customerEmail: z.string().trim().max(200).optional().superRefine((val, ctx) => {
    if (!val) return;
    const check = validateEmail(val, { allowEmpty: true });
    if (!check.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: check.error || "Please enter a valid customer email address."
      });
    }
  }),
  customerPhone: z.union([z.string().trim().max(50), z.literal("")]).optional(),
  quoteMode: z.enum(quoteModes).default("normal"),
  quantity: z.coerce.number().int().min(1).max(3).default(1),
  stoneOrigin: z.enum(["lab", "natural", "gemstone"]).default("lab"),
  metalType: z.enum(METAL_TYPES),
  metalWeightGrams: z.coerce.number().min(0),
  centerDiamondCarats: z.coerce.number().min(0),
  sideDiamondCarats: z.coerce.number().min(0),
  sideDiamondQuantity: z.coerce.number().int().min(0),
  centerShape: z.union([z.string().trim().max(120), z.literal("")]).optional(),
  centerClarity: z.union([z.string().trim().max(120), z.literal("")]).optional(),
  settingType: z.union([z.string().trim().max(120), z.literal("")]).optional(),
  jewelryType: z.union([z.string().trim().max(120), z.literal("")]).optional(),
  imageDataUrl: z.string().optional(),
  customerNotes: z.string().max(1000).optional(),
  notes: z.string().max(1000).optional(),
  hasWeddingBand: z.boolean().optional().default(false),
  isTwoTone: z.boolean().optional().default(false),
  sideStones: z.array(sideStoneItemSchema).optional()
});

export type QuoteInput = z.infer<typeof quoteSchema>;

export function applyQuoteMode(input: QuoteInput): QuoteInput {
  if (input.quoteMode === "without-center-and-side") {
    return {
      ...input,
      centerDiamondCarats: 0,
      sideDiamondCarats: 0,
      sideDiamondQuantity: 0,
      sideStones: []
    };
  }

  if (input.quoteMode === "without-center") {
    return {
      ...input,
      centerDiamondCarats: 0
    };
  }

  return input;
}

export function deriveDefaultSideStones(input: QuoteInput) {
  if (input.sideStones && input.sideStones.length > 0) {
    return input.sideStones;
  }

  if (input.sideDiamondQuantity > 0 && input.sideDiamondCarats > 0) {
    const detectedShape =
      input.centerShape &&
      ["emerald", "radiant", "cushion", "oval", "pear", "princess"].includes(input.centerShape.toLowerCase()) &&
      input.sideDiamondQuantity <= 4
        ? "fancy"
        : "round";

    return [
      {
        shape: detectedShape,
        caratWeightEach: input.sideDiamondCarats / input.sideDiamondQuantity,
        count: input.sideDiamondQuantity,
        settingType: input.settingType || "prong"
      }
    ];
  }

  return [];
}
