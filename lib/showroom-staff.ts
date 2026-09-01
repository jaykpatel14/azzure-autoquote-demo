import { randomUUID } from "node:crypto";
import type { Prisma, PricingTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { checkRateLimit, clearRateLimitState } from "@/lib/rate-limit";
import { normalizeShowroomCode } from "@/lib/showroom";
import { resolveMetalPricing, normalizePricingProfile, toPricingProfileInput } from "@/lib/metal-pricing";
import { calculateMakingPrice, calculateTierPrice, DEFAULT_COLOR_CLARITY } from "@/src/services/pricing";
import { getSettingValue } from "@/lib/app-settings";
import { getCompanyPlanFeatures } from "@/src/stripe/plans";
import {
  loadAnalysisImageDataUrlFromS3,
  loadQuoteRenderingDataUrlFromS3
} from "@/lib/quote-pdf-s3";

const WEAK_PINS = new Set([
  "0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999",
  "0123", "1234", "2345", "3456", "4567", "5678", "6789",
  "9876", "8765", "7654", "6543", "5432", "4321", "3210"
]);

export function validatePinFormat(pin: string): { valid: boolean; error?: string; warning?: string } {
  const trimmed = pin.trim();
  if (!/^\d{4}$/.test(trimmed)) {
    return { valid: false, error: "PIN must be exactly 4 digits (0-9)." };
  }

  if (WEAK_PINS.has(trimmed)) {
    return {
      valid: true,
      warning: "This PIN is very common (sequential or repeated digits). We recommend choosing a stronger PIN."
    };
  }

  return { valid: true };
}

export function hashKioskPin(pin: string): string {
  return hashPassword(pin);
}

export function verifyKioskPin(pin: string, hash: string): boolean {
  return verifyPassword(pin, hash);
}

async function resolveAnalysisImageUrl(params: {
  storageKey: string | null;
  dataUrl: string | null;
  mimeType?: string | null;
}) {
  if (params.storageKey) {
    const url = await loadAnalysisImageDataUrlFromS3({
      key: params.storageKey,
      mimeType: params.mimeType || "image/jpeg"
    });
    if (url) {
      return url;
    }
  }

  return params.dataUrl || null;
}

async function resolveRenderingImageUrl(params: {
  storageKey: string | null;
  dataUrl: string | null;
}) {
  if (params.storageKey) {
    const url = await loadQuoteRenderingDataUrlFromS3(params.storageKey);
    if (url) {
      return url;
    }
  }

  return params.dataUrl || null;
}

export async function setUserKioskPin(userId: string, pin: string) {
  const validation = validatePinFormat(pin);
  if (!validation.valid) {
    throw new Error(validation.error || "Invalid PIN format.");
  }

  const kioskPinHash = hashKioskPin(pin.trim());
  await prisma.user.update({
    where: { id: userId },
    data: { kioskPinHash }
  });

  return { ok: true, warning: validation.warning };
}

export async function clearUserKioskPin(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { kioskPinHash: null }
  });
  return { ok: true };
}

export async function verifyKioskStaffPin(showroomToken: string, pin: string, clientIp = "unknown") {
  const session = await prisma.showroomSession.findUnique({
    where: { token: showroomToken, isActive: true },
    select: { id: true, companyId: true }
  });

  if (!session) {
    return { ok: false as const, error: "Invalid showroom token", status: 401 as const };
  }

  const rateLimitKey = `pin_attempts:${session.companyId}:${clientIp}`;
  const rateCheck = checkRateLimit({
    key: rateLimitKey,
    limit: 3,
    windowMs: 5 * 60 * 1000 // 5 minutes lock
  });

  if (!rateCheck.allowed) {
    return {
      ok: false as const,
      locked: true as const,
      unlocksAt: new Date(rateCheck.resetAt).toISOString(),
      status: 429 as const
    };
  }

  const users = await prisma.user.findMany({
    where: {
      memberships: { some: { companyId: session.companyId } },
      kioskPinHash: { not: null }
    },
    select: {
      id: true,
      name: true,
      email: true,
      kioskPinHash: true
    }
  });

  for (const user of users) {
    if (user.kioskPinHash && verifyKioskPin(pin, user.kioskPinHash)) {
      // Clear rate limit on successful authentication
      // Create short-lived staff session
      const sessionToken = `staff_${randomUUID().replace(/-/g, "")}`;
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
      const staffFirstName = (user.name || user.email).trim().split(" ")[0] || "Staff";

      await prisma.kioskStaffSession.create({
        data: {
          token: sessionToken,
          userId: user.id,
          companyId: session.companyId,
          staffName: staffFirstName,
          expiresAt
        }
      });

      return {
        ok: true as const,
        staffName: staffFirstName,
        staffId: user.id,
        sessionToken,
        status: 200 as const
      };
    }
  }

  const remaining = rateCheck.remaining;
  return {
    ok: false as const,
    attemptsRemaining: remaining,
    locked: remaining === 0,
    unlocksAt: remaining === 0 ? new Date(rateCheck.resetAt).toISOString() : undefined,
    status: 400 as const
  };
}

