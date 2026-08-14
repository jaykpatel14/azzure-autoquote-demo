import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { logAuditEvent } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { buildPublicUrl } from "@/lib/security";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().max(120).optional(),
  avatarUrl: z.string().trim().url().optional().or(z.literal("")),
  currentPassword: z.string().min(8).optional(),
  newPassword: z.string().min(8).max(200).optional(),
  confirmPassword: z.string().min(8).max(200).optional()
});

async function parseInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return schema.parse(await request.json());
  }

  const formData = await request.formData();
  return schema.parse({
    name: String(formData.get("name") || ""),
    avatarUrl: String(formData.get("avatarUrl") || ""),
    currentPassword: String(formData.get("currentPassword") || ""),
    newPassword: String(formData.get("newPassword") || ""),
    confirmPassword: String(formData.get("confirmPassword") || "")
  });
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
    }

    const input = await parseInput(request);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        passwordHash: true,
        memberships: {
          select: {
            companyId: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const updateData: {
      name?: string | null;
      avatarUrl?: string | null;
      passwordHash?: string;
      sessionVersion?: { increment: number };
    } = {};

    if (typeof input.name === "string") {
      updateData.name = input.name.trim() || null;
    }

    if (typeof input.avatarUrl === "string") {
      updateData.avatarUrl = input.avatarUrl.trim() || null;
    }

    if (input.newPassword || input.confirmPassword || input.currentPassword) {
      if (!user.passwordHash) {
        return NextResponse.json({ error: "Password changes are not available for this account." }, { status: 409 });
      }

      if (!input.currentPassword || !verifyPassword(input.currentPassword, user.passwordHash)) {
        return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
      }

      if (input.newPassword !== input.confirmPassword) {
        return NextResponse.json({ error: "New passwords do not match." }, { status: 400 });
      }

      updateData.passwordHash = hashPassword(input.newPassword || input.currentPassword);
      updateData.sessionVersion = { increment: 1 };
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData
    });

    if (user.memberships[0]) {
      await logAuditEvent({
        action: "COMPANY_UPDATED",
        companyId: user.memberships[0].companyId,
        actorUserId: userId,
        targetType: "User",
        targetId: userId,
        metadata: {
          profileUpdated: true
        }
      }).catch(() => undefined);
    }

    return NextResponse.redirect(buildPublicUrl("/settings/profile?updated=1"), 303);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid profile payload." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update profile." },
      { status: 400 }
    );
  }
}
