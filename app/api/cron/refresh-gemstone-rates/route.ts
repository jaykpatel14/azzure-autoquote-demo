import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { resolveRuntimeSetting } from "@/lib/app-settings";

export const runtime = "nodejs";

const GemstonePriceSchema = z.object({
  commercial: z.object({ low: z.number(), high: z.number() }),
  fine: z.object({ low: z.number(), high: z.number() }),
  premium: z.object({ low: z.number(), high: z.number() }),
  sources: z.array(z.string())
});

async function refreshGemstoneStone(
  openai: OpenAI,
  stone: string,
  model: string,
  existingSources: string[] | undefined
): Promise<z.infer<typeof GemstonePriceSchema> | null> {
  const prompt = `Search the web for current commercial wholesale pricing per carit for ${stone} colored gemstones. Provide three price ranges in USD per carat: commercial (commercial quality, heat-treated, included), fine (eye-clean, good color, treated or untreated), and premium (top color, untreated, GIA certified). Give low and high bounds for each tier. Cite your sources.`;

  try {
    const response = await openai.responses.parse({
      model,
      input: [
        {
          role: "system",
          content:
            "You are a gemstone pricing expert with access to current market data. Provide accurate, cited pricing information for colored gemstones."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      text: {
        format: zodTextFormat(GemstonePriceSchema, "gemstone_prices")
      }
    });

    if (!response.output_parsed) {
      console.warn(`No parsed output for ${stone}`);
      return null;
    }

    const data = response.output_parsed;

    // Validate bounds make sense
    const { commercial, fine, premium } = data;
    if (
      commercial.low < 0 || commercial.high < commercial.low ||
      fine.low < 0 || fine.high < fine.low ||
      premium.low < 0 || premium.high < premium.low
    ) {
      console.warn(`Invalid price bounds for ${stone}:`, data);
      return null;
    }

    return {
      commercial,
      fine,
      premium,
      sources: Array.from(new Set([...(existingSources || []), ...data.sources]))
    };
  } catch (error) {
    console.error(`Failed to refresh ${stone}:`, error);
    return null;
  }
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Gemstone pricing cron is not configured." },
      { status: 503 }
    );
  }

  const provided = request.headers.get("x-cron-secret") ||
                   request.headers.get("authorization") || "";
  const bearer = provided.startsWith("Bearer ")
    ? provided.slice("Bearer ".length).trim()
    : provided.trim();

  if (bearer !== secret) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  const apiKey =
    (await resolveRuntimeSetting("OPENAI_API_KEY", process.env.OPENAI_API_KEY)) ||
    null;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured." },
      { status: 503 }
    );
  }

  const model =
    (await resolveRuntimeSetting("OPENAI_MODEL", process.env.OPENAI_MODEL)) ||
    "gpt-5-mini";

  const openai = new OpenAI({ apiKey, maxRetries: 0 });

  const activeStones = await prisma.gemstoneRate.findMany({
    where: { isActive: true },
    select: { stone: true, sources: true }
  });

  // parseCommaSeparated — split CSV string into array, drop empties
  const parseSources = (s: string | null | undefined): string[] =>
    (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

  const results = {
    updated: 0,
    failed: 0,
    details: [] as Array<{
      stone: string;
      success: boolean;
      error?: string;
      changes?: {
        commercial: { low: number; high: number };
        fine: { low: number; high: number };
        premium: { low: number; high: number };
      };
      sources: string[];
    }>
  };

  for (const stoneData of activeStones) {
    try {
      const priceData = await refreshGemstoneStone(
        openai,
        stoneData.stone,
        model,
        parseSources(stoneData.sources)
      );

      if (!priceData) {
        results.failed++;
        results.details.push({
          stone: stoneData.stone,
          success: false,
          sources: [],
          error: "Failed to get pricing data from AI"
        });
        continue;
      }

      await prisma.gemstoneRate.update({
        where: { stone: stoneData.stone },
        data: {
          commercialLowPerCt: priceData.commercial.low,
          commercialHighPerCt: priceData.commercial.high,
          fineLowPerCt: priceData.fine.low,
          fineHighPerCt: priceData.fine.high,
          premiumLowPerCt: priceData.premium.low,
          premiumHighPerCt: priceData.premium.high,
          sources: priceData.sources.join(", "),
          refreshedAt: new Date()
          // reviewedAt is NOT updated — keeps the human review date separate
        }
      });

      results.updated++;
      results.details.push({
        stone: stoneData.stone,
        success: true,
        changes: {
          commercial: priceData.commercial,
          fine: priceData.fine,
          premium: priceData.premium
        },
        sources: priceData.sources
      });
    } catch (error) {
      results.failed++;
      results.details.push({
        stone: stoneData.stone,
        success: false,
        sources: [],
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  return NextResponse.json({
    ok: true,
    updated: results.updated,
    failed: results.failed,
    stoneCount: activeStones.length,
    details: results.details
  });
}
