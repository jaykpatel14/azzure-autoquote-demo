import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canManageBilling, requireCompanyContext, AuthRequiredError } from "@/lib/company";
import { assertPlanFeature, PlanError } from "@/src/stripe/plans";

export async function POST() {
  try {
    const context = await requireCompanyContext();
    if (!canManageBilling(context.membership.role)) return NextResponse.json({ error: "You do not have permission to manage showroom mode." }, { status: 403 });
    await assertPlanFeature(context.company.id, "canUseShowroomMode");
    const token = randomBytes(24).toString("base64url");
    const session = await prisma.showroomSession.upsert({
      where: { companyId: context.company.id },
      create: { companyId: context.company.id, token },
      update: { token, isActive: true, createdAt: new Date(), lastUsedAt: new Date() }
    });
    return NextResponse.json({ token: session.token });
  } catch (error) {
    if (error instanceof AuthRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof PlanError) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ error: "Unable to activate showroom mode." }, { status: 400 });
  }
}

export async function DELETE() {
  try {
    const context = await requireCompanyContext();
    if (!canManageBilling(context.membership.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await prisma.showroomSession.updateMany({ where: { companyId: context.company.id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: "Unable to revoke showroom mode." }, { status: 400 }); }
}
