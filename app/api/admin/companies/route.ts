import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminCompanyWithMember } from "@/lib/admin-companies";
import { requireInternalAdminContext, InternalAdminAccessError } from "@/lib/internal-admin";
import { prisma } from "@/lib/prisma";
import { buildPublicUrl } from "@/lib/security";

export const runtime = "nodejs";

const schema = z.object({
  companyName: z.string().trim().min(1, "Company name is required."),
  companySlug: z.string().optional(),
  currency: z.enum(["USD", "CAD"]).optional(),
  memberEmail: z.string().trim().email("A valid email address is required."),
  memberName: z.string().optional(),
  memberPassword: z.string().optional(),
  pricingTier: z.enum(["TIER_1", "TIER_2", "TIER_3"]).optional(),
  planCode: z.enum(["starter", "professional", "enterprise"]).optional(),
  accountStatus: z.enum(["APPROVED", "PENDING_APPROVAL", "SUSPENDED"]).optional(),
  subscriptionStatus: z.enum(["ACTIVE", "TRIALING"]).optional(),
  redirectTo: z.string().optional()
});

async function parseInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return schema.parse(await request.json());
  }

  const formData = await request.formData();
  return schema.parse({
    companyName: String(formData.get("companyName") || ""),
    companySlug: String(formData.get("companySlug") || ""),
    currency: (formData.get("currency") as "USD" | "CAD") || undefined,
    memberEmail: String(formData.get("memberEmail") || ""),
    memberName: String(formData.get("memberName") || ""),
    memberPassword: String(formData.get("memberPassword") || ""),
    pricingTier: (formData.get("pricingTier") as "TIER_1" | "TIER_2" | "TIER_3") || undefined,
    planCode: (formData.get("planCode") as "starter" | "professional" | "enterprise") || undefined,
    accountStatus: (formData.get("accountStatus") as "APPROVED" | "PENDING_APPROVAL" | "SUSPENDED") || undefined,
    subscriptionStatus: (formData.get("subscriptionStatus") as "ACTIVE" | "TRIALING") || undefined,
    redirectTo: String(formData.get("redirectTo") || "")
  });
}

export async function POST(request: Request) {
  try {
    const admin = await requireInternalAdminContext();
    const input = await parseInput(request);

    const result = await prisma.$transaction(async (client) => {
      return createAdminCompanyWithMember(client, admin.user.id, {
        companyName: input.companyName,
        companySlug: input.companySlug,
        currency: input.currency,
        email: input.memberEmail,
        name: input.memberName,
        password: input.memberPassword,
        pricingTier: input.pricingTier,
        planCode: input.planCode,
        accountStatus: input.accountStatus,
        subscriptionStatus: input.subscriptionStatus
      });
    });

    const redirectTo = input.redirectTo?.trim() || `/admin/companies/${result.company.id}`;
    return NextResponse.redirect(buildPublicUrl(redirectTo), 303);
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid company payload." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create company." },
      { status: 400 }
    );
  }
}
