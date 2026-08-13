import { NextResponse } from "next/server";
import { requireCompanyContext, AuthRequiredError, CompanyAccessError, canCreateQuotes } from "@/lib/company";
import { createQuote, getQuote } from "@/src/services/quotes";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    quoteId: string;
  }>;
};

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const context = await requireCompanyContext();
    if (!canCreateQuotes(context.membership?.role ?? "CUSTOMER")) {
      throw new CompanyAccessError("You do not have permission to create quotes.");
    }

    const { quoteId } = await params;
    const quoteResult = await getQuote({
      quoteId,
      companyId: context.company.id
    });

    if ("error" in quoteResult) {
      return NextResponse.json(
        { error: quoteResult.error.userMessage },
        { status: quoteResult.error.statusCode }
      );
    }

    const created = await createQuote({
      companyId: context.company.id,
      customerName: quoteResult.data.customerName,
      metalType: quoteResult.data.metalType,
      metalWeightGrams: Number(quoteResult.data.metalWeightGrams),
      centerDiamondCarats: Number(quoteResult.data.centerDiamondCarats),
      sideDiamondCarats: Number(quoteResult.data.sideDiamondCarats),
      sideDiamondQuantity: quoteResult.data.sideDiamondQuantity,
      estimatedPrice: Number(quoteResult.data.estimatedPrice)
    });

    if ("error" in created) {
      return NextResponse.json(
        { error: created.error.userMessage },
        { status: created.error.statusCode }
      );
    }

    return NextResponse.redirect(new URL(`/quotes/${created.data.id}`, _request.url), 303);
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof CompanyAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to duplicate quote." },
      { status: 400 }
    );
  }
}
