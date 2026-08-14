import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  normalizeAdminSettingKey,
  upsertRuntimeSetting
} from "@/lib/app-settings";
import { requireInternalAdminContext, InternalAdminAccessError } from "@/lib/internal-admin";
import { buildPublicUrl } from "@/lib/security";

export const runtime = "nodejs";

const schema = z.object({
  key: z.string().trim().min(1),
  value: z.string().optional(),
  redirectTo: z.string().optional()
});

async function parseInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return schema.parse(await request.json());
  }

  const formData = await request.formData();
  return schema.parse({
    key: String(formData.get("key") || ""),
    value: String(formData.get("value") || ""),
    redirectTo: String(formData.get("redirectTo") || "")
  });
}

export async function POST(request: Request) {
  try {
    const admin = await requireInternalAdminContext();
    const input = await parseInput(request);
    const key = normalizeAdminSettingKey(input.key);
    const value = (input.value || "").trim();

    if (value.length === 0) {
      await prisma.appSetting.deleteMany({ where: { key } });
    } else {
      await upsertRuntimeSetting({
        key,
        value,
        updatedByUserId: admin.user.id
      });
    }

    const redirectTo = input.redirectTo?.trim() || "/admin/settings";
    return NextResponse.redirect(buildPublicUrl(redirectTo), 303);
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid admin setting." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update setting." },
      { status: 400 }
    );
  }
}
