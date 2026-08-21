import { prisma } from "@/lib/prisma";

export function normalizeShowroomCode(value: string) {
  const compact = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const digits = compact.startsWith("QT") ? compact.slice(2) : compact;
  return /^\d{1,4}$/.test(digits) ? `QT-${digits.padStart(4, "0")}` : null;
}

export function safeBrandColor(value: string | null | undefined) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}

export async function getActiveShowroom(token: string) {
  if (!token || token.length > 160) return null;
  const session = await prisma.showroomSession.findUnique({
    where: { token },
    include: {
      company: {
        include: {
          subscription: {
            include: { plan: true }
          },
          pricingProfile: true
        }
      }
    }
  });
  if (!session?.isActive || session.company.accountStatus !== "APPROVED") return null;
  return session;
}

export async function nextShowroomCode(companyId: string) {
  const latest = await prisma.showroomQuote.findFirst({
    where: { companyId },
    orderBy: { displayCode: "desc" },
    select: { displayCode: true }
  });
  const next = Math.min(9999, Number(latest?.displayCode.slice(3) || 0) + 1);
  return `QT-${String(next).padStart(4, "0")}`;
}
