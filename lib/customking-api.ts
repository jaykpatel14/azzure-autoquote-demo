import { prisma } from "@/lib/prisma";

export type CustomKingOrderInput = {
  companyId: string;
  orderId: string;
  orderNumber: string;
  itemName: string;
  quoteNumber: string;
  metalType: string;
  metalWeightGrams: number;
  centerDiamondCarats: number;
  sideDiamondCarats: number;
  customerNotes?: string | null;
  renderingImageUrl?: string | null;
};

export type CustomKingOrderResult = {
  success: boolean;
  ckOrderId: string;
  ckOrderUrl: string;
  status: string;
  mode: "live" | "staging" | "sandbox";
  message: string;
  data?: any;
};

export function isCustomKingSandboxMode(): boolean {
  // Only fallback to mock Sandbox if explicitly requested via CUSTOMKING_SANDBOX_MODE=true
  // or if no CUSTOMKING_API_URL is configured.
  if (process.env.CUSTOMKING_SANDBOX_MODE === "true") return true;
  if (!process.env.CUSTOMKING_API_URL || !process.env.CUSTOMKING_API_URL.trim()) return true;
  return false;
}

export function getCustomKingApiConfig() {
  const apiUrl = process.env.CUSTOMKING_API_URL?.trim() || "https://cknyc-api.azzuresolutions.com/api/v1";
  const apiKey = (process.env.CUSTOMKING_API_KEY || "").replace(/^['"]|['"]$/g, "").trim();
  const sandbox = isCustomKingSandboxMode();

  return { apiUrl, apiKey, sandbox };
}

/**
 * Dispatches an order to the CustomKing Staging or Live manufacturing API.
 */
export async function dispatchCustomKingOrder(input: CustomKingOrderInput): Promise<CustomKingOrderResult> {
  const { apiUrl, apiKey, sandbox } = getCustomKingApiConfig();

  // ── Mock Sandbox Fallback Mode (Only if no API URL configured or explicitly forced) ──
  if (sandbox) {
    const mockCkId = `CK-TEST-${Math.floor(10000 + Math.random() * 90000)}`;
    const mockUrl = `${apiUrl.replace(/\/api\/v1\/?$/, "")}/orders/${mockCkId}`;

    return {
      success: true,
      ckOrderId: mockCkId,
      ckOrderUrl: mockUrl,
      status: "CK_ORDER_PLACED",
      mode: "sandbox",
      message: "Order dispatched to CustomKing Mock Sandbox Mode."
    };
  }

  // ── Actual HTTP API Call to CustomKing Staging / Live Server ──
  try {
    const isStaging = apiUrl.includes("staging") || apiUrl.includes("dev") || apiUrl.includes("localhost");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "AzzureAutoQuote/2.0"
    };

    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
      headers["X-API-Key"] = apiKey;
    }

    const endpoint = apiUrl.endsWith("/orders") ? apiUrl : `${apiUrl.replace(/\/$/, "")}/orders`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        externalOrderId: input.orderId,
        orderNumber: input.orderNumber,
        itemName: input.itemName,
        quoteNumber: input.quoteNumber,
        metalType: input.metalType,
        metalWeightGrams: input.metalWeightGrams,
        centerDiamondCarats: input.centerDiamondCarats,
        sideDiamondCarats: input.sideDiamondCarats,
        notes: input.customerNotes,
        renderingImageUrl: input.renderingImageUrl,
        specifications: {
          metalType: input.metalType,
          metalWeightGrams: input.metalWeightGrams,
          centerDiamondCarats: input.centerDiamondCarats,
          sideDiamondCarats: input.sideDiamondCarats,
          notes: input.customerNotes
        }
      })
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, any>;

    if (!response.ok) {
      throw new Error(payload.error || payload.message || `CustomKing Staging API returned error ${response.status}`);
    }

    const ckId = payload.ckOrderId || payload.orderId || payload.id || `CK-${input.orderNumber}`;
    const ckUrl = payload.ckOrderUrl || payload.url || `${apiUrl.replace(/\/api.*$/, "")}/orders/${ckId}`;

    return {
      success: true,
      ckOrderId: String(ckId),
      ckOrderUrl: String(ckUrl),
      status: "CK_ORDER_PLACED",
      mode: isStaging ? "staging" : "live",
      message: `Order successfully dispatched to CustomKing ${isStaging ? "Staging" : "Live"} API.`,
      data: payload
    };
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Failed to communicate with CustomKing Staging API."
    );
  }
}
