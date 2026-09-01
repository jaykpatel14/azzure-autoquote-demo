import { NextResponse, type NextRequest } from "next/server";
import { registerShowroomDevice } from "@/lib/showroom-devices";
import { getClientIp } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { showroomToken, deviceName, platform, userAgent, serialNumber } = body;

    if (!showroomToken || typeof showroomToken !== "string") {
      return NextResponse.json({ error: "Showroom token is required." }, { status: 400 });
    }

    const ip = getClientIp(req);
    const result = await registerShowroomDevice({
      showroomToken,
      deviceName: typeof deviceName === "string" ? deviceName : undefined,
      platform: typeof platform === "string" ? platform : undefined,
      userAgent: typeof userAgent === "string" ? userAgent : req.headers.get("user-agent"),
      ip,
      serialNumber: typeof serialNumber === "string" && serialNumber.trim() ? serialNumber.trim() : undefined
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to register showroom device." },
      { status: 500 }
    );
  }
}
