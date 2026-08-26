import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageBilling, requireCompanyContext } from "@/lib/company";
import { logAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { buildPublicUrl } from "@/lib/security";
import { getCompanyPlanFeatures } from "@/src/stripe/plans";
import { deleteShowroomBackgroundFromS3, storeShowroomBackgroundInS3 } from "@/lib/quote-pdf-s3";
import { hasAllowedShowroomMediaSignature } from "@/lib/security";

export const runtime = "nodejs";

function normalizeWebsiteUrl(val: unknown): string | null {
  if (typeof val !== "string") return null;
  let trimmed = val.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

const schema = z.object({
  companyName: z.string().trim().min(2, "Company name must be at least 2 characters.").max(120),
  aboutUs: z.string().trim().max(300).optional().or(z.literal("")),
  websiteUrl: z.string().trim().optional().or(z.literal("")).transform((val) => normalizeWebsiteUrl(val) || ""),
  logoUrl: z.string().trim().optional().or(z.literal("")),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional().or(z.literal("")),
  showroomBackgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i).optional().or(z.literal(""))
});

async function parseInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  if (isJson) {
    return { input: schema.parse(await request.json()), backgroundMedia: null, removeBackgroundMedia: false, isJson };
  }

  const formData = await request.formData();
  const rawWebsite = String(formData.get("websiteUrl") || "").trim();
  const input = schema.parse({
    companyName: String(formData.get("companyName") || "").trim(),
    aboutUs: String(formData.get("aboutUs") || "").trim(),
    websiteUrl: rawWebsite,
    logoUrl: String(formData.get("logoUrl") || "").trim(),
    primaryColor: String(formData.get("primaryColor") || "").trim(),
    showroomBackgroundColor: String(formData.get("showroomBackgroundColor") || "").trim()
  });
  const candidate = formData.get("backgroundMedia");
  return {
    input,
    backgroundMedia: candidate instanceof File && candidate.size > 0 ? candidate : null,
    removeBackgroundMedia: formData.get("removeBackgroundMedia") === "true",
    isJson
  };
}

export async function POST(request: Request) {
  let isJson = false;
  try {
    const contentType = request.headers.get("content-type") || "";
    isJson = contentType.includes("application/json");

    const context = await requireCompanyContext();
    if (!canManageBilling(context.membership?.role ?? "CUSTOMER")) {
      if (isJson) {
        return NextResponse.json({ error: "You do not have permission to manage branding." }, { status: 403 });
      }
      return NextResponse.redirect(buildPublicUrl("/settings/branding?error=Permission+denied"), 303);
    }

    const parsed = await parseInput(request);
    const { input, backgroundMedia, removeBackgroundMedia } = parsed;
    const { features } = await getCompanyPlanFeatures(context.company.id);
    const canUseLogo = features.pdfBranding !== "azzure_watermark";

    if (input.logoUrl && !canUseLogo) {
      if (isJson) {
        return NextResponse.json(
          { error: "Upload your logo on the Professional or Enterprise plan." },
          { status: 403 }
        );
      }
      return NextResponse.redirect(buildPublicUrl("/settings/branding?error=Upload+your+logo+on+the+Professional+or+Enterprise+plan"), 303);
    }

    const allowedMediaTypes = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"]);
    if (backgroundMedia && (!allowedMediaTypes.has(backgroundMedia.type) || backgroundMedia.size > 50 * 1024 * 1024)) {
      if (isJson) {
        return NextResponse.json({ error: "Background media must be JPG, PNG, WEBP, MP4, or WEBM and no larger than 50 MB." }, { status: 400 });
      }
      return NextResponse.redirect(buildPublicUrl("/settings/branding?error=Background+media+must+be+JPG+PNG+WEBP+MP4+or+WEBM+under+50MB"), 303);
    }

    let mediaKey = context.company.showroomBackgroundMediaKey;
    let mediaType = context.company.showroomBackgroundMediaType;
    if (backgroundMedia) {
      const mediaBuffer = Buffer.from(await backgroundMedia.arrayBuffer());
      if (!hasAllowedShowroomMediaSignature(mediaBuffer, backgroundMedia.type)) {
        if (isJson) {
          return NextResponse.json({ error: "The selected background file content does not match its file type." }, { status: 400 });
        }
        return NextResponse.redirect(buildPublicUrl("/settings/branding?error=Invalid+media+file+signature"), 303);
      }
      const extension = backgroundMedia.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
      const key = `showroom/${context.company.id}/background-${crypto.randomUUID()}.${extension}`;
      const stored = await storeShowroomBackgroundInS3({ key, buffer: mediaBuffer, contentType: backgroundMedia.type });
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

    if (isJson) {
      return NextResponse.json({ success: true, message: "Branding updated successfully." });
    }

    return NextResponse.redirect(buildPublicUrl("/settings/branding?updated=1"), 303);
  } catch (error) {
    const errorMsg =
      error instanceof z.ZodError
        ? error.issues[0]?.message || "Invalid branding payload."
        : error instanceof Error
        ? error.message
        : "Unable to update branding.";

    if (isJson) {
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    return NextResponse.redirect(buildPublicUrl(`/settings/branding?error=${encodeURIComponent(errorMsg)}`), 303);
  }
}
