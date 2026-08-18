import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveShowroom, safeBrandColor } from "@/lib/showroom";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const session = await getActiveShowroom(token);
  if (!session) return NextResponse.json({ valid: false });
  await prisma.showroomSession.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  return NextResponse.json({
    valid: true,
    companyName: session.company.name,
    logoUrl: session.company.logoUrl,
    primaryColor: safeBrandColor(session.company.primaryColor),
    aboutUs: session.company.aboutUs
  });
}
