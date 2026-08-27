import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCompanyPlanFeatures, PlanError } from "@/src/stripe/plans";

export async function getShowroomConfigHash(companyId: string): Promise<string> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      name: true,
      logoUrl: true,
      primaryColor: true,
      aboutUs: true,
      showroomBackgroundColor: true,
      showroomOverlayColor: true,
      showroomOverlayOpacity: true,
      showroomTextColor: true,
      showroomBackgroundFit: true,
      showroomBackgroundPosition: true,
      showroomPanelOpacity: true,
      showroomBackgroundMediaKey: true,
      showroomBackgroundMediaType: true,
      pricingProfile: {
        select: {
          sellingMarginDivisor: true,
          finalMultiplier: true
        }
      }
    }
  });

  if (!company) return "default_config";

  const serialized = JSON.stringify(company);
  return createHash("md5").update(serialized).digest("hex").slice(0, 16);
}

export type RegisterShowroomDeviceInput = {
  showroomToken: string;
  deviceName?: string | null;
  platform?: string | null;
  userAgent?: string | null;
  ip?: string | null;
};

export async function registerShowroomDevice(input: RegisterShowroomDeviceInput) {
  const session = await prisma.showroomSession.findUnique({
    where: { token: input.showroomToken, isActive: true },
    include: { company: true }
  });

  if (!session) {
    return { error: "Invalid token", status: 401 as const };
  }

  // Verify Enterprise / Showroom Mode Plan feature
  try {
    const { features } = await getCompanyPlanFeatures(session.companyId);
    if (!features.canUseShowroomMode) {
      return { error: "Plan upgrade required", status: 403 as const };
    }
  } catch {
    return { error: "Plan upgrade required", status: 403 as const };
  }

  // Rate limiting: max 5 registrations per showroom session per hour
  const rateLimitKey = `showroom_device_reg:${session.id}`;
  const rateCheck = checkRateLimit({
    key: rateLimitKey,
    limit: 5,
    windowMs: 60 * 60 * 1000
  });

  if (!rateCheck.allowed) {
    return { error: "Too many registrations. Maximum 5 devices per hour.", status: 429 as const };
  }

  const sanitizedDeviceName = (input.deviceName || "Kiosk").trim().slice(0, 64) || "Kiosk";

  const device = await prisma.showroomDevice.create({
    data: {
      companyId: session.companyId,
      sessionId: session.id,
      deviceName: sanitizedDeviceName,
      platform: input.platform || "web",
      userAgent: input.userAgent ? input.userAgent.slice(0, 500) : null,
      lastSeenIp: input.ip || null,
      isActive: true
    }
  });

  return {
    data: {
      deviceToken: device.deviceToken,
      deviceId: device.id,
      deviceName: device.deviceName
    },
    status: 200 as const
  };
}

export type HeartbeatShowroomDeviceInput = {
  deviceToken: string;
  showroomToken: string;
  ip?: string | null;
};

export async function heartbeatShowroomDevice(input: HeartbeatShowroomDeviceInput) {
  if (!input.deviceToken || !input.showroomToken) {
    return { error: "Invalid device", status: 401 as const };
  }

  const device = await prisma.showroomDevice.findUnique({
    where: { deviceToken: input.deviceToken, isActive: true },
    include: { session: true }
  });

  if (!device || device.session.token !== input.showroomToken || !device.session.isActive) {
    return { error: "Invalid device", status: 401 as const };
  }

  await prisma.showroomDevice.update({
    where: { id: device.id },
    data: {
      lastSeenAt: new Date(),
      lastSeenIp: input.ip ?? undefined
    }
  });

  if (device.azzureSerial) {
    await prisma.azzureDevice.updateMany({
      where: {
        serialNumber: device.azzureSerial,
        status: { not: "DEACTIVATED" }
      },
      data: {
        status: "ACTIVATED",
        activatedAt: new Date(),
        showroomDeviceId: device.id,
        companyId: device.companyId
      }
    });
  }

  const configVersion = await getShowroomConfigHash(device.companyId);
  return {
    data: {
      ok: true,
      configVersion
    },
    status: 200 as const
  };
}

export function touchShowroomDevice(deviceToken: string, companyId?: string) {
  if (!deviceToken) return;
  prisma.showroomDevice
    .updateMany({
      where: {
        deviceToken,
        isActive: true,
        ...(companyId ? { companyId } : {})
      },
      data: { lastSeenAt: new Date() }
    })
    .catch(() => undefined);
}

export async function getShowroomDevicesForCompany(companyId: string) {
  return prisma.showroomDevice.findMany({
    where: { companyId },
    orderBy: { registeredAt: "desc" },
    select: {
      id: true,
      deviceName: true,
      platform: true,
      azzureSerial: true,
      lastSeenAt: true,
      isActive: true,
      registeredAt: true
    }
  });
}

export async function renameShowroomDevice(companyId: string, deviceId: string, deviceName: string) {
  const sanitized = deviceName.trim().slice(0, 64);
  if (!sanitized) {
    throw new Error("Device name cannot be empty.");
  }

  const result = await prisma.showroomDevice.updateMany({
    where: { id: deviceId, companyId },
    data: { deviceName: sanitized }
  });

  if (result.count === 0) {
    throw new Error("Device not found or access denied.");
  }

  return { ok: true, deviceName: sanitized };
}

export async function deactivateShowroomDevice(companyId: string, deviceId: string) {
  const device = await prisma.showroomDevice.findFirst({
    where: { id: deviceId, companyId },
    select: { id: true, azzureSerial: true }
  });

  if (!device) {
    throw new Error("Device not found or access denied.");
  }

  await prisma.showroomDevice.update({
    where: { id: device.id },
    data: { isActive: false }
  });

  if (device.azzureSerial) {
    await prisma.azzureDevice.updateMany({
      where: { serialNumber: device.azzureSerial },
      data: { status: "DEACTIVATED", deactivatedAt: new Date() }
    });
  }

  return { ok: true };
}
