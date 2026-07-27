import { resolveRuntimeSetting } from "@/lib/app-settings";
import { DEFAULT_PRICING_PROFILE, type PricingProfileInput } from "@/lib/pricing";

const METALS_DEV_BASE_URL = "https://api.metals.dev/v1";

type MetalsDevLatestResponse = {
  status?: string;
  currency?: string;
  unit?: string;
  timestamp?: string;
  metals?: {
    gold?: number;
    platinum?: number;
    silver?: number;
  };
  error_message?: string;
};

export type ResolvedMetalPricing = {
  pricingProfile: PricingProfileInput;
  source: "metals.dev" | "configured-default";
  message: string;
  timestamp?: string;
};

export function normalizePricingProfile(
  profile?: Partial<PricingProfileInput> | null
): PricingProfileInput {
  return {
    ...DEFAULT_PRICING_PROFILE,
    ...(profile ?? {})
  };
}

async function buildMetalsDevUrl() {
  const baseUrl =
    (await resolveRuntimeSetting("METALS_DEV_BASE_URL", process.env.METALS_DEV_BASE_URL)) ||
    METALS_DEV_BASE_URL;
  const apiKey =
    (await resolveRuntimeSetting("METALS_DEV_API_KEY", process.env.METALS_DEV_API_KEY)) || null;
  const currency =
    (await resolveRuntimeSetting("METALS_DEV_CURRENCY", process.env.METALS_DEV_CURRENCY)) || "USD";
  const unit =
    (await resolveRuntimeSetting("METALS_DEV_UNIT", process.env.METALS_DEV_UNIT)) || "toz";

  if (!apiKey) {
    return null;
  }

  const url = new URL(`${baseUrl.replace(/\/$/, "")}/latest`);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("currency", currency);
  url.searchParams.set("unit", unit);

  return url;
}

export async function resolveMetalPricing(
  pricingProfile?: Partial<PricingProfileInput> | null
): Promise<ResolvedMetalPricing> {
  const configuredProfile = normalizePricingProfile(pricingProfile);
  const url = await buildMetalsDevUrl();

  if (!url) {
    return {
      pricingProfile: configuredProfile,
      source: "configured-default",
      message: "Live metal pricing is disabled because METALS_DEV_API_KEY is not set."
    };
  }

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Metals.dev request failed with status ${response.status}.`);
    }

    const payload = (await response.json()) as MetalsDevLatestResponse;
    if (payload.status !== "success" || !payload.metals) {
      throw new Error(payload.error_message || "Unexpected response from Metals.dev.");
    }

    const liveProfile: PricingProfileInput = {
      ...configuredProfile,
      goldSpotPerOz: payload.metals.gold ?? configuredProfile.goldSpotPerOz,
      platinumSpotPerOz: payload.metals.platinum ?? configuredProfile.platinumSpotPerOz,
      silverSpotPerOz: payload.metals.silver ?? configuredProfile.silverSpotPerOz
    };

    return {
      pricingProfile: liveProfile,
      source: "metals.dev",
      timestamp: payload.timestamp,
      message: `Live market spot prices loaded from Metals.dev${payload.timestamp ? ` at ${payload.timestamp}` : "."}`
    };
  } catch (error) {
    return {
      pricingProfile: configuredProfile,
      source: "configured-default",
      message:
        error instanceof Error
          ? `Live metal pricing unavailable, using configured pricing instead: ${error.message}`
          : "Live metal pricing unavailable, using configured pricing instead."
    };
  }
}
