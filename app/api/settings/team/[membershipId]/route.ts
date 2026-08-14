import { NextResponse } from "next/server";
import { canManageTeam, requireCompanyContext } from "@/lib/company";
import { logAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    membershipId: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const companyContext = await requireCompanyContext();
    if (!canManageTeam(companyContext.membership?.role ?? "CUSTOMER")) {
      return NextResponse.json({ error: "You do not have permission to manage team members." }, { status: 403 });
    }

    const { membershipId } = await context.params;
    const membership = await prisma.membership.findUnique({
      where: { id: membershipId },
      include: {
        user: {
          select: { id: true, email: true }
        }
      }
    });

    if (!membership || membership.companyId !== companyContext.company.id) {
      return NextResponse.json({ error: "Membership not found." }, { status: 404 });
    }

    if (membership.role === "OWNER") {
      return NextResponse.json({ error: "You cannot remove the owner." }, { status: 409 });
    }

    await prisma.membership.delete({
      where: { id: membership.id }
    });

    await logAuditEvent({
      action: "ROLE_UPDATED",
      companyId: companyContext.company.id,
      actorUserId: companyContext.user.id,
      targetType: "Membership",
      targetId: membership.id,
      metadata: {
        removedEmail: membership.user.email
      }
    }).catch(() => undefined);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to remove member." },
      { status: 400 }
    );
  }
}
