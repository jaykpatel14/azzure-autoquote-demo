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

export const runtime = "nodejs";

const conceptRequestSchema = z.object({
  prompt: z.string().trim().min(3).max(2000),
  metalType: z.enum(METAL_TYPES).default("14K"),
  customerNotes: z.string().trim().max(1000).optional()
});

const DEFAULT_COLOR_CLARITY = "E VS1";

function extractSpecsFromPromptText(prompt: string, metalType: string) {
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
  else if (lower.includes("pavé") || lower.includes("pave")) settingType = "pave";
  else if (lower.includes("channel")) settingType = "channel";
  else if (lower.includes("tension")) settingType = "tension";

  // Detect Side Diamonds
  let sideQuantity = 0;
  let sideCarats = 0.0;
  if (lower.includes("halo") || lower.includes("pavé") || lower.includes("pave") || lower.includes("side stone") || lower.includes("accent")) {
    sideQuantity = lower.includes("hidden halo") ? 14 : lower.includes("halo") ? 20 : 16;
    sideCarats = Number((sideQuantity * 0.02).toFixed(2));
  } else if (lower.includes("three-stone") || lower.includes("3 stone") || lower.includes("3-stone")) {
    sideQuantity = 2;
    sideCarats = Number((centerCarats * 0.5).toFixed(2));
  }

  // Detect Metal Weight
  let metalWeight = 3.8;
  if (metalType === "Platinum") metalWeight = 5.6;
  else if (lower.includes("chunky") || lower.includes("wide band") || lower.includes("mens") || lower.includes("men's")) metalWeight = 7.5;
  else if (lower.includes("delicate") || lower.includes("thin band") || lower.includes("dainty")) metalWeight = 2.8;

  // Detect Jewelry Type
  let jewelryType = "Ring";
  if (lower.includes("necklace") || lower.includes("pendant")) jewelryType = "Necklace";
  else if (lower.includes("earring") || lower.includes("stud")) jewelryType = "Earrings";
  else if (lower.includes("bracelet") || lower.includes("bangle")) jewelryType = "Bracelet";

  const hasWeddingBand = lower.includes("bridal set") || lower.includes("wedding band") || lower.includes("matching band");
  const isTwoTone = lower.includes("two tone") || lower.includes("two-tone");

  return {
    jewelryType,
    centerShape: shape,
    centerDiamondCarats: centerCarats,
    settingType,
    sideDiamondQuantity: sideQuantity,
    sideDiamondCarats: sideCarats,
    metalWeightGrams: metalWeight,
    hasWeddingBand,
    isTwoTone
  };
}

export async function POST(request: Request) {
  let reservation: { usagePeriodId: string; isOverage: boolean } | undefined;

  try {
    const companyContext = await requireCompanyContext();
    if (!canCreateQuotes(companyContext.membership?.role ?? "CUSTOMER")) {
      throw new CompanyAccessError("You do not have permission to create estimates.");
    }
    if (companyContext.company.accountStatus !== "APPROVED" || !companyContext.company.pricingTier) {
      throw new CompanyAccessError("Account approval and a pricing tier are required to create quotes.");
    }
    assertBillableSubscription(companyContext.company.subscription);
    await assertPlanFeature(companyContext.company.id, "canGenerateAIImages");

    const body = await request.json();
    const { prompt, metalType, customerNotes } = conceptRequestSchema.parse(body);

    reservation = await reserveMonthlyUsage(companyContext.company.id);

    const apiKey = (await resolveRuntimeSetting("OPENAI_API_KEY", process.env.OPENAI_API_KEY)) || null;
    
    // 1. Initial heuristic spec parsing
    const extractedSpecs = extractSpecsFromPromptText(prompt, metalType);

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
          `Crafted in authentic ${metalType} metal with a ${extractedSpecs.centerShape} center diamond in a ${extractedSpecs.settingType}.`,
          extractedSpecs.sideDiamondQuantity > 0 ? `Features ${extractedSpecs.sideDiamondQuantity} accent side diamonds.` : "",
          "Show only one complete jewelry piece in a refined three-quarter product view.",
          "Realistic precious-metal reflections, physically believable gemstone refraction, crisp edges, premium jewelry studio lighting. Plain, seamless, evenly lit solid white studio background — no props, no gradients, no scenery, no surface texture. Subtle natural shadow, centered composition.",
          "No hands, no person, no packaging, no text, no logo, no watermark, no dimensions, no duplicate jewelry.",
          "This is a customer-facing showroom visualization."
        ].filter(Boolean).join(" ");

        const imgResponse = await client.images.generate({
          model: "gpt-image-2",
          prompt: imagePrompt,
          size: "1024x1536",
          quality: "medium",
          background: "opaque",
          output_format: "jpeg",
          output_compression: 85,
          n: 1
        });

        generatedBase64 = imgResponse.data?.[0]?.b64_json ?? null;
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
        model: "gpt-image-2",
        modelVersion: "gpt-image-2",
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
        notes: `Customer Concept: ${prompt}${customerNotes ? `\nNotes: ${customerNotes}` : ""}`,
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
