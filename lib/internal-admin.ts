import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isPrismaConnectionError } from "@/lib/prisma-errors";

function parseAdminEmails() {
  const allowedEmails = new Set(
    (process.env.AZZURE_ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );

  if (process.env.NODE_ENV !== "production") {
    allowedEmails.add("admin@azzure.com");
  }

  return allowedEmails;
}

export class InternalAdminAccessError extends Error {
  constructor(message = "You do not have access to the admin console.") {
    super(message);
    this.name = "InternalAdminAccessError";
  }
}

export function isInternalAdminEmail(email?: string | null) {
  if (!email) return false;
  const allowedEmails = parseAdminEmails();
  return allowedEmails.has(email.trim().toLowerCase());
}

export async function getInternalAdminContext() {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return null;

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        isInternalAdmin: true,
        adminRole: true,
        sessionVersion: true
      }
    });
  } catch (error) {
    if (isPrismaConnectionError(error)) {
      console.warn("Database is unavailable while loading the internal admin context.");
      return null;
    }

    throw error;
  }

  if (!user || user.sessionVersion !== session?.user?.sessionVersion) {
    return null;
  }

  const isHardcodedAdmin = isInternalAdminEmail(email);
  if (!isHardcodedAdmin && !user.isInternalAdmin) {
    return null;
  }

  return { session, user };
}

export async function requireInternalAdminContext() {
  const context = await getInternalAdminContext();
  if (!context) {
    throw new InternalAdminAccessError();
  }

  return context;
}
