import { NextResponse } from "next/server";
import {
  requireCompanyContext,
  AuthRequiredError,
  CompanyAccessError,
  canManageBilling
} from "@/lib/company";
import { resolveMetalPricing, normalizePricingProfile } from "@/lib/metal-pricing";
import type { PricingProfileInput } from "@/lib/pricing";

export const runtime = "nodejs";

export async function GET() {
  try {
    const context = await requireCompanyContext();

    // Allow viewing live pricing for all authenticated users (read-only)
    const resolvedPricing = await resolveMetalPricing();

    return NextResponse.json({
      goldSpotPerOz: resolvedPricing.pricingProfile.goldSpotPerOz,
      platinumSpotPerOz: resolvedPricing.pricingProfile.platinumSpotPerOz,
      silverSpotPerOz: resolvedPricing.pricingProfile.silverSpotPerOz,
      cadCharge: resolvedPricing.pricingProfile.cadCharge,
      centerSettingPerCarat: resolvedPricing.pricingProfile.centerSettingPerCarat,
      sideSettingPerStone: resolvedPricing.pricingProfile.sideSettingPerStone,
      sellingMarginDivisor: resolvedPricing.pricingProfile.sellingMarginDivisor,
      finalMultiplier: resolvedPricing.pricingProfile.finalMultiplier,
      source: resolvedPricing.source,
      message: resolvedPricing.message,
      timestamp: resolvedPricing.timestamp,
      accessedBy: {
        companyId: context.company?.id,
        userId: context.user.id,
        userRole: context.membership?.role
      }
    });
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to fetch live pricing." },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const context = await requireCompanyContext();
    if (!canManageBilling(context.membership?.role ?? "CUSTOMER")) {
      throw new CompanyAccessError("You do not have permission to manage pricing.");
    }
    return NextResponse.json(
      { error: "Live metal pricing is managed automatically and cannot be edited." },
      { status: 403 }
    );
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof CompanyAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update pricing." },
      { status: 400 }
    );
  }
}
