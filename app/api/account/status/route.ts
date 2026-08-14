import { NextResponse } from "next/server";
import { getAuthenticatedCompanyContext } from "@/lib/company";

export const runtime = "nodejs";

export async function GET() {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    companyId: context.company.id,
    companyName: context.company.name,
    accountStatus: context.company.accountStatus,
    pricingTier: context.company.pricingTier
  });
}
