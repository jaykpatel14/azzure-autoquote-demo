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
  customerMarginPct: z.coerce.number().min(0, "Margin cannot be negative").max(200, "Margin cannot exceed 200%")
});

async function parseInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return schema.parse(await request.json());
  }

  const formData = await request.formData();
  return schema.parse({
    customerMarginPct: formData.get("customerMarginPct")
  });
}

export async function POST(request: Request) {
  try {
    const context = await requireCompanyContext();
    if (!canManageBilling(context.membership?.role ?? "CUSTOMER")) {
      throw new CompanyAccessError("You do not have permission to update pricing margin settings.");
    }

    const input = await parseInput(request);

    await prisma.company.update({
      where: { id: context.company.id },
      data: {
        customerMarginPct: input.customerMarginPct
      }
    });

    await logAuditEvent({
      action: "COMPANY_UPDATED",
      companyId: context.company.id,
      actorUserId: context.user.id,
      targetType: "Company",
      targetId: context.company.id,
      metadata: {
        customerMarginPct: input.customerMarginPct
      }
    }).catch(() => undefined);

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return NextResponse.json({
        ok: true,
        customerMarginPct: input.customerMarginPct
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
        { error: error.issues[0]?.message || "Invalid margin percentage. Must be between 0% and 200%." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update margin settings." },
      { status: 400 }
    );
  }
}
