import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "SIGN_UP"
  | "SIGN_IN"
  | "SIGN_OUT"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET_COMPLETED"
  | "EMAIL_VERIFICATION_REQUESTED"
  | "EMAIL_VERIFIED"
  | "COMPANY_SWITCHED"
  | "COMPANY_CREATED"
  | "MEMBERSHIP_CREATED"
  | "ROLE_UPDATED"
  | "COMPANY_UPDATED";

export type AuditContext = {
  action: AuditAction;
  companyId: string;
  actorUserId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function logAuditEvent(context: AuditContext) {
  await prisma.auditLog.create({
    data: {
      action: context.action,
      companyId: context.companyId,
      actorUserId: context.actorUserId ?? null,
      targetType: context.targetType ?? null,
      targetId: context.targetId ?? null,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent ?? null,
      ...(context.metadata !== undefined
        ? { metadata: context.metadata as Prisma.InputJsonValue }
        : {})
    }
  });
}
