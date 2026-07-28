import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext, AuthRequiredError, CompanyAccessError } from "@/lib/company";
import { logAuditEvent } from "@/lib/audit";

export const runtime = "nodejs";

const schema = z.object({
  cadCharge: z.coerce.number().min(0),
  centerSettingPerCarat: z.coerce.number().min(0),
  sideSettingPerStone: z.coerce.number().min(0),
  sellingMarginDivisor: z.coerce.number().min(0.01),
  finalMultiplier: z.coerce.number().min(0),
  redirectTo: z.string().optional()
});

async function parseInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return schema.parse(await request.json());
  }

  const formData = await request.formData();
  return schema.parse({
    cadCharge: formData.get("cadCharge"),
    centerSettingPerCarat: formData.get("centerSettingPerCarat"),
    sideSettingPerStone: formData.get("sideSettingPerStone"),
    sellingMarginDivisor: formData.get("sellingMarginDivisor"),
    finalMultiplier: formData.get("finalMultiplier"),
    redirectTo: String(formData.get("redirectTo") || "")
  });
}

export async function POST(request: Request) {
  try {
    const context = await requireCompanyContext("ADMIN");
    const input = await parseInput(request);

    await prisma.pricingProfile.upsert({
      where: { companyId: context.company.id },
      create: {
        companyId: context.company.id,
        cadCharge: input.cadCharge,
        centerSettingPerCarat: input.centerSettingPerCarat,
        sideSettingPerStone: input.sideSettingPerStone,
        sellingMarginDivisor: input.sellingMarginDivisor,
        finalMultiplier: input.finalMultiplier
      },
      update: {
        cadCharge: input.cadCharge,
        centerSettingPerCarat: input.centerSettingPerCarat,
        sideSettingPerStone: input.sideSettingPerStone,
        sellingMarginDivisor: input.sellingMarginDivisor,
        finalMultiplier: input.finalMultiplier
      }
    });

    await logAuditEvent({
      action: "COMPANY_UPDATED",
      companyId: context.company.id,
      actorUserId: context.user.id,
      targetType: "PricingProfile",
      targetId: context.company.id,
      metadata: {
        cadCharge: input.cadCharge,
        centerSettingPerCarat: input.centerSettingPerCarat,
        sideSettingPerStone: input.sideSettingPerStone,
        sellingMarginDivisor: input.sellingMarginDivisor,
        finalMultiplier: input.finalMultiplier
      }
    });

    const redirectTo = input.redirectTo?.trim() || "/settings";
    return NextResponse.redirect(new URL(redirectTo, request.url), 303);
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof CompanyAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid pricing request." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update pricing." },
      { status: 400 }
    );
  }
}
