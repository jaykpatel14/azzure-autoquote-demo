import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { setUserKioskPin, clearUserKioskPin } from "@/lib/showroom-staff";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const context = await getAuthenticatedCompanyContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { pin, action } = body;

    if (action === "clear") {
      await clearUserKioskPin(context.user.id);
      return NextResponse.json({ ok: true, cleared: true }, { status: 200 });
    }

    if (!pin || typeof pin !== "string") {
      return NextResponse.json({ error: "PIN is required." }, { status: 400 });
    }

    const result = await setUserKioskPin(context.user.id, pin);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save kiosk PIN." },
      { status: 400 }
    );
  }
}
