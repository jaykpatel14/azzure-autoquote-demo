import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError, z } from "zod";
import { prisma } from "@/lib/prisma";
import { METAL_TYPES, calculateQuote } from "@/lib/pricing";
import { allocateQuoteNumber } from "@/lib/quote-number";
import { assertCompanyOwnership } from "@/lib/tenant";
import { requireCompanyContext, AuthRequiredError, CompanyAccessError } from "@/lib/company";
import { normalizePricingProfile, resolveMetalPricing } from "@/lib/metal-pricing";

const quoteSchema = z.object({
  analysisId: z.string().optional(),
  customerName: z.union([z.string().trim().min(1).max(200), z.literal("")]).optional(),
  metalType: z.enum(METAL_TYPES),
  metalWeightGrams: z.coerce.number().min(0),
  centerDiamondCarats: z.coerce.number().min(0),
  sideDiamondCarats: z.coerce.number().min(0),
  sideDiamondQuantity: z.coerce.number().int().min(0)
});

export async function POST(request: Request) {
  try {
    const companyContext = await requireCompanyContext();
    const input = quoteSchema.parse(await request.json());
    const company = companyContext.company;

    const analysis =
      input.analysisId === undefined
        ? null
        : await prisma.aiAnalysis.findFirst({
            where: { id: input.analysisId, companyId: company.id }
          });

    if (input.analysisId && !analysis) {
      return NextResponse.json(
        { error: "Selected estimate does not belong to this company." },
        { status: 404 }
      );
    }

    if (analysis) {
      assertCompanyOwnership(analysis, company.id, "Selected estimate");
    }

    const pricingProfile = company.pricingProfile
      ? normalizePricingProfile({
          goldSpotPerOz: Number(company.pricingProfile.goldSpotPerOz),
          platinumSpotPerOz: Number(company.pricingProfile.platinumSpotPerOz),
          silverSpotPerOz: Number(company.pricingProfile.silverSpotPerOz),
          cadCharge: Number(company.pricingProfile.cadCharge),
          centerSettingPerCarat: Number(company.pricingProfile.centerSettingPerCarat),
          sideSettingPerStone: Number(company.pricingProfile.sideSettingPerStone),
          sellingMarginDivisor: Number(company.pricingProfile.sellingMarginDivisor),
          finalMultiplier: Number(company.pricingProfile.finalMultiplier)
        })
      : undefined;

    const livePricing = await resolveMetalPricing(pricingProfile);

    const pricing = calculateQuote(
      {
        metalType: input.metalType,
        metalWeightGrams: input.metalWeightGrams,
        centerDiamondCarats: input.centerDiamondCarats,
        sideDiamondCarats: input.sideDiamondCarats,
        sideDiamondQuantity: input.sideDiamondQuantity
      },
      livePricing.pricingProfile
    );

    const quote = await createQuoteRecord(company.id, analysis?.id, input, pricing.estimatedFinalPrice);

    return NextResponse.json({
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      estimatedPrice: Number(quote.estimatedPrice),
      pricingSource: livePricing.source
    });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof CompanyAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid request." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save quote." },
      { status: 400 }
    );
  }
}

async function createQuoteRecord(
  companyId: string,
  analysisId: string | undefined,
  input: {
    customerName?: string | null;
    metalType: (typeof METAL_TYPES)[number];
    metalWeightGrams: number;
    centerDiamondCarats: number;
    sideDiamondCarats: number;
    sideDiamondQuantity: number;
  },
  estimatedPrice: number
) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const quoteNumber = await allocateQuoteNumber(tx, companyId);

        return tx.quote.create({
          data: {
            companyId,
            quoteNumber,
            analysisId,
            customerName: input.customerName || null,
            metalType: input.metalType,
            metalWeightGrams: input.metalWeightGrams,
            centerDiamondCarats: input.centerDiamondCarats,
            sideDiamondCarats: input.sideDiamondCarats,
            sideDiamondQuantity: input.sideDiamondQuantity,
            estimatedPrice
          }
        });
      });
    } catch (error) {
      const isUniqueQuoteNumberError =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        (error.meta?.target as string[] | string | undefined)?.toString().includes("companyId,quoteNumber");

      if (!isUniqueQuoteNumberError || attempt === maxAttempts) {
        throw error;
      }
    }
  }

  throw new Error("Unable to save quote.");
}
