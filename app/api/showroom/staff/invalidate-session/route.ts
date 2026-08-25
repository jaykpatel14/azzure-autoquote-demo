import { NextResponse, type NextRequest } from "next/server";
import { invalidateStaffSession } from "@/lib/showroom-staff";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const authHeader = req.headers.get("authorization");
    const sessionToken =
      body.sessionToken ||
      (authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null) ||
      req.headers.get("x-staff-token");

    if (sessionToken) {
      await invalidateStaffSession(String(sessionToken));
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to invalidate session." },
      { status: 500 }
    );
  }
}
