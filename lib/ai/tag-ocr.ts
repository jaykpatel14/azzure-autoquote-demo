import type OpenAI from "openai";

export type JewelryTagData = {
  hasTag: boolean;
  centerCarats?: number | null;
  sideCarats?: number | null;
  sideCount?: number | null;
  metalPurity?: string | null;
  metalColor?: "yellow" | "white" | "rose" | null;
  centerShape?: string | null;
  diamondClarity?: string | null;
  diamondColor?: string | null;
  rawText?: string | null;
  confidence?: "high" | "medium" | "low";
};

export async function extractJewelryTagData(
  openai: OpenAI,
  imageDataUrl: string,
  model = "gpt-5-mini"
): Promise<JewelryTagData | null> {
  if (!imageDataUrl) return null;

  try {
    const response = await openai.chat.completions.create({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `You are an expert high-precision OCR scanner for fine jewelry retail tags, dumbbell stickers, and certificate receipts.
Analyze the image carefully. If there is a printed or handwritten jewelry tag, barcode label, or certificate in frame:
1. Read all numbers followed by 'ct', 'cts', 'ctw', 'd', 'dia', 'c', or decimal weights (e.g., '3.020 ct', '0.320 ct', '3.02', '0.32').
   - The larger primary carat weight is usually the center stone (e.g. 3.020 ct).
   - Any secondary carat weight (e.g. 0.320 ct / 2pc) is the side stone total.
2. Extract diamond color/clarity codes (e.g., 'VS1', 'VVS2', 'SI1', 'E', 'F', 'G').
3. Extract metal purity stamp (e.g., '14K', '14KT', '18K', '18KT', 'PLAT', 'PT950', '925').
4. Extract center diamond shape if indicated (e.g., 'PEAR', 'OV', 'RD', 'EM', 'RAD', 'CU').

Return ONLY a valid JSON object matching this exact structure:
{
  "hasTag": true or false,
  "centerCarats": number or null,
  "sideCarats": number or null,
  "sideCount": number or null,
  "metalPurity": string or null,
  "metalColor": "yellow" | "white" | "rose" | null,
  "centerShape": string or null,
  "diamondClarity": string or null,
  "diamondColor": string or null,
  "rawText": "full legible transcript of the tag" or null,
  "confidence": "high" | "medium" | "low"
}
If no legible jewelry tag/sticker is visible, return {"hasTag": false}.`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract OCR tag ground truth from this jewelry image."
            },
            {
              type: "image_url",
              image_url: {
                url: imageDataUrl,
                detail: "high"
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as JewelryTagData;
    if (!parsed || !parsed.hasTag) return null;

    return {
      hasTag: true,
      centerCarats: typeof parsed.centerCarats === "number" && parsed.centerCarats > 0 ? parsed.centerCarats : null,
      sideCarats: typeof parsed.sideCarats === "number" && parsed.sideCarats > 0 ? parsed.sideCarats : null,
      sideCount: typeof parsed.sideCount === "number" && parsed.sideCount > 0 ? parsed.sideCount : null,
      metalPurity: parsed.metalPurity || null,
      metalColor: parsed.metalColor || null,
      centerShape: parsed.centerShape || null,
      diamondClarity: parsed.diamondClarity || null,
      diamondColor: parsed.diamondColor || null,
      rawText: parsed.rawText || null,
      confidence: parsed.confidence || "high"
    };
  } catch (error) {
    console.warn("[tag-ocr] Tag OCR pass failed:", error);
    return null;
  }
}
