import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveShowroom, safeBrandColor } from "@/lib/showroom";
import { touchShowroomDevice } from "@/lib/showroom-devices";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const session = await getActiveShowroom(token);
  if (!session) return NextResponse.json({ valid: false });

  // Update session lastUsedAt
  await prisma.showroomSession.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);

  // Background non-blocking update of device lastSeenAt if deviceToken is present
  const deviceToken = request.headers.get("x-device-token") || url.searchParams.get("device");
  if (deviceToken) {
    touchShowroomDevice(deviceToken, session.companyId);
  }

  return NextResponse.json({
    valid: true,
    companyName: session.company.name,
    logoUrl: session.company.logoUrl,
    primaryColor: safeBrandColor(session.company.primaryColor),
    aboutUs: session.company.aboutUs
  });
}
