import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageBilling, requireCompanyContext } from "@/lib/company";
import { logAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { buildPublicUrl } from "@/lib/security";
import { getCompanyPlanFeatures } from "@/src/stripe/plans";
import { deleteShowroomBackgroundFromS3, storeShowroomBackgroundInS3 } from "@/lib/quote-pdf-s3";

export const runtime = "nodejs";

const schema = z.object({
  companyName: z.string().trim().min(2).max(120),
  aboutUs: z.string().trim().max(300).optional().or(z.literal("")),
  websiteUrl: z.string().trim().url().optional().or(z.literal("")),
  logoUrl: z.string().trim().optional().or(z.literal("")),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional().or(z.literal("")),
  showroomBackgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional().or(z.literal(""))
});

async function parseInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return { input: schema.parse(await request.json()), backgroundMedia: null, removeBackgroundMedia: false };
  }

  const formData = await request.formData();
  const input = schema.parse({
    companyName: String(formData.get("companyName") || ""),
    aboutUs: String(formData.get("aboutUs") || ""),
    websiteUrl: String(formData.get("websiteUrl") || ""),
    logoUrl: String(formData.get("logoUrl") || ""),
    primaryColor: String(formData.get("primaryColor") || ""),
    showroomBackgroundColor: String(formData.get("showroomBackgroundColor") || "")
  });
  const candidate = formData.get("backgroundMedia");
  return {
    input,
    backgroundMedia: candidate instanceof File && candidate.size > 0 ? candidate : null,
    removeBackgroundMedia: formData.get("removeBackgroundMedia") === "true"
  };
}

export async function POST(request: Request) {
  try {
    const context = await requireCompanyContext();
    if (!canManageBilling(context.membership?.role ?? "CUSTOMER")) {
      return NextResponse.json({ error: "You do not have permission to manage branding." }, { status: 403 });
    }

    const { input, backgroundMedia, removeBackgroundMedia } = await parseInput(request);
    const { features } = await getCompanyPlanFeatures(context.company.id);
    const canUseLogo = features.pdfBranding !== "azzure_watermark";

    if (input.logoUrl && !canUseLogo) {
      return NextResponse.json(
        { error: "Upload your logo on the Professional or Enterprise plan." },
        { status: 403 }
      );
    }

    const allowedMediaTypes = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]);
    if (backgroundMedia && (!allowedMediaTypes.has(backgroundMedia.type) || backgroundMedia.size > 50 * 1024 * 1024)) {
      return NextResponse.json({ error: "Background media must be JPG, PNG, WEBP, MP4, or WEBM and no larger than 50 MB." }, { status: 400 });
    }

    let mediaKey = context.company.showroomBackgroundMediaKey;
    let mediaType = context.company.showroomBackgroundMediaType;
    if (backgroundMedia) {
      const extension = backgroundMedia.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
      const key = `showroom/${context.company.id}/background-${crypto.randomUUID()}.${extension}`;
      const stored = await storeShowroomBackgroundInS3({ key, buffer: Buffer.from(await backgroundMedia.arrayBuffer()), contentType: backgroundMedia.type });
      mediaKey = stored.key;
      mediaType = backgroundMedia.type;
    } else if (removeBackgroundMedia) {
      mediaKey = null;
      mediaType = null;
    }

    await prisma.company.update({
      where: { id: context.company.id },
      data: {
        name: input.companyName,
        aboutUs: input.aboutUs || null,
        websiteUrl: input.websiteUrl || null,
        logoUrl: input.logoUrl || null,
        primaryColor: input.primaryColor || null,
        showroomBackgroundColor: input.showroomBackgroundColor || null,
        showroomBackgroundMediaKey: mediaKey,
        showroomBackgroundMediaType: mediaType
      }
    });

    if ((backgroundMedia || removeBackgroundMedia) && context.company.showroomBackgroundMediaKey && context.company.showroomBackgroundMediaKey !== mediaKey) {
      await deleteShowroomBackgroundFromS3(context.company.showroomBackgroundMediaKey).catch(() => null);
    }

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

    return NextResponse.redirect(buildPublicUrl("/settings/branding?updated=1"), 303);
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
