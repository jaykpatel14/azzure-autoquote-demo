import { NextResponse, type NextRequest } from "next/server";
import { fetchAIWebJewelryFacts, FALLBACK_JEWELRY_FACTS } from "@/lib/ai/jewelry-facts-service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const forceFresh = searchParams.get("fresh") === "true";

    const facts = await fetchAIWebJewelryFacts(forceFresh);
    return NextResponse.json({ facts, success: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch jewelry facts:", error);
    return NextResponse.json(
      { facts: FALLBACK_JEWELRY_FACTS, success: true, fallback: true },
      { status: 200 }
    );
  }
}
