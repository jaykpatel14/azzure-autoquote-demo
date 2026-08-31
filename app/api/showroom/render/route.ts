import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { getActiveShowroom } from "@/lib/showroom";
import { resolveRuntimeSetting } from "@/lib/app-settings";

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
  description: z.string().optional()
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

    const jewelryType = input.jewelryType || "fine jewelry piece";
    const metalLabel = input.metalColor ? `${input.metalType || "14K"} ${input.metalColor} gold` : (input.metalType || "14K Gold");
    const centerShape = input.centerShape || "brilliant diamond";
    const centerCarats = input.centerCarats ? `${input.centerCarats} carats` : "proportionate center stone";
    const sideDiamonds = input.sideDiamondQuantity && input.sideDiamondQuantity > 0
      ? `Include ${input.sideDiamondQuantity} accent side diamonds totaling approximately ${input.sideDiamondCarats || 0.5} carats.`
      : "";
    const setting = input.settingType ? `Set in a ${input.settingType} setting.` : "";
    const customNotes = input.description ? `Customer design details: ${input.description}.` : "";

    const prompt = [
      `Create one photorealistic luxury studio product presentation rendering of this ${jewelryType}.`,
      `Crafted in authentic ${metalLabel}, approximately ${input.metalWeightGrams || 5} grams.`,
      `Features a ${centerShape} center diamond of ${centerCarats}.`,
      setting,
      sideDiamonds,
      customNotes,
      "Show only one complete jewelry piece in a refined three-quarter product view.",
      "Realistic precious-metal reflections, physically believable gemstone refraction, crisp edges, premium jewelry studio lighting. Plain, seamless, evenly lit solid white studio background — no props, no gradients, no scenery, no surface texture. Subtle natural shadow directly beneath the piece, centered composition.",
      "No hands, no person, no packaging, no text, no logo, no watermark, no dimensions, no duplicate jewelry, no exploded view.",
      "This is a customer-facing visualization, not a technical CAD drawing."
    ].filter(Boolean).join(" ");

    const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 75_000 });
    const response = await client.images.generate({
      model: "dall-e-3",
      prompt: prompt.slice(0, 4000),
      size: "1024x1024",
      quality: "standard",
      response_format: "b64_json",
      n: 1
    });

    const dataItem = response.data?.[0];
    let base64 = dataItem?.b64_json;
    if (!base64 && dataItem?.url) {
      const fetched = await fetch(dataItem.url);
      const arrayBuffer = await fetched.arrayBuffer();
      base64 = Buffer.from(arrayBuffer).toString("base64");
    }

    if (!base64) {
      return NextResponse.json({ error: "Failed to generate image data." }, { status: 500 });
    }

    return NextResponse.json({
      renderingImageUrl: `data:image/jpeg;base64,${base64}`
    });
  } catch (error) {
    console.error("[api/showroom/render] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Rendering failed." },
      { status: 500 }
    );
  }
}
