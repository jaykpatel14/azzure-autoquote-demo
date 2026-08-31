import { NextResponse } from "next/server";
import { resolveRuntimeSetting } from "@/lib/app-settings";
import { resolveMetalPricing } from "@/lib/metal-pricing";
import { getActiveShowroom } from "@/lib/showroom";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const startTime = Date.now();
  const results: Record<string, { ok: boolean; message: string; latencyMs: number }> = {};

  try {
    const body = await request.json().catch(() => ({}));
    const token = body.token;

    // 1. Showroom Session check
    const t0 = Date.now();
    let session = null;
    if (token && typeof token === "string") {
      session = await getActiveShowroom(token);
    }
    results.showroomSession = {
      ok: Boolean(session),
      message: session
        ? `Active session for company: ${session.company.name}`
        : "No active showroom session found.",
      latencyMs: Date.now() - t0
    };

    // 2. Database Connectivity
    const t1 = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      results.database = {
        ok: true,
        message: "PostgreSQL connected and responsive.",
        latencyMs: Date.now() - t1
      };
    } catch (dbErr: any) {
      results.database = {
        ok: false,
        message: `Database error: ${dbErr?.message || dbErr}`,
        latencyMs: Date.now() - t1
      };
    }

    // 3. OpenAI API Configuration
    const t2 = Date.now();
    const openaiKey = await resolveRuntimeSetting("OPENAI_API_KEY", process.env.OPENAI_API_KEY);
    results.openai = {
      ok: Boolean(openaiKey && openaiKey.trim().length > 10),
      message: openaiKey ? "OpenAI API key is configured and active." : "OPENAI_API_KEY is missing or invalid.",
      latencyMs: Date.now() - t2
    };

    // 4. Metals.dev Live Price Feed
    const t3 = Date.now();
    try {
      const metalPricing = await resolveMetalPricing();
      const goldSpot = Number(metalPricing.pricingProfile.goldSpotPerOz ?? 0);
      results.metalsPricing = {
        ok: goldSpot > 0,
        message: `Live Gold Spot: $${goldSpot.toFixed(2)}/oz (source: ${metalPricing.source})`,
        latencyMs: Date.now() - t3
      };
    } catch (metalErr: any) {
      results.metalsPricing = {
        ok: false,
        message: `Live metal price warning: ${metalErr?.message || metalErr}`,
        latencyMs: Date.now() - t3
      };
    }

    const allOk = Object.values(results).every((r) => r.ok);

    return NextResponse.json({
      ok: allOk,
      overallStatus: allOk ? "HEALTHY" : "DEGRADED",
      totalDurationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      diagnostics: results
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        overallStatus: "ERROR",
        error: error instanceof Error ? error.message : "Diagnostics failed.",
        diagnostics: results
      },
      { status: 500 }
    );
  }
}
