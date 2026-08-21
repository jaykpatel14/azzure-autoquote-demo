import { NextResponse } from "next/server";
import { getCustomKingApiConfig, dispatchCustomKingOrder } from "@/lib/customking-api";
import { requireInternalAdminContext } from "@/lib/internal-admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireInternalAdminContext();
    const config = getCustomKingApiConfig();

    return NextResponse.json({
      status: "ready",
      config: {
        apiUrl: config.apiUrl,
        apiKeyMasked: config.apiKey ? `${config.apiKey.slice(0, 7)}...${config.apiKey.slice(-4)}` : "Not set",
        sandboxMode: config.sandbox
      },
      instructions: "Send a POST request to this endpoint to test CustomKing order dispatching."
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 401 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireInternalAdminContext();
    const body = (await request.json().catch(() => ({}))) as Record<string, any>;

    const result = await dispatchCustomKingOrder({
      companyId: body.companyId || "test-company",
      orderId: body.orderId || "ord_test_123",
      orderNumber: body.orderNumber || "OR-000099",
      itemName: body.itemName || "2.5ct Pear Engagement Ring",
      quoteNumber: body.quoteNumber || "AQ-000099",
      metalType: body.metalType || "14K",
      metalWeightGrams: body.metalWeightGrams || 6.5,
      centerDiamondCarats: body.centerDiamondCarats || 2.5,
      sideDiamondCarats: body.sideDiamondCarats || 0.75,
      customerNotes: body.customerNotes || "Test order dispatch from Azzure AI Quote",
      renderingImageUrl: body.renderingImageUrl || null
    });

    return NextResponse.json({
      ok: true,
      result
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "CustomKing API test failed." },
      { status: 400 }
    );
  }
}
