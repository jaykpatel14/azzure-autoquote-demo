import { NextResponse, type NextRequest } from "next/server";
import { heartbeatShowroomDevice } from "@/lib/showroom-devices";
import { getClientIp } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { deviceToken, showroomToken, screenResolution, currentMode, lastError, appVersion } = body;

    if (!deviceToken || !showroomToken) {
      return NextResponse.json({ error: "Invalid device credentials" }, { status: 401 });
    }

    const ip = getClientIp(req);
    const result = await heartbeatShowroomDevice({
      deviceToken: String(deviceToken),
      showroomToken: String(showroomToken),
      ip,
      screenResolution: screenResolution ? String(screenResolution) : undefined,
      currentMode: currentMode ? String(currentMode) : undefined,
      lastError: lastError ? String(lastError) : undefined,
      appVersion: appVersion ? String(appVersion) : undefined
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Heartbeat failed." },
      { status: 500 }
    );
  }
}
