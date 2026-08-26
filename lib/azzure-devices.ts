import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { assertPlanFeature } from "@/src/stripe/plans";

export const AZZURE_SERIAL_PATTERN = /^AZQ-\d{4}-\d{5}$/;

export function normalizeAzzureSerial(value: string) {
  const serial = value.trim().toUpperCase();
  return AZZURE_SERIAL_PATTERN.test(serial) ? serial : null;
}

export async function nextAzzureSerialNumber() {
  const year = new Date().getFullYear();
  const prefix = `AZQ-${year}-`;
  const latest = await prisma.azzureDevice.findFirst({
    where: { serialNumber: { startsWith: prefix } },
    orderBy: { serialNumber: "desc" },
    select: { serialNumber: true }
  });

  const lastSerial = latest?.serialNumber || `${prefix}00000`;
  const lastNumber = Number.parseInt(lastSerial.split("-")[2] || "0", 10) || 0;
  return `${prefix}${String(lastNumber + 1).padStart(5, "0")}`;
}

export async function getOrCreateShowroomSession(companyId: string) {
  const existing = await prisma.showroomSession.findUnique({
    where: { companyId }
  });

  if (existing?.isActive) {
    return existing;
  }

  const token = randomBytes(24).toString("base64url");
  return prisma.showroomSession.upsert({
    where: { companyId },
    create: { companyId, token, isActive: true },
    update: { token, isActive: true, lastUsedAt: new Date() }
  });
}

export async function registerAzzureDevice(input: {
  serialNumber?: string | null;
  deviceType: "KIOSK" | "PRINTER";
  companyId?: string | null;
  orderId?: string | null;
  notes?: string | null;
  kioskDestination?: string | null;
  shippedAt?: Date | null;
}) {
  const serialNumber = input.serialNumber ? normalizeAzzureSerial(input.serialNumber) : null;
  if (input.serialNumber && !serialNumber) {
    throw new Error("Serial number must follow AZQ-YYYY-NNNNN.");
  }

  const finalSerial = serialNumber || (await nextAzzureSerialNumber());

  return prisma.azzureDevice.create({
    data: {
      serialNumber: finalSerial,
      deviceType: input.deviceType,
      companyId: input.companyId || null,
      orderId: input.orderId || null,
      notes: input.notes || null,
      kioskDestination: input.kioskDestination || "AI_QUOTE",
      shippedAt: input.shippedAt || null
    }
  });
}

export async function activateAzzureDevice(input: {
  serialNumber: string;
  showroomToken: string;
  deviceName: string;
  platform?: string | null;
  userAgent?: string | null;
  ip?: string | null;
}) {
  const serialNumber = normalizeAzzureSerial(input.serialNumber);
  if (!serialNumber) {
    return { error: "Serial number not recognised.", status: 400 as const };
  }

  const session = await prisma.showroomSession.findUnique({
    where: { token: input.showroomToken },
    include: { company: true }
  });
  if (!session?.isActive || session.company.accountStatus !== "APPROVED") {
    return { error: "Invalid showroom token.", status: 401 as const };
  }

  try {
    await assertPlanFeature(session.companyId, "canUseShowroomMode");
  } catch {
    return { error: "Enterprise plan required.", status: 403 as const };
  }

  const device = await prisma.azzureDevice.findUnique({
    where: { serialNumber: serialNumber },
    include: { showroomDevice: true }
  });

  if (!device) {
    return { error: "Serial number not recognised. Contact Azzure support.", status: 400 as const };
  }

  if (device.status === "DEACTIVATED") {
    return { error: "This device has been deactivated. Contact Azzure support.", status: 400 as const };
  }

  if (device.status === "ACTIVATED") {
    return { error: "This device is already registered.", status: 400 as const };
  }

  if (device.companyId && device.companyId !== session.companyId) {
    return { error: "This device is registered to a different account.", status: 403 as const };
  }

  const showroomDevice = await prisma.showroomDevice.create({
    data: {
      companyId: session.companyId,
      sessionId: session.id,
      deviceName: input.deviceName.trim().slice(0, 64) || "Kiosk",
      platform: input.platform || "android",
      userAgent: input.userAgent ? input.userAgent.slice(0, 500) : null,
      lastSeenIp: input.ip || null,
      isActive: true,
      azzureSerial: serialNumber
    }
  });

  await prisma.azzureDevice.update({
    where: { id: device.id },
    data: {
      status: "ACTIVATED",
      companyId: session.companyId,
      showroomDeviceId: showroomDevice.id,
      activatedAt: new Date()
    }
  });

  return {
    data: {
      deviceToken: showroomDevice.deviceToken,
      deviceId: showroomDevice.id,
      deviceName: showroomDevice.deviceName,
      serialNumber
    },
    status: 200 as const
  };
}

export async function resolveAzzureKioskTarget(serialNumber: string) {
  const serial = normalizeAzzureSerial(serialNumber);
  if (!serial) return null;

  const device = await prisma.azzureDevice.findUnique({
    where: { serialNumber: serial },
    include: { company: true }
  });

  if (!device || device.status === "DEACTIVATED") {
    return { status: "missing" as const, serial };
  }

  if (!device.companyId || !device.company || device.company.accountStatus !== "APPROVED") {
    return { status: "missing" as const, serial };
  }

  await assertPlanFeature(device.companyId, "canUseShowroomMode");
  const session = await getOrCreateShowroomSession(device.companyId);

  return {
    status: device.status === "ACTIVATED" ? "activated" : "ready" as const,
    serial,
    companyId: device.companyId,
    showroomToken: session.token,
    device
  };
}

export async function deactivateAzzureDevice(deviceId: string) {
  const device = await prisma.azzureDevice.findUnique({
    where: { id: deviceId },
    include: { showroomDevice: true }
  });

  if (!device) {
    throw new Error("Device not found.");
  }

  await prisma.$transaction([
    prisma.azzureDevice.update({
      where: { id: device.id },
      data: {
        status: "DEACTIVATED",
        deactivatedAt: new Date()
      }
    }),
    device.showroomDeviceId
      ? prisma.showroomDevice.update({
          where: { id: device.showroomDeviceId },
          data: { isActive: false }
        })
      : prisma.showroomDevice.updateMany({
          where: { azzureSerial: device.serialNumber },
          data: { isActive: false }
        })
  ]);

  return { ok: true };
}

export async function listAzzureDevices() {
  return prisma.azzureDevice.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      company: {
        select: { id: true, name: true, slug: true }
      },
      showroomDevice: {
        select: {
          id: true,
          deviceName: true,
          lastSeenAt: true,
          isActive: true
        }
      }
    }
  });
}

export function buildKioskConfigHash(input: unknown) {
  return createHash("md5").update(JSON.stringify(input)).digest("hex").slice(0, 16);
}
