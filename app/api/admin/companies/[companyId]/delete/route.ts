import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireInternalAdminContext, InternalAdminAccessError } from "@/lib/internal-admin";

export const runtime = "nodejs";

const paramsSchema = z.object({
  companyId: z.string().cuid()
});

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    await requireInternalAdminContext();
    const parsed = paramsSchema.safeParse(await context.params);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid company id." }, { status: 400 });
    }

    const company = await prisma.company.findUnique({
      where: { id: parsed.data.companyId },
      select: { id: true, name: true, slug: true }
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }

    await prisma.company.delete({
      where: { id: company.id }
    });

    return NextResponse.json({
      deleted: true,
      companyId: company.id,
      companyName: company.name,
      companySlug: company.slug
    });
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
