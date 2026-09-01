import { NextResponse, type NextRequest } from "next/server";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { forceHeartbeatAzzureDevice } from "@/lib/azzure-devices";

export const runtime = "nodejs";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const context = await getInternalAdminContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const result = await forceHeartbeatAzzureDevice(id);

    return NextResponse.json(
      {
        ok: true,
        lastSeenAt: result.lastSeenAt,
        lastSeenIp: result.lastSeenIp,
        deviceName: result.deviceName,
        status: result.status
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
