import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { ZodError, z } from "zod";
import { prisma } from "@/lib/prisma";
import { METAL_TYPES, calculateQuote } from "@/lib/pricing";
import { allocateQuoteNumber } from "@/lib/quote-number";
import { assertCompanyOwnership } from "@/lib/tenant";
import { requireCompanyContext, AuthRequiredError, CompanyAccessError } from "@/lib/company";

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
    const companyContext = await requireCompanyContext("ESTIMATOR");
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
      ? {
          goldSpotPerOz: Number(company.pricingProfile.goldSpotPerOz),
          platinumSpotPerOz: Number(company.pricingProfile.platinumSpotPerOz),
          silverSpotPerOz: Number(company.pricingProfile.silverSpotPerOz),
          cadCharge: Number(company.pricingProfile.cadCharge),
          centerSettingPerCarat: Number(company.pricingProfile.centerSettingPerCarat),
          sideSettingPerStone: Number(company.pricingProfile.sideSettingPerStone),
          sellingMarginDivisor: Number(company.pricingProfile.sellingMarginDivisor),
          finalMultiplier: Number(company.pricingProfile.finalMultiplier)
        }
      : undefined;

    const pricing = calculateQuote(
      {
        metalType: input.metalType,
        metalWeightGrams: input.metalWeightGrams,
        centerDiamondCarats: input.centerDiamondCarats,
        sideDiamondCarats: input.sideDiamondCarats,
        sideDiamondQuantity: input.sideDiamondQuantity
      },
      pricingProfile
    );

    const quote = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const quoteNumber = await allocateQuoteNumber(tx, company.id);

      return tx.quote.create({
        data: {
          companyId: company.id,
          quoteNumber,
          analysisId: analysis?.id,
          customerName: input.customerName || null,
          metalType: input.metalType,
          metalWeightGrams: input.metalWeightGrams,
          centerDiamondCarats: input.centerDiamondCarats,
          sideDiamondCarats: input.sideDiamondCarats,
          sideDiamondQuantity: input.sideDiamondQuantity,
          estimatedPrice: pricing.estimatedFinalPrice
        }
      });
    });

    return NextResponse.json({
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      estimatedPrice: Number(quote.estimatedPrice)
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
