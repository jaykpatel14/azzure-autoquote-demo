import { NextResponse, type NextRequest } from "next/server";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { listAzzureDevices, registerAzzureDevice, nextAzzureSerialNumber } from "@/lib/azzure-devices";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/security";

export const runtime = "nodejs";

export async function GET() {
  const context = await getInternalAdminContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const devices = await listAzzureDevices();
  return NextResponse.json({ devices }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const context = await getInternalAdminContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const serialNumber = typeof body.serialNumber === "string" && body.serialNumber.trim()
      ? body.serialNumber.trim()
      : await nextAzzureSerialNumber();
    const deviceType = body.deviceType === "PRINTER" ? "PRINTER" : "KIOSK";
    const companyId = typeof body.companyId === "string" && body.companyId.trim() ? body.companyId.trim() : null;
    const orderId = typeof body.orderId === "string" && body.orderId.trim() ? body.orderId.trim() : null;
    const notes = typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null;
    const kioskDestination = typeof body.kioskDestination === "string" && body.kioskDestination.trim()
      ? body.kioskDestination.trim().toUpperCase()
      : "AI_QUOTE";
    const shippedAt = typeof body.shippedAt === "string" && body.shippedAt.trim() ? new Date(body.shippedAt) : null;

    if (companyId) {
      const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
      if (!company) {
        return NextResponse.json({ error: "Company not found." }, { status: 400 });
      }
    }

    const device = await registerAzzureDevice({
      serialNumber,
      deviceType,
      companyId,
      orderId,
      notes,
      kioskDestination,
      shippedAt
    });

    return NextResponse.json({ device }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to register hardware device." },
      { status: 400 }
    );
  }
}
