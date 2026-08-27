import { NextResponse } from "next/server";
import { resolveMetalPricing } from "@/lib/metal-pricing";

export const runtime = "nodejs";

// Triggered by a scheduled GitHub Actions workflow (~9am Toronto daily) so the
// metals.dev spot rate updates even on days with no site traffic — resolveMetalPricing()
// is otherwise only ever refreshed lazily, the next time a pricing-aware page is visited.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Metal pricing cron is not configured." }, { status: 503 });
  }

  const provided = request.headers.get("x-cron-secret") || request.headers.get("authorization") || "";
  const bearer = provided.startsWith("Bearer ") ? provided.slice("Bearer ".length).trim() : provided.trim();
  if (bearer !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await resolveMetalPricing();

  return NextResponse.json({
    ok: true,
    refreshedFromLiveFeed: result.source !== "configured-default",
    source: result.source,
    goldSpotPerOz: result.pricingProfile.goldSpotPerOz,
    platinumSpotPerOz: result.pricingProfile.platinumSpotPerOz,
    silverSpotPerOz: result.pricingProfile.silverSpotPerOz,
    timestamp: result.timestamp,
    message: result.message
  });
}
