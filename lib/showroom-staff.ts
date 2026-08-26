import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { checkRateLimit, clearRateLimitState } from "@/lib/rate-limit";
import { normalizeShowroomCode } from "@/lib/showroom";

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

  return showroomQuotes.map((sq) => {
    const rawPrice = sq.quote.estimatedSellingPrice ?? sq.quote.estimatedPrice;
    const priceNum = rawPrice ? Number(rawPrice) : 0;
    const renderUrl = sq.quote.renderingDataUrl || sq.quote.analysis?.renderingDataUrl || sq.quote.analysis?.imageDataUrl || null;

    return {
      id: sq.id,
      displayCode: sq.displayCode,
      estimatedSellingPrice: priceNum,
      metalType: sq.quote.metalType,
      jewelryType: sq.quote.analysis?.jewelryType || "Ring",
      createdAt: sq.createdAt,
      status: sq.status,
      renderingImageUrl: renderUrl
    };
  });
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
          analysis: true
        }
      }
    }
  });

  if (!showroomQuote) return null;

  const q = showroomQuote.quote;
  const analysis = q.analysis;
  const rawPrice = q.estimatedSellingPrice ?? q.estimatedPrice;
  const priceNum = rawPrice ? Number(rawPrice) : 0;
  const uploadedImageUrl = analysis?.imageDataUrl || null;
  const renderingImageUrl = q.renderingDataUrl || analysis?.renderingDataUrl || null;

  return {
    id: showroomQuote.id,
    quoteId: q.id,
    displayCode: showroomQuote.displayCode,
    status: showroomQuote.status,
    createdAt: showroomQuote.createdAt,
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
          analysis: true
        }
      }
    }
  });

  if (!showroomQuote) return null;

  const quoteId = showroomQuote.quoteId;

  // Update Quote record
  const quoteData: any = {};
  if (updates.customerName !== undefined) quoteData.customerName = updates.customerName || null;
  if (updates.customerEmail !== undefined) quoteData.customerEmail = updates.customerEmail || null;
  if (updates.customerPhone !== undefined) quoteData.customerPhone = updates.customerPhone || null;
  if (updates.metalType !== undefined) quoteData.metalType = updates.metalType;
  if (updates.metalWeightGrams !== undefined) quoteData.metalWeightGrams = updates.metalWeightGrams;
  if (updates.centerCarats !== undefined) quoteData.centerDiamondCarats = updates.centerCarats;
  if (updates.sideCarats !== undefined) quoteData.sideDiamondCarats = updates.sideCarats;
  if (updates.sideDiamondQuantity !== undefined) quoteData.sideDiamondQuantity = updates.sideDiamondQuantity;
  if (updates.centerClarity !== undefined) quoteData.colorClarity = updates.centerClarity;
  if (updates.estimatedPrice !== undefined) {
    quoteData.estimatedPrice = updates.estimatedPrice;
    quoteData.estimatedSellingPrice = updates.estimatedPrice;
  }
  if (updates.customerNotes !== undefined) quoteData.notes = updates.customerNotes || null;

  await prisma.quote.update({
    where: { id: quoteId },
    data: quoteData
  });

  // Update Analysis if centerShape or settingType changed
  if (showroomQuote.quote.analysisId && (updates.centerShape !== undefined || updates.settingType !== undefined)) {
    await prisma.aiAnalysis.update({
      where: { id: showroomQuote.quote.analysisId },
      data: {
        ...(updates.centerShape !== undefined ? { centerShape: updates.centerShape } : {}),
        ...(updates.settingType !== undefined ? { settingType: updates.settingType } : {})
      }
    }).catch(() => null);
  }

  // Update ShowroomQuote record
  const showroomData: any = {};
  if (updates.customerNotes !== undefined) showroomData.customerNotes = updates.customerNotes || null;
  if (updates.jewelerNotes !== undefined) showroomData.jewelerNotes = updates.jewelerNotes || null;
  if (updates.status !== undefined) showroomData.status = updates.status;

  await prisma.showroomQuote.update({
    where: { id: showroomQuote.id },
    data: showroomData
  });

  return getStaffQuoteDetail(companyId, normalizedCode);
}
