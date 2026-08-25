import { NextResponse } from "next/server";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getShowroomDevicesForCompany } from "@/lib/showroom-devices";
import { getCompanyPlanFeatures } from "@/src/stripe/plans";

export const runtime = "nodejs";

export async function GET() {
  try {
    const context = await getAuthenticatedCompanyContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { features } = await getCompanyPlanFeatures(context.company.id);
    if (!features.canUseShowroomMode) {
      return NextResponse.json({ error: "Enterprise plan required for showroom device management." }, { status: 403 });
    }

    const devices = await getShowroomDevicesForCompany(context.company.id);
    return NextResponse.json({ devices }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch showroom devices." },
      { status: 500 }
    );
  }
}
