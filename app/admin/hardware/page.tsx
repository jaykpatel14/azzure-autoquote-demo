import { redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import AdminHardwarePanel from "@/components/admin-hardware-panel";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav, requireAdminRouteAccess } from "@/lib/internal-admin-nav";
import { listAzzureDevices } from "@/lib/azzure-devices";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminHardwarePage() {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  requireAdminRouteAccess("/admin/hardware", context.user.adminRole);

  const [devices, companies] = await Promise.all([
    listAzzureDevices(),
    prisma.company.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        showroomSession: {
          select: { token: true, isActive: true }
        }
      }
    })
  ]);

  return (
    <InternalAdminShell
      title="Hardware Inventory"
      description="Pre-provision, ship, and deactivate Azzure kiosks with serial-based activation."
      navItems={getInternalAdminNav("/admin/hardware", context.user.adminRole)}
      adminName={context.user.name || context.user.email}
    >
      <AdminHardwarePanel
        initialDevices={devices.map((device) => ({
          ...device,
          company: device.company || null,
          showroomDevice: device.showroomDevice
            ? {
                ...device.showroomDevice,
                lastSeenAt: device.showroomDevice.lastSeenAt.toISOString()
              }
            : null,
          candidateScreens: device.candidateScreens
            ? device.candidateScreens.map((s) => ({
                ...s,
                lastSeenAt: s.lastSeenAt.toISOString()
              }))
            : [],
          createdAt: device.createdAt.toISOString(),
          shippedAt: device.shippedAt ? device.shippedAt.toISOString() : null,
          activatedAt: device.activatedAt ? device.activatedAt.toISOString() : null,
          deactivatedAt: device.deactivatedAt ? device.deactivatedAt.toISOString() : null
        }))}
        companies={companies}
      />
    </InternalAdminShell>
  );
}
