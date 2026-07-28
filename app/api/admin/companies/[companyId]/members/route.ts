import { MembershipRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { addAdminCompanyMember } from "@/lib/admin-companies";
import { requireInternalAdminContext, InternalAdminAccessError } from "@/lib/internal-admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email("A valid email address is required."),
  name: z.string().optional(),
  password: z.string().optional(),
  role: z.nativeEnum(MembershipRole).default(MembershipRole.ESTIMATOR),
  redirectTo: z.string().optional()
});

async function parseInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return schema.parse(await request.json());
  }

  const formData = await request.formData();
  return schema.parse({
    email: String(formData.get("email") || ""),
    name: String(formData.get("name") || ""),
    password: String(formData.get("password") || ""),
    role: String(formData.get("role") || MembershipRole.ESTIMATOR),
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
    const admin = await requireInternalAdminContext();
    const { companyId } = await context.params;
    const input = await parseInput(request);

    await prisma.$transaction(async (client) => {
      await addAdminCompanyMember(client, admin.user.id, companyId, {
        email: input.email,
        name: input.name,
        password: input.password,
        role: input.role
      });
    });

    const redirectTo = input.redirectTo?.trim() || `/admin/companies/${companyId}`;
    return NextResponse.redirect(new URL(redirectTo, request.url), 303);
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid member payload." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to add company member." },
      { status: 400 }
    );
  }
}
