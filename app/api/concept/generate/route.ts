import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { METAL_TYPES } from "@/lib/pricing";
import {
  requireCompanyContext,
  CompanyAccessError,
  canCreateQuotes
} from "@/lib/company";
import { assertBillableSubscription, BillingAccessError } from "@/lib/billing";
import {
  reserveMonthlyUsage,
  consumeMonthlyUsage,
  releaseMonthlyUsage,
  UsageLimitError
} from "@/lib/usage";
import { resolveRuntimeSetting } from "@/lib/app-settings";
import {
  buildAnalysisImageStorageKey,
  storeAnalysisImageInS3
} from "@/lib/quote-pdf-s3";
import { assertPlanFeature, PlanError } from "@/src/stripe/plans";
import { applyRenderRefinements } from "@/lib/ai/render-refinement";

export const runtime = "nodejs";

const conceptRequestSchema = z.object({
  assignedCompanyId: z.string().nullable().optional(),
  prompt: z.string().trim().min(3).max(2000),
  refinementPrompt: z.string().trim().min(3).max(1000).optional(),
  metalType: z.enum(METAL_TYPES).default("14K"),
  customerNotes: z.string().trim().max(1000).optional()
});

const DEFAULT_COLOR_CLARITY = "E VS1";

export function extractSpecsFromPromptText(prompt: string, metalType: string, refinementPrompt?: string) {
  const lower = prompt.toLowerCase();
  
  // Detect Shape
  let shape = "round";
  if (lower.includes("oval")) shape = "oval";
  else if (lower.includes("emerald")) shape = "emerald";
  else if (lower.includes("cushion")) shape = "cushion";
  else if (lower.includes("radiant")) shape = "radiant";
  else if (lower.includes("pear")) shape = "pear";
  else if (lower.includes("marquise")) shape = "marquise";
  else if (lower.includes("princess")) shape = "princess";
  else if (lower.includes("asscher")) shape = "asscher";
  else if (lower.includes("heart")) shape = "heart";

  // Detect Center Carats
  let centerCarats = 1.0;
  const caratMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:ct|carat|cts)/);
  if (caratMatch && caratMatch[1]) {
    const parsed = parseFloat(caratMatch[1]);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 25) {
      centerCarats = parsed;
    }
  }

  // Detect Setting Type
  let settingType = "prong";
  if (lower.includes("bezel")) settingType = "bezel";
  else if (lower.includes("halo")) settingType = "halo";
  else if (lower.includes("tension")) settingType = "tension";

  // Side Stones
  let hasSideStones = false;
  let sideQuantity = 0;
  let sideCarats = 0.0;
  if (lower.includes("halo")) {
    hasSideStones = true;
    sideQuantity = 24;
    sideCarats = 0.5;
  } else if (lower.includes("three stone") || lower.includes("3 stone")) {
    hasSideStones = true;
    sideQuantity = 2;
    sideCarats = centerCarats * 0.5;
  } else if (lower.includes("pave") || lower.includes("pavé")) {
    hasSideStones = true;
    sideQuantity = 14;
    sideCarats = 0.35;
  } else if (lower.includes("side stones") || lower.includes("accent")) {
    hasSideStones = true;
    sideQuantity = 2;
    sideCarats = 0.5;
  }

  // Bands & Tone
  const hasWeddingBand = lower.includes("bridal set") || lower.includes("wedding band") || lower.includes("matching band");
  const isTwoTone = lower.includes("two tone") || lower.includes("two-tone") || lower.includes("mixed metal");

  // Metal Weight Approximation
  let metalWeight = 4.0;
  if (centerCarats > 2.0) metalWeight += 1.5;
  if (hasSideStones) metalWeight += 1.0;
  if (hasWeddingBand) metalWeight += 3.0;

  return applyRenderRefinements({
    jewelryType: "Ring",
    centerShape: shape,
    centerDiamondCarats: centerCarats,
    settingType,
    sideDiamondQuantity: sideQuantity,
    sideDiamondCarats: sideCarats,
    metalWeightGrams: metalWeight,
    hasWeddingBand,
    isTwoTone
  }, refinementPrompt);
}

