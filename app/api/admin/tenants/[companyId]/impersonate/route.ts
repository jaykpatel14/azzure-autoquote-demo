import { NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit";
import { setActiveCompanyCookie } from "@/lib/company";
import { requireInternalAdminContext, InternalAdminAccessError } from "@/lib/internal-admin";
import { prisma } from "@/lib/prisma";
import { buildPublicUrl } from "@/lib/security";

export const runtime = "nodejs";

const paramsSchema = z.object({
  companyId: z.string().cuid()
});

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await requireInternalAdminContext();
    const parsedParams = paramsSchema.safeParse(await context.params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: "Invalid company id." }, { status: 400 });
    }

    const company = await prisma.company.findUnique({
      where: { id: parsedParams.data.companyId },
      select: { id: true, name: true }
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }

    await setActiveCompanyCookie(company.id);
    await logAuditEvent({
      action: "COMPANY_SWITCHED",
      companyId: company.id,
      actorUserId: admin.user.id,
      targetType: "Company",
      targetId: company.id,
      metadata: { fromAdminConsole: true, supportContext: true }
    }).catch(() => undefined);

    return NextResponse.redirect(buildPublicUrl("/"), 303);
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to switch company context." },
      { status: 400 }
    );
  }
}
