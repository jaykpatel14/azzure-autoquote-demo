import { NextResponse } from "next/server";
import { z } from "zod";
import {
  requireCompanyContext,
  AuthRequiredError,
  CompanyAccessError,
  canDeleteQuotes,
  canViewQuotes
} from "@/lib/company";
import { deleteQuote, getQuote } from "@/src/services/quotes";
import { assertPlanFeature, PlanError } from "@/src/stripe/plans";

export const runtime = "nodejs";

const paramsSchema = z.object({
  quoteId: z.string().cuid()
});

type RouteContext = {
  params: Promise<{
    quoteId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const context = await requireCompanyContext();
    await assertPlanFeature(context.company.id, "canViewQuoteHistory");
    if (!canViewQuotes(context.membership?.role ?? "CUSTOMER")) {
      throw new CompanyAccessError("You do not have permission to view quotes.");
    }
    const parsed = paramsSchema.safeParse(await params);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const result = await getQuote({
      quoteId: parsed.data.quoteId,
      companyId: context.company.id
    });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error.userMessage },
        { status: result.error.statusCode }
      );
    }

    return NextResponse.json({
      id: result.data.id,
      quoteNumber: result.data.quoteNumber,
      customerName: result.data.customerName,
      metalType: result.data.metalType,
      metalWeightGrams: Number(result.data.metalWeightGrams),
      centerDiamondCarats: Number(result.data.centerDiamondCarats),
      sideDiamondCarats: Number(result.data.sideDiamondCarats),
      sideDiamondQuantity: result.data.sideDiamondQuantity,
      estimatedPrice: Number(result.data.estimatedPrice),
      createdAt: result.data.createdAt,
      analysis: result.data.analysis
    });
  } catch (error) {
    if (error instanceof PlanError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof CompanyAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load quote." },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const context = await requireCompanyContext();
    if (!canDeleteQuotes(context.membership?.role ?? "CUSTOMER")) {
      throw new CompanyAccessError("You do not have permission to delete quotes.");
    }
    const parsed = paramsSchema.safeParse(await params);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const result = await deleteQuote({
      quoteId: parsed.data.quoteId,
      companyId: context.company.id
    });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error.userMessage },
        { status: result.error.statusCode }
      );
    }

    return NextResponse.json({ deleted: true, quoteId: result.data.quoteId });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof CompanyAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete quote." },
      { status: 400 }
    );
  }
}
