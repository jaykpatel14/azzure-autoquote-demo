import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageBilling, requireCompanyContext } from "@/lib/company";
import { logAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { getCompanyPlanFeatures } from "@/src/stripe/plans";

export const runtime = "nodejs";

const schema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional().or(z.literal("")),
  aboutUs: z.string().trim().max(300).optional().or(z.literal("")),
  overlayColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  overlayOpacity: z.number().int().min(0).max(90),
  textColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  backgroundFit: z.enum(["cover", "contain"]),
  backgroundPosition: z.enum(["center", "top", "bottom", "left", "right"]),
  panelOpacity: z.number().int().min(0).max(90)
});

export async function POST(request: Request) {
  try {
    const context = await requireCompanyContext();
    if (!canManageBilling(context.membership?.role ?? "CUSTOMER")) {
      return NextResponse.json({ error: "You do not have permission to customize showroom settings." }, { status: 403 });
    }

    const { features } = await getCompanyPlanFeatures(context.company.id);
    if (!features.canUseShowroomMode) {
      return NextResponse.json({ error: "Showroom customization is available on the Enterprise plan." }, { status: 403 });
    }

    const input = schema.parse(await request.json());

    await prisma.company.update({
      where: { id: context.company.id },
      data: {
        primaryColor: input.primaryColor || null,
        aboutUs: input.aboutUs || null,
        showroomOverlayColor: input.overlayColor,
        showroomOverlayOpacity: input.overlayOpacity,
        showroomTextColor: input.textColor,
        showroomBackgroundFit: input.backgroundFit,
        showroomBackgroundPosition: input.backgroundPosition,
        showroomPanelOpacity: input.panelOpacity
      }
    });

    await logAuditEvent({
      action: "COMPANY_UPDATED",
      companyId: context.company.id,
      actorUserId: context.user.id,
      targetType: "Company",
      targetId: context.company.id,
      metadata: {
        showroomCustomized: true,
        primaryColor: input.primaryColor,
        appearanceControlsUpdated: true
      }
    }).catch(() => undefined);

    return NextResponse.json({ ok: true, primaryColor: input.primaryColor, aboutUs: input.aboutUs });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid payload." }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update showroom customization." },
      { status: 400 }
    );
  }
}
