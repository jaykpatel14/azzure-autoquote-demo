import { NextResponse } from "next/server";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import OpenAI from "openai";
import { requireInternalAdminContext, InternalAdminAccessError } from "@/lib/internal-admin";
import { getAllGemstoneRates, updateGemstoneRate, markGemstoneRateAsReviewed } from "@/src/services/gemstone-rates";
import { resolveRuntimeSetting } from "@/lib/app-settings";

export const runtime = "nodejs";

const updateSchema = z.object({
  action: z.enum(["update", "review", "refresh"]).optional(),
  id: z.string().optional(),
  field: z.string().optional(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
  reviewedBy: z.string().optional(),
  isActive: z.union([z.string(), z.boolean()]).optional()
});

async function parseInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return updateSchema.parse(await request.json());
  }

  const formData = await request.formData();
  const action = String(formData.get("action") || "");
  const id = String(formData.get("id") || "");
  const field = String(formData.get("field") || "");
  const value = formData.get("value");
  const reviewedBy = String(formData.get("reviewedBy") || "");
  const isActive = formData.get("isActive");

  return updateSchema.parse({
    action: action || "update",
    id: id || undefined,
    field: field || undefined,
    value: value !== null ? value : undefined,
    reviewedBy: reviewedBy || undefined,
    isActive: isActive !== null ? (String(isActive) === "on") : undefined
  });
}

export async function GET(request: Request) {
  try {
    await requireInternalAdminContext();
    const rates = await getAllGemstoneRates();
    return NextResponse.json({ rates });
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to load gemstone rates." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireInternalAdminContext();
    const parsed = await parseInput(request);

    if (parsed.action === "review") {
      if (!parsed.id) throw new Error("Missing id");
      const rate = await markGemstoneRateAsReviewed(parsed.id, parsed.reviewedBy || admin.user.email || "admin");
      return NextResponse.json({ ok: true, rate });
    }

    if (parsed.action === "update") {
      if (!parsed.id) throw new Error("Missing id");

      const data: Record<string, unknown> = {};
      const fieldMap: Record<string, string> = {
        commercialLow: "commercialLowPerCt",
        commercialHigh: "commercialHighPerCt",
        fineLow: "fineLowPerCt",
        fineHigh: "fineHighPerCt",
        premiumLow: "premiumLowPerCt",
        premiumHigh: "premiumHighPerCt",
        displayName: "displayName",
        isActive: "isActive"
      };

      const fields = ["commercialLow", "commercialHigh", "fineLow", "fineHigh", "premiumLow", "premiumHigh", "displayName", "isActive"];
      for (const f of fields) {
        const raw = parsed[f as keyof typeof parsed];
        if (raw !== undefined && raw !== null) {
          const prismaField = fieldMap[f];
          if (prismaField === "isActive") {
            data[prismaField] = Boolean(raw);
          } else {
            const numValue = typeof raw === "number" ? raw : Number(raw);
            if (Number.isNaN(numValue)) throw new Error(`Invalid number value for ${f}`);
            data[prismaField] = numValue;
          }
        }
      }

      // isActive from checkbox
      if (parsed.isActive !== undefined) {
        data.isActive = Boolean(parsed.isActive);
      }

      const rate = await updateGemstoneRate(parsed.id as string, data);
      return NextResponse.json({ ok: true, rate });
    }

    if (parsed.action === "refresh") {
      if (!parsed.id) throw new Error("Missing id");

      const apiKey = await resolveRuntimeSetting("OPENAI_API_KEY", process.env.OPENAI_API_KEY);
      if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

      const model = await resolveRuntimeSetting("OPENAI_MODEL", process.env.OPENAI_MODEL) || "gpt-5-mini";
      const openai = new OpenAI({ apiKey, maxRetries: 0 });

      const rates = await getAllGemstoneRates();
      const target = rates.find((r) => r.id === parsed.id);
      if (!target) throw new Error("Gemstone not found");

      // local schema mirrors the cron route schema
      const gemPriceSchema = z.object({
        commercial: z.object({ low: z.number(), high: z.number() }),
        fine: z.object({ low: z.number(), high: z.number() }),
        premium: z.object({ low: z.number(), high: z.number() }),
        sources: z.array(z.string())
      });

      const prompt = `Search the web for current commercial wholesale pricing per carat for ${target.stone} colored gemstones. Provide three price ranges in USD per carat: commercial (commercial quality, heat-treated, included), fine (eye-clean, good color, treated or untreated), and premium (top color, untreated, GIA certified). Give low and high bounds for each tier. Cite your sources.`;

      const response = await openai.responses.parse({
        model,
        input: [
          { role: "system", content: "You are a gemstone pricing expert with access to current market data." },
          { role: "user", content: prompt }
        ],
        text: { format: zodTextFormat(gemPriceSchema, "gemstone_prices") }
      });

      if (!response.output_parsed) throw new Error("No parsed output from AI");

      const data = response.output_parsed;
      const rate = await updateGemstoneRate(parsed.id as string, {
        commercialLowPerCt: data.commercial.low,
        commercialHighPerCt: data.commercial.high,
        fineLowPerCt: data.fine.low,
        fineHighPerCt: data.fine.high,
        premiumLowPerCt: data.premium.low,
        premiumHighPerCt: data.premium.high,
        sources: [...(target.sources ? target.sources.split(",").map((s) => s.trim()).filter(Boolean) : []), ...data.sources].join(", ")
      });

      return NextResponse.json({ ok: true, rate });
    }

    throw new Error("Unknown action");
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid input." }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed." }, { status: 400 });
  }
}
