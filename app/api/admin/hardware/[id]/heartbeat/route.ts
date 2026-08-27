import { NextResponse, type NextRequest } from "next/server";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await getInternalAdminContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const device = await prisma.azzureDevice.findUnique({
      where: { id },
      include: {
        showroomDevice: true
      }
    });

    if (!device) {
      return NextResponse.json({ error: "Device not found." }, { status: 404 });
    }

    if (!device.showroomDevice) {
      return NextResponse.json({ error: "No linked showroom screen found." }, { status: 400 });
    }

    const now = new Date();
    await prisma.showroomDevice.update({
      where: { id: device.showroomDevice.id },
      data: {
        lastSeenAt: now,
        isActive: true
      }
    });

    if (device.showroomDevice.azzureSerial) {
      await prisma.azzureDevice.updateMany({
        where: {
          serialNumber: device.showroomDevice.azzureSerial,
          status: { not: "DEACTIVATED" }
        },
        data: {
          status: "ACTIVATED",
          activatedAt: now,
          showroomDeviceId: device.showroomDevice.id,
          companyId: device.companyId
        }
      });
    }

    return NextResponse.json(
      {
        ok: true,
        lastSeenAt: now.toISOString(),
        lastSeenIp: device.showroomDevice.lastSeenIp
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to refresh heartbeat." },
      { status: 400 }
    );
  }
}
