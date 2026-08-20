import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireInternalAdminContext, InternalAdminAccessError } from "@/lib/internal-admin";
import { deleteAdminCompanyMember } from "@/lib/admin-companies";
import { getRequestBaseUrl } from "@/lib/security";

export const runtime = "nodejs";

const paramsSchema = z.object({
  companyId: z.string().min(1),
  userId: z.string().min(1)
});

type RouteContext = {
  params: Promise<{
    companyId: string;
    userId: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const admin = await requireInternalAdminContext();
    const parsed = paramsSchema.safeParse(await context.params);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid parameters." }, { status: 400 });
    }

    const result = await deleteAdminCompanyMember(
      prisma,
      admin.user.id,
      parsed.data.companyId,
      parsed.data.userId,
      true
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete member." },
      { status: 400 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await requireInternalAdminContext();
    const parsed = paramsSchema.safeParse(await context.params);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid parameters." }, { status: 400 });
    }

    await deleteAdminCompanyMember(
      prisma,
      admin.user.id,
      parsed.data.companyId,
      parsed.data.userId,
      true
    );

    if ((request.headers.get("content-type") || "").includes("application/json")) {
      return NextResponse.json({ success: true, deleted: true });
    }

    const formData = await request.formData().catch(() => new FormData());
    const requestedRedirect = String(formData.get("redirectTo") || "").trim();
    const redirectTo = requestedRedirect?.startsWith("/") && !requestedRedirect.startsWith("//")
      ? requestedRedirect
      : `/admin/companies/${parsed.data.companyId}`;

    return NextResponse.redirect(new URL(redirectTo, getRequestBaseUrl(request)), 303);
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete member." },
      { status: 400 }
    );
  }
}
