import type { PricingProfile } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveRuntimeSetting } from "@/lib/app-settings";
import { DEFAULT_PRICING_PROFILE, type PricingProfileInput } from "@/lib/pricing";

const METALS_DEV_BASE_URL = "https://api.metals.dev/v1";
const METALPRICE_API_BASE_URL = "https://api.metalpriceapi.com/v1";
const TORONTO_TIME_ZONE = "America/Toronto";
const TORONTO_DAILY_REFRESH_HOUR = 9;
const LIVE_PRICING_CACHE_KEY = "METALS_LIVE_PRICING_CACHE_V1";

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

type MetalpriceApiLatestResponse = {
  success?: boolean;
  timestamp?: number | string;
  base?: string;
  date?: string;
  rates?: Record<string, number | string | null | undefined>;
  error_message?: string;
  error?: {
    message?: string;
  };
};

type LivePricingSource = "metals.dev" | "metalpriceapi" | "configured-default";

export type ResolvedMetalPricing = {
  pricingProfile: PricingProfileInput;
  source: LivePricingSource;
  message: string;
  timestamp?: string;
};

type CachedLivePricing = {
  fetchedAt: string;
  torontoDate: string;
  pricingProfile: Pick<
    PricingProfileInput,
    "goldSpotPerOz" | "platinumSpotPerOz" | "silverSpotPerOz"
  >;
  provider?: Exclude<LivePricingSource, "configured-default">;
  timestamp?: string;
  message?: string;
};

export function normalizePricingProfile(
  profile?: Partial<PricingProfileInput> | null
): PricingProfileInput {
  return {
    ...DEFAULT_PRICING_PROFILE,
    ...(profile ?? {})
  };
}

export function toPricingProfileInput(profile?: Partial<PricingProfile> | null): PricingProfileInput {
  if (!profile) {
    return normalizePricingProfile();
  }

  return normalizePricingProfile({
    goldSpotPerOz: Number(profile.goldSpotPerOz),
    platinumSpotPerOz: Number(profile.platinumSpotPerOz),
    silverSpotPerOz: Number(profile.silverSpotPerOz),
    cadCharge: Number(profile.cadCharge),
    centerSettingPerCarat: Number(profile.centerSettingPerCarat),
    sideSettingPerStone: Number(profile.sideSettingPerStone),
    sellingMarginDivisor: Number(profile.sellingMarginDivisor),
    finalMultiplier: Number(profile.finalMultiplier)
  });
}

function getTorontoDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TORONTO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function getTorontoHour(date = new Date()) {
  const hour = new Intl.DateTimeFormat("en-CA", {
    timeZone: TORONTO_TIME_ZONE,
    hour: "2-digit",
    hour12: false
  }).format(date);

  return Number(hour);
}

function shouldRefreshLivePricing(cache: CachedLivePricing | null, now = new Date()) {
  if (!cache) {
    return true;
  }

  const torontoDate = getTorontoDateKey(now);
  if (cache.torontoDate === torontoDate) {
    return false;
  }

  return getTorontoHour(now) >= TORONTO_DAILY_REFRESH_HOUR;
}

