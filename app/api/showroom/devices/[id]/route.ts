import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { renameShowroomDevice, deactivateShowroomDevice } from "@/lib/showroom-devices";
import { getCompanyPlanFeatures } from "@/src/stripe/plans";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getAuthenticatedCompanyContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { features } = await getCompanyPlanFeatures(context.company.id);
    if (!features.canUseShowroomMode) {
      return NextResponse.json({ error: "Enterprise plan required." }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { deviceName } = body;

    if (!deviceName || typeof deviceName !== "string" || !deviceName.trim()) {
      return NextResponse.json({ error: "Device name is required." }, { status: 400 });
    }

    const result = await renameShowroomDevice(context.company.id, id, deviceName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update device." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getAuthenticatedCompanyContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { features } = await getCompanyPlanFeatures(context.company.id);
    if (!features.canUseShowroomMode) {
      return NextResponse.json({ error: "Enterprise plan required." }, { status: 403 });
    }

    const { id } = await params;
    const result = await deactivateShowroomDevice(context.company.id, id);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to deactivate device." },
      { status: 400 }
    );
  }
}
