import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireInternalAdminContext, InternalAdminAccessError } from "@/lib/internal-admin";
import { deleteAdminCompany } from "@/lib/admin-companies";

export const runtime = "nodejs";

const paramsSchema = z.object({
  companyId: z.string().min(1)
});

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireInternalAdminContext();
    const parsed = paramsSchema.safeParse(await context.params);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid company id." }, { status: 400 });
    }

    const company = await prisma.company.findUnique({
      where: { id: parsed.data.companyId },
      include: {
        subscription: { include: { plan: true } },
        memberships: { include: { user: { select: { id: true, email: true, name: true } } } },
        _count: { select: { quotes: true, orders: true } }
      }
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }

    return NextResponse.json({ company });
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load company." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const admin = await requireInternalAdminContext();
    const parsed = paramsSchema.safeParse(await context.params);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid company id." }, { status: 400 });
    }

    const result = await deleteAdminCompany(prisma, admin.user.id, parsed.data.companyId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete company." },
      { status: 400 }
    );
  }
}
