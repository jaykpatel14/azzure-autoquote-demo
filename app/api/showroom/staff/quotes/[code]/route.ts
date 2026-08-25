import { NextResponse, type NextRequest } from "next/server";
import { validateStaffSession, getStaffQuoteDetail } from "@/lib/showroom-staff";

export const runtime = "nodejs";

function extractStaffToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return req.headers.get("x-staff-token");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const sessionToken = extractStaffToken(req);
    if (!sessionToken) {
      return NextResponse.json({ error: "Staff authentication required." }, { status: 401 });
    }

    const session = await validateStaffSession(sessionToken);
    if (!session) {
      return NextResponse.json({ error: "Staff session expired or invalid." }, { status: 401 });
    }

    const { code } = await params;
    const quote = await getStaffQuoteDetail(session.companyId, code);

    if (!quote) {
      return NextResponse.json({ error: "Quote not found." }, { status: 404 });
    }

    return NextResponse.json({ quote }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch quote details." },
      { status: 500 }
    );
  }
}
