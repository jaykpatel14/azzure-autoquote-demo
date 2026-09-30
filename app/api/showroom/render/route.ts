import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { getActiveShowroom } from "@/lib/showroom";
import { resolveRuntimeSetting } from "@/lib/app-settings";
import { applyRenderRefinements } from "@/lib/ai/render-refinement";

const schema = z.object({
  token: z.string().min(20),
  jewelryType: z.string().optional(),
  metalType: z.string().optional(),
  metalColor: z.string().nullable().optional(),
  metalWeightGrams: z.number().optional(),
  centerShape: z.string().optional(),
  centerCarats: z.number().optional(),
  sideDiamondQuantity: z.number().optional(),
  sideDiamondCarats: z.number().optional(),
  settingType: z.string().nullable().optional(),
  centerClarity: z.string().optional(),
  description: z.string().optional(),
  refinementPrompt: z.string().trim().max(1000).optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = schema.parse(body);

    const session = await getActiveShowroom(input.token);
    if (!session) {
      return NextResponse.json({ error: "Invalid or expired showroom token." }, { status: 401 });
    }

    const apiKey = (await resolveRuntimeSetting("OPENAI_API_KEY", process.env.OPENAI_API_KEY)) || null;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 500 });
    }

    const revisedSpecs = applyRenderRefinements({
      centerShape: input.centerShape,
      centerDiamondCarats: input.centerCarats || 1,
      sideDiamondQuantity: input.sideDiamondQuantity || 0,
      sideDiamondCarats: input.sideDiamondCarats || 0,
      settingType: input.settingType
    }, input.refinementPrompt);
    const jewelryType = input.jewelryType || "fine jewelry piece";
    const metalLabel = input.metalColor ? `${input.metalType || "14K"} ${input.metalColor} gold` : (input.metalType || "14K Gold");
    const centerShape = revisedSpecs.centerShape || "brilliant diamond";
    const centerCarats = revisedSpecs.centerDiamondCarats ? `${revisedSpecs.centerDiamondCarats} carats` : "proportionate center stone";
    const sideDiamonds = revisedSpecs.sideDiamondQuantity > 0
      ? `Include ${revisedSpecs.sideDiamondQuantity} accent side diamonds totaling approximately ${revisedSpecs.sideDiamondCarats || 0.5} carats.`
      : "";
    const setting = revisedSpecs.settingType ? `Set in a ${revisedSpecs.settingType} setting.` : "";
    const customNotes = input.description ? `Customer design details: ${input.description}.` : "";
    const refinement = input.refinementPrompt
      ? `MANDATORY REVISION TO THE PREVIOUS RENDER: ${input.refinementPrompt}. This instruction overrides conflicting design details above.`
      : "";

    const prompt = [
      `Create one photorealistic luxury studio product presentation rendering of this ${jewelryType}.`,
      `Crafted in authentic ${metalLabel}, approximately ${input.metalWeightGrams || 5} grams.`,
      `Features a ${centerShape} center diamond of ${centerCarats}.`,
      setting,
      sideDiamonds,
      customNotes,
      refinement,
      "Show only one complete jewelry piece in a refined three-quarter product view.",
      "Realistic precious-metal reflections, physically believable gemstone refraction, crisp edges, premium jewelry studio lighting. Plain, seamless, evenly lit solid white studio background — no props, no gradients, no scenery, no surface texture. Subtle natural shadow directly beneath the piece, centered composition.",
      "No hands, no person, no packaging, no text, no logo, no watermark, no dimensions, no duplicate jewelry, no exploded view.",
      "This is a customer-facing visualization, not a technical CAD drawing."
    ].filter(Boolean).join(" ");

    const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 75_000 });
    const candidateModels = ["dall-e-3", "gpt-image-2", "dall-e-2"];
    let base64: string | null = null;
    let lastError: unknown = null;

    for (const model of candidateModels) {
      try {
        const response = await client.images.generate({
          model,
          prompt: prompt.slice(0, 4000),
          size: "1024x1024",
          n: 1
        });

        const dataItem = response.data?.[0];
        if (dataItem?.b64_json) {
          base64 = dataItem.b64_json;
          break;
        }
        if (dataItem?.url) {
          const fetched = await fetch(dataItem.url);
          const arrayBuffer = await fetched.arrayBuffer();
          base64 = Buffer.from(arrayBuffer).toString("base64");
          break;
        }
      } catch (err) {
        console.warn(`[api/showroom/render] Model ${model} failed, trying fallback:`, err);
        lastError = err;
      }
    }

    if (!base64) {
      throw lastError || new Error("Failed to generate image data.");
    }

    return NextResponse.json({
      renderingImageUrl: `data:image/jpeg;base64,${base64}`,
      revisedSpecs
    });
  } catch (error) {
    console.error("[api/showroom/render] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Rendering failed." },
      { status: 500 }
    );
  }
}
