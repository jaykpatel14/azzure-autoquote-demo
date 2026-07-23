import { prisma } from "@/lib/prisma";
import { generateToken, hashToken, tokenExpiresIn } from "@/lib/tokens";
import { logAuditEvent } from "@/lib/audit";

export async function createEmailVerificationToken(userId: string, companyId: string) {
  const token = generateToken();
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: tokenExpiresIn(24)
    }
  });

  await logAuditEvent({
    action: "EMAIL_VERIFICATION_REQUESTED",
    companyId,
    actorUserId: userId,
    targetType: "User",
    targetId: userId
  }).catch(() => undefined);

  return token;
}

export async function consumeEmailVerificationToken(token: string) {
  const tokenHash = hashToken(token);
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!record || record.consumedAt || record.expiresAt < new Date()) {
    return null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() }
    });
    await tx.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() }
    });
    const company = await tx.membership.findFirst({
      where: { userId: record.userId },
      select: { companyId: true }
    });
    if (company) {
      await tx.auditLog.create({
        data: {
          action: "EMAIL_VERIFIED",
          companyId: company.companyId,
          actorUserId: record.userId,
          targetType: "User",
          targetId: record.userId
        }
      });
    }
  });

  return record.user;
}

export async function createPasswordResetToken(userId: string, companyId: string) {
  const token = generateToken();
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: tokenExpiresIn(2)
    }
  });

  await logAuditEvent({
    action: "PASSWORD_RESET_REQUESTED",
    companyId,
    actorUserId: userId,
    targetType: "User",
    targetId: userId
  }).catch(() => undefined);

  return token;
}

export async function consumePasswordResetToken(token: string, passwordHash: string) {
  const tokenHash = hashToken(token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!record || record.consumedAt || record.expiresAt < new Date()) {
    return null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() }
    });
    await tx.user.update({
      where: { id: record.userId },
      data: {
        passwordHash,
        sessionVersion: { increment: 1 }
      }
    });
    const company = await tx.membership.findFirst({
      where: { userId: record.userId },
      select: { companyId: true }
    });
    if (company) {
      await tx.auditLog.create({
        data: {
          action: "PASSWORD_RESET_COMPLETED",
          companyId: company.companyId,
          actorUserId: record.userId,
          targetType: "User",
          targetId: record.userId
        }
      });
    }
  });

  return record.user;
}
