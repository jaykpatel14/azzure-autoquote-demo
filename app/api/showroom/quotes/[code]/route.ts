import { NextResponse } from "next/server";
import { requireCompanyContext, AuthRequiredError } from "@/lib/company";
import { normalizeShowroomCode } from "@/lib/showroom";
import { prisma } from "@/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ code: string }> }) {
  try { const context = await requireCompanyContext(); const code = normalizeShowroomCode((await params).code); if (!code) return NextResponse.json({ error: "Quote not found" }, { status: 404 }); const found = await prisma.showroomQuote.findUnique({ where: { companyId_displayCode: { companyId: context.company.id, displayCode: code } }, select: { id: true, quoteId: true, status: true } }); if (!found) return NextResponse.json({ error: "Quote not found" }, { status: 404 }); if (found.status === "PENDING") await prisma.showroomQuote.update({ where: { id: found.id }, data: { status: "CLAIMED", claimedAt: new Date(), claimedBy: context.user.id } }); return NextResponse.json({ quoteId: found.quoteId }); } catch (e) { if (e instanceof AuthRequiredError) return NextResponse.json({ error: e.message }, { status: 401 }); return NextResponse.json({ error: "Quote not found" }, { status: 404 }); }
}
