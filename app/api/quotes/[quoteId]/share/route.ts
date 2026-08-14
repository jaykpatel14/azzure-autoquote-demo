import { NextResponse } from "next/server";
import { requireCompanyContext } from "@/lib/company";
import { createShareLink } from "@/src/services/sharing";
import { PlanError } from "@/src/stripe/plans";

export async function POST(_request: Request, { params }: { params: Promise<{ quoteId: string }> }) {
  try {
    const context = await requireCompanyContext();
    const result = await createShareLink({ companyId: context.company.id, quoteId: (await params).quoteId });
    if ("error" in result) return NextResponse.json({ error: result.error.userMessage }, { status: result.error.statusCode });
    return NextResponse.json({ token: result.data.token, url: `/q/${result.data.token}` }, { status: 201 });
  } catch (error) {
    if (error instanceof PlanError) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to share quote." }, { status: 400 });
  }
}
