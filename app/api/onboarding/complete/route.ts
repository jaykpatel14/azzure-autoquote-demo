import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCompanyContext } from "@/lib/company";
import { prisma } from "@/lib/prisma";

const onboardingSchema = z.object({
  companyName: z.string().trim().min(2).max(120).optional(),
  websiteUrl: z.string().trim().url().optional().or(z.literal("")),
  aboutUs: z.string().trim().max(4000).optional().or(z.literal("")),
  logoUrl: z.string().trim().url().optional().or(z.literal("")),
  action: z.enum(["save", "finish"]).default("save"),
  next: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const context = await requireCompanyContext();
    const formData = await request.formData();
    const input = onboardingSchema.parse({
      companyName: String(formData.get("companyName") ?? ""),
      websiteUrl: String(formData.get("websiteUrl") ?? ""),
      aboutUs: String(formData.get("aboutUs") ?? ""),
      logoUrl: String(formData.get("logoUrl") ?? ""),
      action: String(formData.get("action") ?? "save"),
      next: String(formData.get("next") ?? "")
    });

    await prisma.company.update({
      where: { id: context.company.id },
      data: {
        name: input.companyName || context.company.name,
        websiteUrl: input.websiteUrl || null,
        aboutUs: input.aboutUs || null,
        logoUrl: input.logoUrl || null
      }
    });

    if (input.action === "finish") {
      await prisma.subscription.update({
        where: { companyId: context.company.id },
        data: {
          onboardingComplete: true,
          pendingPlanActiveAt: context.company.subscription?.currentPeriodEnd ?? new Date()
        }
      });
    }

    const destination =
      input.next && input.next.startsWith("/")
        ? input.next
        : input.action === "finish"
          ? "/quotes/new"
          : "/onboarding";
    return NextResponse.redirect(new URL(destination, request.url), 303);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save onboarding." },
      { status: 400 }
    );
  }
}
