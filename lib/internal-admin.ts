import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
  constructor(message = "You do not have access to the Azzure admin console.") {
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
  if (!isInternalAdminEmail(email)) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      sessionVersion: true
    }
  });

  if (!user || user.sessionVersion !== session?.user?.sessionVersion) {
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