async function readCachedLivePricing() {
  const record = await prisma.appSetting.findUnique({
    where: { key: LIVE_PRICING_CACHE_KEY }
  });

  if (!record?.value) {
    return null;
  }

  try {
    const parsed = JSON.parse(record.value) as CachedLivePricing;
    if (!parsed.torontoDate || !parsed.fetchedAt || !parsed.pricingProfile) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function storeCachedLivePricing(cache: CachedLivePricing) {
  await prisma.appSetting.upsert({
    where: { key: LIVE_PRICING_CACHE_KEY },
    create: {
      key: LIVE_PRICING_CACHE_KEY,
      value: JSON.stringify(cache)
    },
    update: {
      value: JSON.stringify(cache)
    }
  });
}

function buildCachedLivePricingResult(
  configuredProfile: PricingProfileInput,
  cachedPricing: CachedLivePricing,
  message?: string
): ResolvedMetalPricing {
  return {
    pricingProfile: {
      ...configuredProfile,
      ...cachedPricing.pricingProfile
    },
    source: cachedPricing.provider ?? "metals.dev",
    timestamp: cachedPricing.timestamp,
    message:
      message ||
      cachedPricing.message ||
      `Live market spot prices loaded from the Toronto 9:00 AM cache${cachedPricing.timestamp ? ` at ${cachedPricing.timestamp}` : "."}`
  };
}

async function buildMetalsDevUrl() {
  const baseUrl =
    (await resolveRuntimeSetting("METALS_DEV_BASE_URL", process.env.METALS_DEV_BASE_URL)) ||
    METALS_DEV_BASE_URL;
  const rawKey =
    (await resolveRuntimeSetting("METALS_DEV_API_KEY", process.env.METALS_DEV_API_KEY)) || null;
  const apiKey = rawKey ? rawKey.replace(/^['"]|['"]$/g, "").trim() : null;
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

async function buildMetalpriceApiUrl() {
  const baseUrl =
    (await resolveRuntimeSetting("METALPRICE_API_BASE_URL", process.env.METALPRICE_API_BASE_URL)) ||
    METALPRICE_API_BASE_URL;
  const apiKey =
    (await resolveRuntimeSetting("METALPRICE_API_KEY", process.env.METALPRICE_API_KEY)) || null;

  if (!apiKey) {
    return null;
  }

  const url = new URL(`${baseUrl.replace(/\/$/, "")}/latest`);
  url.searchParams.set("api_key", apiKey.trim());
  url.searchParams.set("base", "USD");
  url.searchParams.set("currencies", "XAU,XAG,XPT");

  return url;
}

function extractMetalpriceRate(
  rates: Record<string, number | string | null | undefined> | undefined,
  symbol: string
): number | null {
  if (!rates) {
    return null;
  }

  const exact = rates[symbol];
  if (exact !== undefined && exact !== null) {
    const numeric = Number(exact);
    // MetalpriceAPI with `base=USD` returns rates as "how many oz of metal
    // equal 1 USD" — i.e. the inverse of USD/oz. Invert to get $/oz before
    // returning; otherwise we'd store ~0.00043 for gold and every quote
    // would round down to $0.00.
    if (Number.isFinite(numeric) && numeric > 0) {
      return 1 / numeric;
    }
  }

  const matchingKey = Object.keys(rates).find(
    (key) => key.toUpperCase() === symbol || key.toUpperCase().includes(symbol)
  );
  if (!matchingKey) {
    return null;
  }

  const numeric = Number(rates[matchingKey]);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return 1 / numeric;
}

function normalizeLiveTimestamp(timestamp?: number | string, date?: string) {
  if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
    return new Date(timestamp * 1000).toISOString();
  }

  if (typeof timestamp === "string" && timestamp.trim()) {
    return timestamp.trim();
  }

  return date?.trim() || undefined;
}

async function resolveMetalpriceApiPricing(
  configuredProfile: PricingProfileInput
): Promise<ResolvedMetalPricing> {
  const url = await buildMetalpriceApiUrl();
  if (!url) {
    return {
      pricingProfile: configuredProfile,
      source: "configured-default",
      message: "Live metal pricing is disabled because METALPRICE_API_KEY is not set."
    };
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AzzureAutoQuote/2.0"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as MetalpriceApiLatestResponse | null;
    const detail = errorBody?.error_message || errorBody?.error?.message;
    throw new Error(`MetalpriceAPI request failed with status ${response.status}.${detail ? ` (${detail})` : ""}`);
  }

  const payload = (await response.json()) as MetalpriceApiLatestResponse;
  if (payload.success === false) {
    throw new Error(payload.error_message || payload.error?.message || "Unexpected response from MetalpriceAPI.");
  }

  const rates = payload.rates ?? {};
  const gold = extractMetalpriceRate(rates, "XAU");
  const platinum = extractMetalpriceRate(rates, "XPT");
  const silver = extractMetalpriceRate(rates, "XAG");

  if (gold === null && platinum === null && silver === null) {
    throw new Error("Unexpected response from MetalpriceAPI.");
  }

  const liveProfile: PricingProfileInput = {
    ...configuredProfile,
    goldSpotPerOz: gold ?? configuredProfile.goldSpotPerOz,
    platinumSpotPerOz: platinum ?? configuredProfile.platinumSpotPerOz,
    silverSpotPerOz: silver ?? configuredProfile.silverSpotPerOz
  };
  const timestamp = normalizeLiveTimestamp(payload.timestamp, payload.date);

  await storeCachedLivePricing({
    fetchedAt: new Date().toISOString(),
    torontoDate: getTorontoDateKey(),
    provider: "metalpriceapi",
    pricingProfile: {
      goldSpotPerOz: liveProfile.goldSpotPerOz,
      platinumSpotPerOz: liveProfile.platinumSpotPerOz,
      silverSpotPerOz: liveProfile.silverSpotPerOz
    },
    timestamp,
    message: `Live market spot prices loaded from MetalpriceAPI${timestamp ? ` at ${timestamp}` : "."}`
  });

  return {
    pricingProfile: liveProfile,
    source: "metalpriceapi",
    timestamp,
    message: `Live market spot prices loaded from MetalpriceAPI${timestamp ? ` at ${timestamp}` : "."}`
  };
}

// Global promise to prevent thundering herd API requests when Next.js prefetches multiple pages concurrently
let pendingLivePricingPromise: Promise<ResolvedMetalPricing> | null = null;

export async function resolveMetalPricing(
  pricingProfile?: Partial<PricingProfileInput> | null
): Promise<ResolvedMetalPricing> {
  if (pendingLivePricingPromise) {
    return pendingLivePricingPromise;
  }

  const promise = doResolveMetalPricing(pricingProfile).finally(() => {
    pendingLivePricingPromise = null;
  });

  pendingLivePricingPromise = promise;
  return promise;
}

async function doResolveMetalPricing(
  pricingProfile?: Partial<PricingProfileInput> | null
): Promise<ResolvedMetalPricing> {
  const masterKeys = {
    goldSpotPerOz: "master_gold_per_oz",
    platinumSpotPerOz: "master_platinum_per_oz",
    platinumLaborPct: "master_platinum_labor_pct",
    silverSpotPerOz: "master_silver_per_oz",
    goldWastagePct: "master_gold_wastage_pct",
    standardCenterDiamondPerCarat: "master_center_diamond_per_ct",
    fancyCenterDiamondPerCarat: "master_fancy_center_diamond_per_ct",
    roundSideDiamondPerCarat: "master_round_side_diamond_per_ct",
    fancySideDiamondPerCarat: "master_fancy_side_diamond_per_ct",
    centerSettingPerCarat: "master_center_setting_per_ct",
    roundSideSettingPerStone: "master_round_side_setting_per_stone",
    fancySideSettingPerStone: "master_fancy_side_setting_per_stone",
    waxPerPiece: "master_wax_per_piece",
    polishingPerPiece: "master_polishing_per_piece"
  } as const;
  const masterEntries = await Promise.all(
    Object.entries(masterKeys).map(async ([profileKey, settingKey]) => {
      const value = await resolveRuntimeSetting(settingKey);
      const parsed = value === null ? Number.NaN : Number(value);
      return [profileKey, Number.isFinite(parsed) ? parsed : undefined] as const;
    })
  );
  const masterProfile = Object.fromEntries(masterEntries.filter(([, value]) => value !== undefined));
  // Company values are legacy fallbacks. Explicit Master Pricing values override them.
  // Live/cache metal spot values are applied later and have the highest precedence.
  const configuredProfile = normalizePricingProfile({ ...(pricingProfile ?? {}), ...masterProfile });
  const metalsDevUrl = await buildMetalsDevUrl();
  const metalpriceApiUrl = await buildMetalpriceApiUrl();
  const now = new Date();
  const cachedPricing = await readCachedLivePricing();

  if (metalsDevUrl && cachedPricing && !shouldRefreshLivePricing(cachedPricing, now)) {
    return buildCachedLivePricingResult(configuredProfile, cachedPricing);
  }

  try {
    if (!metalsDevUrl) {
      throw new Error("METALS_DEV_API_KEY is not set.");
    }

    const response = await fetch(metalsDevUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AzzureAutoQuote/2.0"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null) as MetalsDevLatestResponse | null;
      const detail = errorBody?.error_message ? ` (${errorBody.error_message})` : "";
      throw new Error(`Metals.dev request failed with status ${response.status}.${detail}`);
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

    await storeCachedLivePricing({
      fetchedAt: now.toISOString(),
      torontoDate: getTorontoDateKey(now),
      provider: "metals.dev",
      pricingProfile: {
        goldSpotPerOz: liveProfile.goldSpotPerOz,
        platinumSpotPerOz: liveProfile.platinumSpotPerOz,
        silverSpotPerOz: liveProfile.silverSpotPerOz
      },
      timestamp: payload.timestamp,
      message: `Live market spot prices loaded from Metals.dev${payload.timestamp ? ` at ${payload.timestamp}` : "."}`
    });

    return {
      pricingProfile: liveProfile,
      source: "metals.dev",
      timestamp: payload.timestamp,
      message: `Live market spot prices loaded from Metals.dev${payload.timestamp ? ` at ${payload.timestamp}` : "."}`
    };
  } catch (error) {
    console.warn("Primary live metal pricing provider failed:", error);

    if (metalpriceApiUrl) {
      try {
        return await resolveMetalpriceApiPricing(configuredProfile);
      } catch (backupError) {
        console.warn("Backup live metal pricing provider failed:", backupError);
      }
    }

    if (cachedPricing) {
      return buildCachedLivePricingResult(
        configuredProfile,
        cachedPricing,
        `Live metal pricing is temporarily unavailable. Showing the most recent live prices${cachedPricing.timestamp ? ` from ${cachedPricing.timestamp}` : ""}.`
      );
    }

    return {
      pricingProfile: configuredProfile,
      source: "configured-default",
      message:
        "Live metal pricing is temporarily unavailable. Using Master Pricing instead."
    };
  }
}
