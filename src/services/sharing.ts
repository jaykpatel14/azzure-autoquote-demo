import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { assertPlanFeature } from "@/src/stripe/plans";
import { ConflictError, NotFoundError, type AppResult } from "@/src/lib/errors";

export async function createShareLink(params: { companyId: string; quoteId: string }): Promise<AppResult<{ token: string }>> {
  await assertPlanFeature(params.companyId, "canShareQuoteLink");
  const company = await prisma.company.findUnique({ where: { id: params.companyId }, select: { accountStatus: true, pricingTier: true } });
  if (!company || company.accountStatus !== "APPROVED" || !company.pricingTier) {
    return { error: ConflictError("Account approval and a pricing tier are required to share quotes.") };
  }
  const quote = await prisma.quote.findFirst({ where: { id: params.quoteId, companyId: params.companyId }, select: { id: true, pdfStoredAt: true, publicShareToken: true } });
  if (!quote) return { error: NotFoundError("Quote") };
  if (!quote.pdfStoredAt) return { error: ConflictError("Generate the final PDF before sharing this quote.") };
  if (quote.publicShareToken) return { data: { token: quote.publicShareToken } };
  const token = randomBytes(24).toString("base64url");
  await prisma.quote.update({ where: { id: quote.id }, data: { publicShareToken: token, sharedAt: new Date() } });
  return { data: { token } };
}
