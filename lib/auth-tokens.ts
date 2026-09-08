import { prisma } from "@/lib/prisma";
import { generateOtp, generateToken, hashToken, tokenExpiresIn } from "@/lib/tokens";
import { logAuditEvent } from "@/lib/audit";

export async function createEmailVerificationToken(userId: string, companyId: string) {
  const token = generateToken();
  const otp = generateOtp();

  // Create records for both magic link token and 6-digit OTP
  await prisma.emailVerificationToken.createMany({
    data: [
      {
        userId,
        tokenHash: hashToken(token),
        expiresAt: tokenExpiresIn(24)
      },
      {
        userId,
        tokenHash: hashToken(otp),
        expiresAt: tokenExpiresIn(24)
      }
    ]
  });

  await logAuditEvent({
    action: "EMAIL_VERIFICATION_REQUESTED",
    companyId,
    actorUserId: userId,
    targetType: "User",
    targetId: userId
  }).catch(() => undefined);

  return { token, otp };
}

export async function consumeEmailVerificationToken(tokenOrOtp: string) {
  const tokenHash = hashToken(tokenOrOtp.trim());
  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    include: { user: true }
  });

  if (!record || record.consumedAt || record.expiresAt < new Date()) {
    return null;
  }

  const wasAlreadyVerified = !!record.user.emailVerifiedAt;

  const { notifyAdminCompany } = await prisma.$transaction(async (tx) => {
    await tx.emailVerificationToken.updateMany({
      where: { userId: record.userId },
      data: { consumedAt: new Date() }
    });
    await tx.user.update({
      where: { id: record.userId },
      data: { emailVerifiedAt: new Date() }
    });
    const companyMembership = await tx.membership.findFirst({
      where: { userId: record.userId },
      include: { company: true }
    });

    let pendingCompanyToAlert: { name: string; createdAt: Date; websiteUrl: string | null } | null = null;

    if (companyMembership?.company) {
      await tx.auditLog.create({
        data: {
          action: "EMAIL_VERIFIED",
          companyId: companyMembership.company.id,
          actorUserId: record.userId,
          targetType: "User",
          targetId: record.userId
        }
      });

      if (!wasAlreadyVerified && companyMembership.company.accountStatus === "PENDING_APPROVAL") {
        pendingCompanyToAlert = {
          name: companyMembership.company.name,
          createdAt: companyMembership.company.createdAt,
          websiteUrl: companyMembership.company.websiteUrl
        };
      }
    }

    return { notifyAdminCompany: pendingCompanyToAlert };
  });

  if (notifyAdminCompany) {
    const { sendSignupApprovalAlert } = await import("@/lib/account-workflow");
    await sendSignupApprovalAlert({
      companyName: notifyAdminCompany.name,
      ownerName: record.user.name || record.user.email,
      ownerEmail: record.user.email,
      websiteUrl: notifyAdminCompany.websiteUrl,
      signedUpAt: notifyAdminCompany.createdAt
    }).catch((err) => {
      console.error("[auth-tokens] Failed to send signup approval alert:", err);
    });
  }

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
