import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveShowroom, safeBrandColor } from "@/lib/showroom";
import { prisma } from "@/lib/prisma";
import DeviceActivationScreen from "@/components/device-activation-screen";
import { normalizeAzzureSerial } from "@/lib/azzure-devices";

export const dynamic = "force-dynamic";

export default async function ShowroomSetupPage({
  searchParams
}: {
  searchParams: Promise<{ serial?: string; token?: string }>;
}) {
  const { serial = "", token = "" } = await searchParams;
  const showroomSession = token ? await getActiveShowroom(token) : null;

  if (!showroomSession) {
    redirect("/showroom/setup-required");
  }

  const normalizedSerial = normalizeAzzureSerial(serial);
  if (!normalizedSerial) {
    return (
      <div className="showroomInactive" style={{ minHeight: "100vh", display: "grid", placeContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 540, textAlign: "center" }}>
          <h1>Invalid kiosk link</h1>
          <p style={{ color: "#9ca3af" }}>The setup link is missing a valid serial number.</p>
          <Link className="button primary" href={`/showroom?token=${encodeURIComponent(showroomSession.token)}`}>
            Continue to showroom
          </Link>
        </div>
      </div>
    );
  }

  const device = await prisma.azzureDevice.findUnique({
    where: { serialNumber: normalizedSerial },
    select: { id: true, serialNumber: true, status: true }
  });

  if (!device) {
    return (
      <div className="showroomInactive" style={{ minHeight: "100vh", display: "grid", placeContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 540, textAlign: "center" }}>
          <h1>Device not recognised</h1>
          <p style={{ color: "#9ca3af" }}>This serial number is not registered in the hardware inventory.</p>
          <Link className="button primary" href={`/showroom?token=${encodeURIComponent(showroomSession.token)}`}>
            Continue to showroom
          </Link>
        </div>
      </div>
    );
  }

  if (device.status === "DEACTIVATED") {
    return (
      <div className="showroomInactive" style={{ minHeight: "100vh", display: "grid", placeContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 540, textAlign: "center" }}>
          <h1>Device deactivated</h1>
          <p style={{ color: "#9ca3af" }}>This kiosk has been deactivated. Contact Azzure support to re-enable it.</p>
          <p style={{ color: "#64748b", fontSize: 14 }}>Serial: {device.serialNumber}</p>
        </div>
      </div>
    );
  }

  if (device.status === "ACTIVATED") {
    return (
      <div className="showroomInactive" style={{ minHeight: "100vh", display: "grid", placeContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 540, textAlign: "center" }}>
          <h1>This kiosk is already activated</h1>
          <p style={{ color: "#9ca3af" }}>The device has already been linked to this account. Open the showroom to continue.</p>
          <Link className="button primary" href={`/showroom?token=${encodeURIComponent(showroomSession.token)}`}>
            Open showroom
          </Link>
        </div>
      </div>
    );
  }

  const deviceCount = await prisma.showroomDevice.count({
    where: { companyId: showroomSession.companyId }
  });

  return (
    <DeviceActivationScreen
      serialNumber={device.serialNumber}
      showroomToken={showroomSession.token}
      defaultDeviceName={`Kiosk ${deviceCount + 1}`}
      branding={{
        companyName: showroomSession.company.name,
        logoUrl: showroomSession.company.logoUrl,
        primaryColor: safeBrandColor(showroomSession.company.primaryColor)
      }}
    />
  );
}
