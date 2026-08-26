import { NextResponse, type NextRequest } from "next/server";
import { getClientIp } from "@/lib/security";
import { activateAzzureDevice } from "@/lib/azzure-devices";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { serialNumber, showroomToken, deviceName, platform, userAgent } = body;

    if (!serialNumber || typeof serialNumber !== "string") {
      return NextResponse.json({ error: "Serial number is required." }, { status: 400 });
    }

    if (!showroomToken || typeof showroomToken !== "string") {
      return NextResponse.json({ error: "Showroom token is required." }, { status: 400 });
    }

    if (!deviceName || typeof deviceName !== "string") {
      return NextResponse.json({ error: "Device name is required." }, { status: 400 });
    }

    const result = await activateAzzureDevice({
      serialNumber,
      showroomToken,
      deviceName,
      platform: typeof platform === "string" ? platform : undefined,
      userAgent: typeof userAgent === "string" ? userAgent : req.headers.get("user-agent"),
      ip: getClientIp(req)
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to activate showroom device." },
      { status: 500 }
    );
  }
}
