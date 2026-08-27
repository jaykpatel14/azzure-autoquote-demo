import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const GemstoneRateSchema = z.object({
  stone: z.string(),
  displayName: z.string(),
  commercialLowPerCt: z.number(),
  commercialHighPerCt: z.number(),
  fineLowPerCt: z.number(),
  fineHighPerCt: z.number(),
  premiumLowPerCt: z.number(),
  premiumHighPerCt: z.number(),
  sources: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type GemstoneRate = {
  id: string;
  stone: string;
  displayName: string;
  commercialLowPerCt: number;
  commercialHighPerCt: number;
  fineLowPerCt: number;
  fineHighPerCt: number;
  premiumLowPerCt: number;
  premiumHighPerCt: number;
  sources: string | null;
  refreshedAt: Date;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type GemstoneRateSummary = {
  id: string;
  stone: string;
  displayName: string;
  commercial: { low: number; high: number };
  fine: { low: number; high: number };
  premium: { low: number; high: number };
  sources: string | null;
  refreshedAt: Date;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  isActive: boolean;
};

export async function getAllGemstoneRates(): Promise<GemstoneRateSummary[]> {
  const rows = await prisma.gemstoneRate.findMany({
    orderBy: { stone: "asc" }
  });
  return rows.map((row) => ({
    id: row.id,
    stone: row.stone,
    displayName: row.displayName,
    commercial: { low: Number(row.commercialLowPerCt), high: Number(row.commercialHighPerCt) },
    fine: { low: Number(row.fineLowPerCt), high: Number(row.fineHighPerCt) },
    premium: { low: Number(row.premiumLowPerCt), high: Number(row.premiumHighPerCt) },
    sources: row.sources,
    refreshedAt: row.refreshedAt,
    reviewedAt: row.reviewedAt,
    reviewedBy: row.reviewedBy,
    isActive: row.isActive
  }));
}

export async function updateGemstoneRate(
  id: string,
  data: Partial<{
    displayName: string;
    commercialLowPerCt: number;
    commercialHighPerCt: number;
    fineLowPerCt: number;
    fineHighPerCt: number;
    premiumLowPerCt: number;
    premiumHighPerCt: number;
    sources: string;
    isActive: boolean;
  }>
): Promise<GemstoneRate> {
  const updated = await prisma.gemstoneRate.update({
    where: { id },
    data
  });
  return {
    ...updated,
    commercialLowPerCt: Number(updated.commercialLowPerCt),
    commercialHighPerCt: Number(updated.commercialHighPerCt),
    fineLowPerCt: Number(updated.fineLowPerCt),
    fineHighPerCt: Number(updated.fineHighPerCt),
    premiumLowPerCt: Number(updated.premiumLowPerCt),
    premiumHighPerCt: Number(updated.premiumHighPerCt)
  };
}

export async function markGemstoneRateAsReviewed(
  id: string,
  reviewedBy: string
): Promise<GemstoneRate> {
  const updated = await prisma.gemstoneRate.update({
    where: { id },
    data: {
      reviewedAt: new Date(),
      reviewedBy
    }
  });
  return {
    ...updated,
    commercialLowPerCt: Number(updated.commercialLowPerCt),
    commercialHighPerCt: Number(updated.commercialHighPerCt),
    fineLowPerCt: Number(updated.fineLowPerCt),
    fineHighPerCt: Number(updated.fineHighPerCt),
    premiumLowPerCt: Number(updated.premiumLowPerCt),
    premiumHighPerCt: Number(updated.premiumHighPerCt)
  };
}