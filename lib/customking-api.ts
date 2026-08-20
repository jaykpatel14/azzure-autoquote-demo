import { prisma } from "@/lib/prisma";

export type CustomKingSpecs = {
  purchaseOrderNo?: string | null;
  jobName?: string | null;
  productType?: string | null;
  metalType?: string | null;
  size?: string | null;
  qty?: number | null;
  polishLevel?: string | null;
  matchingBand?: boolean | null;
  deliveryDate?: string | null;
  customerEmail?: string | null;
  engraveMessage?: string | null;
  fontfamily?: string | null;
  centerStoneType?: string | null;
  centerStoneOrigin?: string | null;
  centerStoneShape?: string | null;
  centerStoneCarat?: number | null;
  centerStoneColor?: string | null;
  centerStoneClarity?: string | null;
  centerStoneProvider?: string | null;
  sideStoneCarat?: number | null;
  sideStoneQuantity?: number | null;
  sideStoneShape?: string | null;
  sideStonePlacement?: string | null;
  sideStoneProvider?: string | null;
  stoneSettingType?: string | null;
  stoneSettingDescription?: string | null;
};

export type CustomKingOrderInput = {
  companyId: string;
  companyName?: string | null;
  companySlug?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
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
  specs?: CustomKingSpecs | null;
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

    const endpoint = apiUrl.includes("/integration/orders")
      ? apiUrl.replace(/\/+$/, "")
      : apiUrl.endsWith("/api/v1")
        ? `${apiUrl.replace(/\/+$/, "")}/integration/orders`
        : apiUrl.endsWith("/orders")
          ? apiUrl.replace(/\/+$/, "")
          : `${apiUrl.replace(/\/+$/, "")}/integration/orders`;

    const specs = input.specs || {};

    const centerCarat = specs.centerStoneCarat ?? input.centerDiamondCarats ?? 0;
    const sideCarat = specs.sideStoneCarat ?? input.sideDiamondCarats ?? 0;

    const stoneDetails = [];
    if (centerCarat > 0) {
      stoneDetails.push({
        stoneType: specs.centerStoneType || "DIAMOND",
        isNatural: specs.centerStoneOrigin || "LAB_GROWN",
        shape: (specs.centerStoneShape || "ROUND").toUpperCase(),
        carat: Number(centerCarat),
        quantity: 1,
        color: specs.centerStoneColor || "F",
        clarity: specs.centerStoneClarity || "VS1",
        placement: "CENTER",
        provider: specs.centerStoneProvider || "CK_SUPPLIED"
      });
    }
    if (sideCarat > 0) {
      stoneDetails.push({
        stoneType: "DIAMOND",
        isNatural: "LAB_GROWN",
        shape: (specs.sideStoneShape || "ROUND").toUpperCase(),
        carat: Number(sideCarat),
        quantity: specs.sideStoneQuantity ?? 1,
        color: "F",
        clarity: "VS1",
        placement: (specs.sideStonePlacement || "SIDE").toUpperCase(),
        provider: specs.sideStoneProvider || "CK_SUPPLIED"
      });
    }

    const rawMetal = specs.metalType || input.metalType;
    const normalizedMetal = rawMetal.includes("Gold") || rawMetal.includes("Platinum") || rawMetal.includes("Silver")
      ? rawMetal
      : `${rawMetal} Gold`;

    const payloadBody: Record<string, any> = {
      purchaseOrderNo: specs.purchaseOrderNo || input.orderNumber,
      jobName: specs.jobName || input.itemName || `Quote ${input.quoteNumber}`,
      productType: specs.productType || "Ring",
      metalType: normalizedMetal,
      size: specs.size || "6.5",
      qty: specs.qty ?? 1,
      polishLevel: specs.polishLevel || "HIGH_POLISH",
      matchingBand: specs.matchingBand ?? false,
      stoneSettingType: (specs.stoneSettingType || "PRONG").toUpperCase(),
      stoneSettingDescription: specs.stoneSettingDescription || "4-prong claw setting",
      stoneDetails,
      note: input.customerNotes || `AutoQuote Quote: ${input.quoteNumber} | Store: ${input.companyName || input.companyId}`,
      customerEmail: specs.customerEmail || input.customerEmail || "cknyc-customer@azzuresolutions.com",
      companyName: input.companyName,
      storeName: input.companyName,
      externalOrderId: input.orderId,
      quoteNumber: input.quoteNumber
    };

    if (specs.deliveryDate) {
      payloadBody.deliveryDate = specs.deliveryDate;
    }
    if (specs.engraveMessage) {
      payloadBody.engraveMessage = specs.engraveMessage;
      payloadBody.fontfamily = specs.fontfamily || "Script";
    }

    if (input.renderingImageUrl) {
      payloadBody.images = [input.renderingImageUrl];
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payloadBody)
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, any>;

    if (!response.ok) {
      throw new Error(payload.message || payload.error || `CustomKing Staging API returned error ${response.status}`);
    }

    const responseData = payload.data || payload;
    const ckId = responseData.orderCode || responseData.customOrderId || responseData.orderId || responseData.ckOrderId || `CK-${input.orderNumber}`;
    const ckUrl = responseData.ckOrderUrl || responseData.url || `${apiUrl.replace(/\/api.*$/, "")}/cad-orders`;

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
