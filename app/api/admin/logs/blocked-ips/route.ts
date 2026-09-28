import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeIpAddress } from "@/lib/ip-access";
import { InternalAdminAccessError, requireInternalAdminContext } from "@/lib/internal-admin";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/security";

export const runtime = "nodejs";

const allowedRoles = new Set(["SUPER_ADMIN", "SUPPORT_ADMIN", "OPERATIONS_MANAGER"]);

const blockSchema = z.object({
  ipAddress: z.string().trim().min(1),
  reason: z.string().trim().max(300).optional()
});

const unblockSchema = z.object({
  id: z.string().trim().min(1)
});

function assertLogsAccess(adminRole: string | null) {
  if (adminRole && !allowedRoles.has(adminRole)) {
    throw new InternalAdminAccessError("You do not have permission to manage blocked IP addresses.");
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireInternalAdminContext();
    assertLogsAccess(admin.user.adminRole);

    const parsed = blockSchema.parse(await request.json());
    const ipAddress = normalizeIpAddress(parsed.ipAddress);
    if (!ipAddress) {
      return NextResponse.json({ error: "Enter a valid IPv4 or IPv6 address." }, { status: 400 });
    }

    const requesterIp = normalizeIpAddress(getClientIp(request));
    if (requesterIp === ipAddress) {
      return NextResponse.json({ error: "You cannot block the IP address used by your current session." }, { status: 400 });
    }

    const existing = await prisma.blockedIp.findUnique({ where: { ipAddress }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: "This IP address is already blocked." }, { status: 409 });
    }

    const blockedIp = await prisma.$transaction(async (transaction) => {
      const created = await transaction.blockedIp.create({
        data: {
          ipAddress,
          reason: parsed.reason || null,
          blockedByUserId: admin.user.id
        }
      });

      await transaction.auditLog.create({
        data: {
          action: "IP_BLOCKED",
          companyId: null,
          actorUserId: admin.user.id,
          targetType: "BlockedIp",
          targetId: created.id,
          ipAddress: requesterIp,
          userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
          metadata: {
            blockedIpAddress: ipAddress,
            reason: parsed.reason || null
          }
        }
      });

      return created;
    });

    return NextResponse.json({ blockedIp }, { status: 201 });
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid input." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to block this IP address." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await requireInternalAdminContext();
    assertLogsAccess(admin.user.adminRole);

    const parsed = unblockSchema.parse(await request.json());
    const blockedIp = await prisma.blockedIp.findUnique({ where: { id: parsed.id } });
    if (!blockedIp) {
      return NextResponse.json({ error: "Blocked IP record not found." }, { status: 404 });
    }

    const requesterIp = normalizeIpAddress(getClientIp(request));
    await prisma.$transaction(async (transaction) => {
      await transaction.blockedIp.delete({ where: { id: blockedIp.id } });
      await transaction.auditLog.create({
        data: {
          action: "IP_UNBLOCKED",
          companyId: null,
          actorUserId: admin.user.id,
          targetType: "BlockedIp",
          targetId: blockedIp.id,
          ipAddress: requesterIp,
          userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
          metadata: {
            unblockedIpAddress: blockedIp.ipAddress,
            previousReason: blockedIp.reason
          }
        }
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid input." }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to unblock this IP address." }, { status: 500 });
  }
}
