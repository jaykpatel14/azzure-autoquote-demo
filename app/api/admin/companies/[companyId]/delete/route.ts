import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireInternalAdminContext, InternalAdminAccessError } from "@/lib/internal-admin";
import { getRequestBaseUrl } from "@/lib/security";

export const runtime = "nodejs";

const paramsSchema = z.object({
  companyId: z.string().min(1)
});

const inputSchema = z.object({
  confirmName: z.string().trim().min(1, "Company name confirmation is required."),
  redirectTo: z.string().optional()
});

async function parseInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return inputSchema.parse(await request.json());
  }

  const formData = await request.formData();
  return inputSchema.parse({
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
    const parsed = paramsSchema.safeParse(await context.params);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid company id." }, { status: 400 });
    }
    const input = await parseInput(request);

    const company = await prisma.company.findUnique({
      where: { id: parsed.data.companyId },
      select: { id: true, name: true, slug: true }
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }

    if (company.name.trim() !== input.confirmName) {
      return NextResponse.json(
        { error: "Confirmation name does not match the company name." },
        { status: 400 }
      );
    }

    await prisma.company.delete({
      where: { id: company.id }
    });

    if ((request.headers.get("content-type") || "").includes("application/json")) {
      return NextResponse.json({
        deleted: true,
        companyId: company.id,
        companyName: company.name,
        companySlug: company.slug
      });
    }

    const requestedRedirect = input.redirectTo?.trim();
    const redirectTo = requestedRedirect?.startsWith("/") && !requestedRedirect.startsWith("//")
      ? requestedRedirect
      : "/admin/companies";
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
