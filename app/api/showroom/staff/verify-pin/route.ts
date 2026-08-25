import { NextResponse, type NextRequest } from "next/server";
import { verifyKioskStaffPin } from "@/lib/showroom-staff";
import { getClientIp } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { showroomToken, pin } = body;

    if (!showroomToken || typeof showroomToken !== "string") {
      return NextResponse.json({ ok: false, error: "Showroom token is required." }, { status: 400 });
    }

    if (!pin || typeof pin !== "string") {
      return NextResponse.json({ ok: false, error: "4-digit PIN is required." }, { status: 400 });
    }

    const ip = getClientIp(req);
    const result = await verifyKioskStaffPin(showroomToken, pin, ip);

    return NextResponse.json(result, { status: result.status });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "PIN verification failed." },
      { status: 500 }
    );
  }
}