export async function validateStaffSession(sessionToken: string) {
  if (!sessionToken) return null;

  const staffSession = await prisma.kioskStaffSession.findUnique({
    where: { token: sessionToken }
  });

  if (!staffSession || staffSession.expiresAt <= new Date()) {
    if (staffSession) {
      prisma.kioskStaffSession.delete({ where: { id: staffSession.id } }).catch(() => undefined);
    }
    return null;
  }

  return staffSession;
}

export async function invalidateStaffSession(sessionToken: string) {
  if (!sessionToken) return { ok: true };
  await prisma.kioskStaffSession.deleteMany({
    where: { token: sessionToken }
  });
  return { ok: true };
}

export async function getStaffRecentQuotes(companyId: string) {
  const showroomQuotes = await prisma.showroomQuote.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: {
      quote: {
        include: {
          analysis: true
        }
      }
    }
  });

  return Promise.all(showroomQuotes.map(async (sq) => {
    const rawPrice = sq.quote.estimatedSellingPrice ?? sq.quote.estimatedPrice;
    const priceNum = rawPrice ? Number(rawPrice) : 0;
    return {
      id: sq.id,
      displayCode: sq.displayCode,
      estimatedSellingPrice: priceNum,
      metalType: sq.quote.metalType,
      jewelryType: sq.quote.analysis?.jewelryType || "Ring",
      createdAt: sq.createdAt,
      status: sq.status,
      renderingImageUrl: await resolveRenderingImageUrl({
        storageKey: sq.quote.renderingStorageKey || sq.quote.analysis?.renderingStorageKey || null,
        dataUrl: sq.quote.renderingDataUrl || sq.quote.analysis?.renderingDataUrl || null
      })
    };
  }));
}

export async function getStaffQuoteDetail(companyId: string, codeInput: string) {
  const normalizedCode = normalizeShowroomCode(codeInput);
  if (!normalizedCode) return null;

  const showroomQuote = await prisma.showroomQuote.findUnique({
    where: {
      companyId_displayCode: {
        companyId,
        displayCode: normalizedCode
      }
    },
    include: {
      quote: {
        include: {
          analysis: true,
          company: {
            select: {
              customerMarginPct: true,
              pricingProfile: true
            }
          }
        }
      }
    }
  });

  if (!showroomQuote) return null;

  const q = showroomQuote.quote;
  const analysis = q.analysis;
  const rawPrice = q.estimatedSellingPrice ?? q.estimatedPrice;
  const priceNum = rawPrice ? Number(rawPrice) : 0;
  const uploadedImageUrl = await resolveAnalysisImageUrl({
    storageKey: analysis?.sourceImageStorageKey || null,
    dataUrl: analysis?.imageDataUrl || null,
    mimeType: analysis?.sourceImageMimeType || null
  });
  const renderingImageUrl = await resolveRenderingImageUrl({
    storageKey: q.renderingStorageKey || analysis?.renderingStorageKey || null,
    dataUrl: q.renderingDataUrl || analysis?.renderingDataUrl || null
  });

  return {
    id: showroomQuote.id,
    quoteId: q.id,
    displayCode: showroomQuote.displayCode,
    status: showroomQuote.status,
    createdAt: showroomQuote.createdAt,
    pricingTierSnapshot: q.pricingTierSnapshot || null,
    tierDivisorSnapshot: q.tierDivisorSnapshot ? Number(q.tierDivisorSnapshot) : null,
    customerName: q.customerName || null,
    customerEmail: q.customerEmail || null,
    customerPhone: q.customerPhone || null,
    customerNotes: showroomQuote.customerNotes || q.notes || null,
    jewelerNotes: showroomQuote.jewelerNotes || null,
    estimatedPrice: priceNum,
    metalType: q.metalType,
    jewelryType: analysis?.jewelryType || "Ring",
    uploadedImageUrl,
    renderingImageUrl,
    pricingContext: {
      customerMarginPct: Number(q.company?.customerMarginPct ?? 0),
      pricingProfile: toPricingProfileInput(q.company?.pricingProfile ?? null)
    },
    specs: {
      metalType: q.metalType,
      metalWeightGrams: q.metalWeightGrams ? Number(q.metalWeightGrams) : null,
      centerCarats: q.centerDiamondCarats ? Number(q.centerDiamondCarats) : null,
      centerShape: analysis?.centerShape || "Round",
      centerClarity: q.colorClarity || "E VS1",
      sideCarats: q.sideDiamondCarats ? Number(q.sideDiamondCarats) : null,
      sideDiamondQuantity: q.sideDiamondQuantity ?? analysis?.sideDiamondQuantity ?? null,
      settingType: analysis?.settingType || "Prong"
    }
  };
}