export async function POST(request: Request) {
  let reservation: { usagePeriodId: string; isOverage: boolean } | undefined;

  try {
    const body = await request.json();
    const { assignedCompanyId, prompt, refinementPrompt, metalType, customerNotes } = conceptRequestSchema.parse(body);

    let companyContext;
    if (assignedCompanyId) {
      const { requireAdminSalesContext } = await import("@/lib/company");
      companyContext = await requireAdminSalesContext(assignedCompanyId) as any;
    } else {
      companyContext = await requireCompanyContext();
    }

    if (!canCreateQuotes(companyContext.membership?.role ?? "CUSTOMER")) {
      throw new CompanyAccessError("You do not have permission to create estimates.");
    }
    if (companyContext.company.accountStatus !== "APPROVED" || !companyContext.company.pricingTier) {
      throw new CompanyAccessError("Account approval and a pricing tier are required to create quotes.");
    }
    
    if (assignedCompanyId !== "INTERNAL") {
      assertBillableSubscription(companyContext.company.subscription);
      await assertPlanFeature(companyContext.company.id, "canGenerateAIImages");
    }

    reservation = await reserveMonthlyUsage(companyContext.company.id);

    const apiKey = (await resolveRuntimeSetting("OPENAI_API_KEY", process.env.OPENAI_API_KEY)) || null;
    
    // 1. Initial heuristic spec parsing
    const extractedSpecs = extractSpecsFromPromptText(prompt, metalType, refinementPrompt);

    let generatedBase64: string | null = null;
    let imageStorageKey: string | null = null;
    let imageDataUrl: string | null = null;

    // 2. Generate concept rendering if API key is present
    if (apiKey) {
      try {
        const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 60_000 });
        
        const imagePrompt = [
          `Create one photorealistic presentation rendering of a ${extractedSpecs.jewelryType}.`,
          `Design concept: ${prompt}.`,
          refinementPrompt ? `MANDATORY REVISION TO THE PREVIOUS DESIGN: ${refinementPrompt}. The revision overrides any conflicting original detail.` : "",
          `Crafted in authentic ${metalType} metal with a ${extractedSpecs.centerShape} center diamond in a ${extractedSpecs.settingType}.`,
          extractedSpecs.sideDiamondQuantity > 0 ? `Features ${extractedSpecs.sideDiamondQuantity} accent side diamonds.` : "",
          "Show only one complete jewelry piece in a refined three-quarter product view.",
          "Realistic precious-metal reflections, physically believable gemstone refraction, crisp edges, premium jewelry studio lighting. Plain, seamless, evenly lit solid white studio background — no props, no gradients, no scenery, no surface texture. Subtle natural shadow, centered composition.",
          "No hands, no person, no packaging, no text, no logo, no watermark, no dimensions, no duplicate jewelry.",
          "This is a customer-facing showroom visualization."
        ].filter(Boolean).join(" ");

        const candidateModels = ["dall-e-3", "gpt-image-2", "dall-e-2"];
        for (const model of candidateModels) {
          try {
            const imgResponse = await client.images.generate({
              model,
              prompt: imagePrompt.slice(0, 4000),
              size: "1024x1024",
              n: 1
            });

            const dataItem = imgResponse.data?.[0];
            if (dataItem?.b64_json) {
              generatedBase64 = dataItem.b64_json;
              break;
            }
            if (dataItem?.url) {
              const fetched = await fetch(dataItem.url);
              const arrayBuffer = await fetched.arrayBuffer();
              generatedBase64 = Buffer.from(arrayBuffer).toString("base64");
              break;
            }
          } catch (modelErr) {
            console.warn(`[concept/generate] Model ${model} failed, trying fallback:`, modelErr);
          }
        }
      } catch (err) {
        console.warn("[concept/generate] OpenAI image generation warning:", err);
      }
    }

    // 3. Fallback placeholder or S3 storage
    if (generatedBase64) {
      const buffer = Buffer.from(generatedBase64, "base64");
      const storageKey = buildAnalysisImageStorageKey(companyContext.company.id, `concept-${Date.now()}`, "image/jpeg");
      const stored = await storeAnalysisImageInS3({
        key: storageKey,
        buffer,
        contentType: "image/jpeg"
      });
      imageStorageKey = stored?.key ?? null;
      imageDataUrl = stored ? null : `data:image/jpeg;base64,${generatedBase64}`;
    }

    // 4. Create AiAnalysis record
    const analysis = await prisma.aiAnalysis.create({
      data: {
        companyId: companyContext.company.id,
        provider: "concept-synthesizer",
        model: "dall-e-3",
        modelVersion: "dall-e-3",
        promptVersion: "concept-v1",
        selectedMetal: metalType,
        jewelryType: extractedSpecs.jewelryType,
        centerShape: extractedSpecs.centerShape,
        centerClarity: DEFAULT_COLOR_CLARITY,
        settingType: extractedSpecs.settingType,
        metalWeightGrams: extractedSpecs.metalWeightGrams,
        centerDiamondCarats: extractedSpecs.centerDiamondCarats,
        sideDiamondCarats: extractedSpecs.sideDiamondCarats,
        sideDiamondQuantity: extractedSpecs.sideDiamondQuantity,
        confidence: "high",
        notes: `Customer Concept: ${prompt}${refinementPrompt ? `\nRevision: ${refinementPrompt}` : ""}${customerNotes ? `\nNotes: ${customerNotes}` : ""}`,
        sourceImageStorageKey: imageStorageKey,
        sourceImageMimeType: "image/jpeg",
        imageDataUrl: imageDataUrl,
        status: "COMPLETED",
        completedAt: new Date(),
        assumptions: [
          `Crafted in ${metalType} with estimated weight of ${extractedSpecs.metalWeightGrams}g.`,
          `Center diamond specified as ${extractedSpecs.centerDiamondCarats} ct ${extractedSpecs.centerShape}.`,
          `Calculated with standard ${DEFAULT_COLOR_CLARITY} diamond grading parameters.`
        ]
      }
    });

    // 5. Consume reserved monthly usage
    await consumeMonthlyUsage(reservation.usagePeriodId, companyContext.company.id);
    reservation = undefined;

    return NextResponse.json({
      analysisId: analysis.id,
      imageDataUrl: imageDataUrl || (imageStorageKey ? `/api/analyze/${analysis.id}/image` : null),
      jewelryType: analysis.jewelryType,
      selectedMetal: analysis.selectedMetal,
      centerShape: analysis.centerShape,
      centerClarity: analysis.centerClarity,
      settingType: analysis.settingType,
      metalWeightGrams: Number(analysis.metalWeightGrams),
      centerDiamondCarats: Number(analysis.centerDiamondCarats),
      sideDiamondCarats: Number(analysis.sideDiamondCarats),
      sideDiamondQuantity: analysis.sideDiamondQuantity,
      hasWeddingBand: extractedSpecs.hasWeddingBand,
      isTwoTone: extractedSpecs.isTwoTone,
      confidence: analysis.confidence,
      notes: analysis.notes,
      assumptions: analysis.assumptions
    });
  } catch (error) {
    if (reservation) {
      await releaseMonthlyUsage(reservation.usagePeriodId).catch(() => undefined);
    }
    if (error instanceof PlanError) {
      return NextResponse.json(
        { error: "Photorealistic 3D Concept Generation is available on the Enterprise plan. Please upgrade to unlock." },
        { status: 403 }
      );
    }
    if (error instanceof UsageLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof CompanyAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof BillingAccessError) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Please enter a valid jewelry description (at least 3 characters)." }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to synthesize concept.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
