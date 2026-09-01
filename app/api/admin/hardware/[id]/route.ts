import { NextResponse, type NextRequest } from "next/server";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { prisma } from "@/lib/prisma";
import { deactivateAzzureDevice, linkAzzureDeviceToShowroom } from "@/lib/azzure-devices";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getInternalAdminContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};

    if (typeof body.companyId === "string") {
      const companyId = body.companyId.trim();
      if (companyId) {
        const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
        if (!company) {
          return NextResponse.json({ error: "Company not found." }, { status: 400 });
        }
        updates.companyId = companyId;
      } else {
        updates.companyId = null;
      }
    }

    if (typeof body.orderId === "string") {
      updates.orderId = body.orderId.trim() || null;
    }

    if (typeof body.notes === "string") {
      updates.notes = body.notes.trim() || null;
    }

    if (typeof body.kioskDestination === "string") {
      updates.kioskDestination = body.kioskDestination.trim().toUpperCase() || "AI_QUOTE";
    }

    if (typeof body.linkShowroomDeviceId === "string" && body.linkShowroomDeviceId.trim()) {
      const linkResult = await linkAzzureDeviceToShowroom({
        azzureDeviceId: id,
        showroomDeviceId: body.linkShowroomDeviceId.trim()
      });
      return NextResponse.json({ ok: true, linked: linkResult }, { status: 200 });
    }

    if (body.deviceType === "KIOSK" || body.deviceType === "PRINTER") {
      updates.deviceType = body.deviceType;
    }

    if (body.status === "ACTIVATED" || body.status === "PRE_PROVISIONED" || body.status === "DEACTIVATED") {
      updates.status = body.status;
      if (body.status === "ACTIVATED") {
        updates.activatedAt = new Date();
      }
    }

    const device = await prisma.azzureDevice.update({
      where: { id },
      data: updates
    });

    return NextResponse.json({ device }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update hardware device." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const context = await getInternalAdminContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    await deactivateAzzureDevice(id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to deactivate hardware device." },
      { status: 400 }
    );
  }
}
