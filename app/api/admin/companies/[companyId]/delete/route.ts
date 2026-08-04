import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternalAdminContext, InternalAdminAccessError } from "@/lib/internal-admin";
import { prisma } from "@/lib/prisma";
import { getRequestBaseUrl } from "@/lib/security";

export const runtime = "nodejs";

const schema = z.object({
  confirmName: z.string().trim().min(1, "Company name confirmation is required."),
  redirectTo: z.string().optional()
});

async function parseInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return schema.parse(await request.json());
  }

  const formData = await request.formData();
  return schema.parse({
    confirmName: String(formData.get("confirmName") || ""),
    redirectTo: String(formData.get("redirectTo") || "")
  });
}

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    await requireInternalAdminContext();
    const { companyId } = await context.params;
    const input = await parseInput(request);

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true }
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }

    if (company.name.trim() !== input.confirmName.trim()) {
      return NextResponse.json(
        { error: "Confirmation name does not match the company name." },
        { status: 400 }
      );
    }

    await prisma.company.delete({
      where: { id: companyId }
    });

    const redirectTo = input.redirectTo?.trim() || "/admin/companies";
    return NextResponse.redirect(new URL(redirectTo, getRequestBaseUrl(request)), 303);
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid delete payload." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete company." },
      { status: 400 }
    );
  }
}