export type StaffQuoteUpdateInput = {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  metalType?: string;
  metalWeightGrams?: number;
  centerCarats?: number;
  centerShape?: string;
  centerClarity?: string;
  sideCarats?: number;
  sideDiamondQuantity?: number;
  settingType?: string;
  estimatedPrice?: number;
  customerNotes?: string;
  jewelerNotes?: string;
  status?: "PENDING" | "CLAIMED" | "IN_REVIEW" | "COMPLETED" | "EXPIRED";
};

export async function updateStaffQuote(
  companyId: string,
  codeInput: string,
  updates: StaffQuoteUpdateInput
) {
  const normalizedCode = normalizeShowroomCode(codeInput);
  if (!normalizedCode) return null;

  const showroomQuote = await prisma.showroomQuote.findUnique({
    where: {
      companyId_displayCode: {
        companyId,
        displayCode: normalizedCode
      }
    },
    include: {
      quote: {
        include: {
          analysis: true,
          company: {
            include: {
              pricingProfile: true
            }
          }
        }
      }
    }
  });

  if (!showroomQuote) return null;

  const quote = showroomQuote.quote;
  const company = quote.company;
  const analysis = quote.analysis;
  const quoteId = quote.id;

  // Resolve updated specifications with fallbacks to current quote
  const resolvedCustomerName = updates.customerName !== undefined ? updates.customerName || null : quote.customerName;
  const resolvedCustomerEmail = updates.customerEmail !== undefined ? updates.customerEmail || null : quote.customerEmail;
  const resolvedCustomerPhone = updates.customerPhone !== undefined ? updates.customerPhone || null : quote.customerPhone;
  const resolvedMetalType = updates.metalType !== undefined ? updates.metalType : quote.metalType;
  const resolvedMetalWeightGrams = updates.metalWeightGrams !== undefined ? updates.metalWeightGrams : Number(quote.metalWeightGrams);
  const resolvedCenterCarats = updates.centerCarats !== undefined ? updates.centerCarats : Number(quote.centerDiamondCarats);
  const resolvedSideCarats = updates.sideCarats !== undefined ? updates.sideCarats : Number(quote.sideDiamondCarats);
  const resolvedSideDiamondQuantity = updates.sideDiamondQuantity !== undefined ? updates.sideDiamondQuantity : quote.sideDiamondQuantity;
  const resolvedCenterClarity = updates.centerClarity !== undefined ? updates.centerClarity : quote.colorClarity;
  const resolvedCenterShape = updates.centerShape !== undefined ? updates.centerShape : analysis?.centerShape || "Round";
  const resolvedSettingType = updates.settingType !== undefined ? updates.settingType : analysis?.settingType || "Prong";
  const resolvedNotes = updates.customerNotes !== undefined ? updates.customerNotes || null : quote.notes;

  // Resolve company plan features & live pricing profile
  const { features } = await getCompanyPlanFeatures(companyId);
  const baseProfile = company?.pricingProfile
    ? normalizePricingProfile({
        goldSpotPerOz: Number(company.pricingProfile.goldSpotPerOz),
        platinumSpotPerOz: Number(company.pricingProfile.platinumSpotPerOz),
        silverSpotPerOz: Number(company.pricingProfile.silverSpotPerOz),
        cadCharge: Number(company.pricingProfile.cadCharge),
        centerSettingPerCarat: Number(company.pricingProfile.centerSettingPerCarat),
        sideSettingPerStone: Number(company.pricingProfile.sideSettingPerStone),
        sellingMarginDivisor: Number(company.pricingProfile.sellingMarginDivisor),
        finalMultiplier: Number(company.pricingProfile.finalMultiplier)
      })
    : undefined;
  const livePricing = await resolveMetalPricing(features.canUseCustomPricingProfile ? baseProfile : null);

  const rawCadCost = await getSettingValue("cad_cost_per_quote");
  const cadCost = rawCadCost !== undefined && rawCadCost !== null && Number(rawCadCost) > 0
    ? Number(rawCadCost)
    : Number(livePricing.pricingProfile.cadCharge ?? 20);

  const customerMarginPct = Number(company?.customerMarginPct ?? 0);
  const pricingTier = (quote.pricingTierSnapshot as PricingTier) || company?.pricingTier || "TIER_2";

  const detectedSideShape = (resolvedCenterShape && ["emerald", "radiant", "cushion", "oval", "pear", "princess"].includes(resolvedCenterShape.toLowerCase()) && resolvedSideDiamondQuantity <= 4)
    ? "fancy"
    : "round";

  const sideStones = resolvedSideDiamondQuantity > 0 && resolvedSideCarats > 0
    ? [{
        shape: detectedSideShape,
        caratWeightEach: resolvedSideCarats / resolvedSideDiamondQuantity,
        count: resolvedSideDiamondQuantity,
        settingType: resolvedSettingType
      }]
    : [];

  const making = calculateMakingPrice({
    pricingProfile: livePricing.pricingProfile,
    metalType: resolvedMetalType,
    metalWeightGrams: resolvedMetalWeightGrams,
    goldSpotPerOz: Number(livePricing.pricingProfile.goldSpotPerOz),
    platinumSpotPerOz: Number(livePricing.pricingProfile.platinumSpotPerOz),
    silverSpotPerOz: Number(livePricing.pricingProfile.silverSpotPerOz),
    centerStone: {
      shape: (resolvedCenterShape && resolvedCenterShape.toLowerCase() !== "none") ? resolvedCenterShape : "Round",
      caratWeight: Math.max(resolvedCenterCarats, 0)
    },
    sideStones,
    hasWeddingBand: false,
    isTwoTone: false,
    colorClarity: resolvedCenterClarity,
    cadCost,
    pricingTier,
    customerMarginPct
  });

  const tier = calculateTierPrice(making.subtotal, pricingTier, customerMarginPct);
  const calculatedEstimatedPrice = tier.estimatedSellingPrice;
  const finalPrice = updates.estimatedPrice !== undefined && updates.estimatedPrice > 0
    ? updates.estimatedPrice
    : calculatedEstimatedPrice;

  // If manual price override was specified, update makingPriceBreakdown to match
  if (updates.estimatedPrice !== undefined && updates.estimatedPrice > 0) {
    making.estimatedSellingPrice = updates.estimatedPrice;
  }

  // Update Quote record with fresh specifications, recalculation, and breakdown
  await prisma.quote.update({
    where: { id: quoteId },
    data: {
      customerName: resolvedCustomerName,
      customerEmail: resolvedCustomerEmail,
      customerPhone: resolvedCustomerPhone,
      metalType: resolvedMetalType,
      metalWeightGrams: resolvedMetalWeightGrams,
      centerDiamondCarats: resolvedCenterCarats,
      sideDiamondCarats: resolvedSideCarats,
      sideDiamondQuantity: resolvedSideDiamondQuantity,
      colorClarity: resolvedCenterClarity,
      notes: resolvedNotes,
      estimatedPrice: finalPrice,
      estimatedSellingPrice: finalPrice,
      makingPrice: making.makingPrice,
      makingPriceBreakdown: making as unknown as Prisma.InputJsonValue,
      customerMarginPct: making.customerMarginPct,
      customerMarginAmount: making.customerMarginAmount,
      cadCost: making.cadCost,
      pricingTierSnapshot: tier.tier,
      tierDivisorSnapshot: tier.divisor
    }
  });

  // Update Analysis if attached
  if (quote.analysisId) {
    await prisma.aiAnalysis.update({
      where: { id: quote.analysisId },
      data: {
        selectedMetal: resolvedMetalType,
        metalWeightGrams: resolvedMetalWeightGrams,
        centerDiamondCarats: resolvedCenterCarats,
        sideDiamondCarats: resolvedSideCarats,
        sideDiamondQuantity: resolvedSideDiamondQuantity,
        centerShape: resolvedCenterShape,
        centerClarity: resolvedCenterClarity,
        settingType: resolvedSettingType
      }
    }).catch(() => null);
  }

  // Update ShowroomQuote record
  const showroomData: any = {};
  if (updates.customerNotes !== undefined) showroomData.customerNotes = updates.customerNotes || null;
  if (updates.jewelerNotes !== undefined) showroomData.jewelerNotes = updates.jewelerNotes || null;
  if (updates.status !== undefined) showroomData.status = updates.status;

  if (Object.keys(showroomData).length > 0) {
    await prisma.showroomQuote.update({
      where: { id: showroomQuote.id },
      data: showroomData
    });
  }

  // Regenerate stored PDF proposal in the background
  try {
    const { generateAndStoreQuotePdf } = await import("@/src/services/quote-pdf");
    await generateAndStoreQuotePdf({
      quoteId,
      companyId,
      customerNameFallback: resolvedCustomerName
    });
  } catch {
    // Non-fatal
  }

  return getStaffQuoteDetail(companyId, normalizedCode);
}
