import { SubscriptionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { updateAdminCompanyBilling } from "@/lib/admin-companies";
import { requireInternalAdminContext, InternalAdminAccessError } from "@/lib/internal-admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const schema = z.object({
  companyName: z.string().trim().min(1, "Company name is required."),
  companySlug: z.string().optional(),
  logoUrl: z.string().optional(),
  quoteSequence: z.coerce.number().int().min(0),
  planId: z.string().optional(),
  subscriptionStatus: z.nativeEnum(SubscriptionStatus),
  stripeCustomerId: z.string().optional(),
  stripeSubscriptionId: z.string().optional(),
  stripeProductId: z.string().optional(),
  stripePriceId: z.string().optional(),
  cancelAtPeriodEnd: z.coerce.boolean().optional(),
  overageEnabled: z.coerce.boolean().optional(),
  overagePriceCents: z.coerce.number().int().min(0).optional(),
  currentPeriodStart: z.string().min(1),
  currentPeriodEnd: z.string().min(1),
  redirectTo: z.string().optional()
});

function toBoolean(value: FormDataEntryValue | null) {
  const normalized = String(value || "").toLowerCase();
  return normalized === "on" || normalized === "true" || normalized === "1";
}

async function parseInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return schema.parse(await request.json());
  }

  const formData = await request.formData();
  return schema.parse({
    companyName: String(formData.get("companyName") || ""),
    companySlug: String(formData.get("companySlug") || ""),
    logoUrl: String(formData.get("logoUrl") || ""),
    quoteSequence: String(formData.get("quoteSequence") || "0"),
    planId: String(formData.get("planId") || ""),
    subscriptionStatus: String(formData.get("subscriptionStatus") || SubscriptionStatus.TRIALING),
    stripeCustomerId: String(formData.get("stripeCustomerId") || ""),
    stripeSubscriptionId: String(formData.get("stripeSubscriptionId") || ""),
    stripeProductId: String(formData.get("stripeProductId") || ""),
    stripePriceId: String(formData.get("stripePriceId") || ""),
    cancelAtPeriodEnd: toBoolean(formData.get("cancelAtPeriodEnd")),
    overageEnabled: toBoolean(formData.get("overageEnabled")),
    overagePriceCents: String(formData.get("overagePriceCents") || "") || undefined,
    currentPeriodStart: String(formData.get("currentPeriodStart") || ""),
    currentPeriodEnd: String(formData.get("currentPeriodEnd") || ""),
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
      await updateAdminCompanyBilling(client, admin.user.id, companyId, {
        companyName: input.companyName,
        companySlug: input.companySlug,
        logoUrl: input.logoUrl,
        quoteSequence: input.quoteSequence,
        subscription: {
          planId: input.planId,
          status: input.subscriptionStatus,
          stripeCustomerId: input.stripeCustomerId,
          stripeSubscriptionId: input.stripeSubscriptionId,
          stripeProductId: input.stripeProductId,
          stripePriceId: input.stripePriceId,
          cancelAtPeriodEnd: Boolean(input.cancelAtPeriodEnd),
          overageEnabled: Boolean(input.overageEnabled),
          overagePriceCents: input.overagePriceCents ?? null,
          currentPeriodStart: new Date(input.currentPeriodStart),
          currentPeriodEnd: new Date(input.currentPeriodEnd)
        }
      });
    });

    const redirectTo = input.redirectTo?.trim() || `/admin/billing/${companyId}`;
    return NextResponse.redirect(new URL(redirectTo, request.url), 303);
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid billing payload." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update billing." },
      { status: 400 }
    );
  }
}
