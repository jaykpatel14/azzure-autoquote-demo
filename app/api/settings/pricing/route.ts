import { NextResponse } from "next/server";
import { z } from "zod";
import {
  requireCompanyContext,
  AuthRequiredError,
  CompanyAccessError,
  canManageBilling
} from "@/lib/company";
import { logAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { buildPublicUrl } from "@/lib/security";

export const runtime = "nodejs";

const schema = z.object({
  customerMarginPct: z.coerce.number().min(50, "Margin must be at least 50%").max(500, "Margin cannot exceed 500%").optional(),
  goldSpotPerOz: z.coerce.number().positive("Gold spot price must be positive").optional(),
  platinumSpotPerOz: z.coerce.number().positive("Platinum spot price must be positive").optional(),
  silverSpotPerOz: z.coerce.number().positive("Silver spot price must be positive").optional()
});

async function parseInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return schema.parse(await request.json());
  }

  const formData = await request.formData();
  return schema.parse({
    customerMarginPct: formData.get("customerMarginPct") || undefined,
    goldSpotPerOz: formData.get("goldSpotPerOz") || undefined,
    platinumSpotPerOz: formData.get("platinumSpotPerOz") || undefined,
    silverSpotPerOz: formData.get("silverSpotPerOz") || undefined
  });
}

import { assertPlanFeature, PlanError } from "@/src/stripe/plans";

export async function POST(request: Request) {
  try {
    const context = await requireCompanyContext();
    if (!canManageBilling(context.membership?.role ?? "CUSTOMER")) {
      throw new CompanyAccessError("You do not have permission to update pricing margin settings.");
    }

    try {
      await assertPlanFeature(context.company.id, "canUseCustomPricingProfile");
    } catch (e) {
      if (e instanceof PlanError) {
        return NextResponse.json(
          { error: "Custom markup configuration is available on Professional and Enterprise plans." },
          { status: 403 }
        );
      }
      throw e;
    }

    const input = await parseInput(request);

    if (input.customerMarginPct !== undefined) {
      await prisma.company.update({
        where: { id: context.company.id },
        data: {
          customerMarginPct: input.customerMarginPct
        }
      });
    }

    if (
      input.goldSpotPerOz !== undefined ||
      input.platinumSpotPerOz !== undefined ||
      input.silverSpotPerOz !== undefined
    ) {
      await prisma.pricingProfile.upsert({
        where: { companyId: context.company.id },
        create: {
          companyId: context.company.id,
          goldSpotPerOz: input.goldSpotPerOz ?? 4500,
          platinumSpotPerOz: input.platinumSpotPerOz ?? 985.2,
          silverSpotPerOz: input.silverSpotPerOz ?? 31.4
        },
        update: {
          ...(input.goldSpotPerOz !== undefined ? { goldSpotPerOz: input.goldSpotPerOz } : {}),
          ...(input.platinumSpotPerOz !== undefined ? { platinumSpotPerOz: input.platinumSpotPerOz } : {}),
          ...(input.silverSpotPerOz !== undefined ? { silverSpotPerOz: input.silverSpotPerOz } : {})
        }
      });
    }

    await logAuditEvent({
      action: "COMPANY_UPDATED",
      companyId: context.company.id,
      actorUserId: context.user.id,
      targetType: "Company",
      targetId: context.company.id,
      metadata: {
        customerMarginPct: input.customerMarginPct,
        goldSpotPerOz: input.goldSpotPerOz,
        platinumSpotPerOz: input.platinumSpotPerOz,
        silverSpotPerOz: input.silverSpotPerOz
      }
    }).catch(() => undefined);

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return NextResponse.json({
        ok: true,
        customerMarginPct: input.customerMarginPct,
        goldSpotPerOz: input.goldSpotPerOz,
        platinumSpotPerOz: input.platinumSpotPerOz,
        silverSpotPerOz: input.silverSpotPerOz
      });
    }

    return NextResponse.redirect(buildPublicUrl("/settings/pricing?updated=1"), 303);
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof CompanyAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid margin percentage. Must be between 50% and 200%." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update margin settings." },
      { status: 400 }
    );
  }
}
