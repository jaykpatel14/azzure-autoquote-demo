import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { isInternalAdminEmail } from "@/lib/internal-admin";

export type AdminUserRole =
  | "SUPER_ADMIN"
  | "OPERATIONS_MANAGER"
  | "ESTIMATOR_ADMIN"
  | "SUPPORT_ADMIN"
  | "SALESMAN";

export type AdminUserSummary = {
  id: string;
  email: string;
  name: string | null;
  adminRole: string;
  isEnvConfigured: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export async function getInternalAdminUsers(): Promise<AdminUserSummary[]> {
  // Find all users marked as isInternalAdmin in the database
  const dbAdmins = await prisma.user.findMany({
    where: { isInternalAdmin: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      adminRole: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return dbAdmins.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    adminRole: u.adminRole || (isInternalAdminEmail(u.email) ? "SUPER_ADMIN" : "OPERATIONS_MANAGER"),
    isEnvConfigured: isInternalAdminEmail(u.email),
    createdAt: u.createdAt,
    updatedAt: u.updatedAt
  }));
}

export async function createInternalAdminUser(params: {
  name?: string;
  email: string;
  password?: string;
  adminRole?: string;
  actorAdminId?: string;
}) {
  const normalizedEmail = params.email.trim().toLowerCase();
  const password = params.password?.trim() || "AdminPass123!";
  const passwordHash = hashPassword(password);
  const adminRole = params.adminRole || "OPERATIONS_MANAGER";

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    create: {
      email: normalizedEmail,
      name: params.name?.trim() || null,
      passwordHash,
      emailVerifiedAt: new Date(),
      isInternalAdmin: true,
      adminRole
    },
    update: {
      name: params.name?.trim() || undefined,
      passwordHash: params.password ? passwordHash : undefined,
      isInternalAdmin: true,
      adminRole,
      emailVerifiedAt: new Date()
    }
  });

  if (params.actorAdminId) {
    await prisma.auditLog.create({
      data: {
        companyId: "system",
        actorUserId: params.actorAdminId,
        action: "INTERNAL_ADMIN_USER_CREATED",
        targetType: "User",
        targetId: user.id,
        metadata: {
          email: user.email,
          name: user.name,
          adminRole
        }
      }
    }).catch(() => {});
  }

  return user;
}

export async function deleteInternalAdminUser(userId: string, actorAdminId?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true }
  });

  if (!user) {
    throw new Error("User not found.");
  }

  // Revoke internal admin status
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      isInternalAdmin: false,
      adminRole: null
    }
  });

  if (actorAdminId) {
    await prisma.auditLog.create({
      data: {
        companyId: "system",
        actorUserId: actorAdminId,
        action: "INTERNAL_ADMIN_USER_REVOKED",
        targetType: "User",
        targetId: user.id,
        metadata: { email: user.email }
      }
    }).catch(() => {});
  }

  return updated;
}
