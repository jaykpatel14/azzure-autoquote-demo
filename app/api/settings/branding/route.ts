import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageBilling, requireCompanyContext } from "@/lib/company";
import { logAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const schema = z.object({
  companyName: z.string().trim().min(2).max(120),
  aboutUs: z.string().trim().max(300).optional().or(z.literal("")),
  websiteUrl: z.string().trim().url().optional().or(z.literal("")),
  logoUrl: z.string().trim().url().optional().or(z.literal(""))
});

async function parseInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return schema.parse(await request.json());
  }

  const formData = await request.formData();
  return schema.parse({
    companyName: String(formData.get("companyName") || ""),
    aboutUs: String(formData.get("aboutUs") || ""),
    websiteUrl: String(formData.get("websiteUrl") || ""),
    logoUrl: String(formData.get("logoUrl") || "")
  });
}

export async function POST(request: Request) {
  try {
    const context = await requireCompanyContext();
    if (!canManageBilling(context.membership?.role ?? "CUSTOMER")) {
      return NextResponse.json({ error: "You do not have permission to manage branding." }, { status: 403 });
    }

    const input = await parseInput(request);
    const isEnterprise = context.company.subscription?.plan.code === "enterprise";

    if (input.logoUrl && !isEnterprise) {
      return NextResponse.json(
        { error: "Upload your logo on the Enterprise plan." },
        { status: 403 }
      );
    }

    await prisma.company.update({
      where: { id: context.company.id },
      data: {
        name: input.companyName,
        aboutUs: input.aboutUs || null,
        websiteUrl: input.websiteUrl || null,
        logoUrl: input.logoUrl || null
      }
    });

    await logAuditEvent({
      action: "COMPANY_UPDATED",
      companyId: context.company.id,
      actorUserId: context.user.id,
      targetType: "Company",
      targetId: context.company.id,
      metadata: {
        brandingUpdated: true
      }
    }).catch(() => undefined);

    return NextResponse.redirect(new URL("/settings/branding?updated=1", request.url), 303);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid branding payload." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update branding." },
      { status: 400 }
    );
  }
}
