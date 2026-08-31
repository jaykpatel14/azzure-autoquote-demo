import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getCompanyPlanFeatures } from "@/src/stripe/plans";
import { prisma } from "@/lib/prisma";
import {
  queueRemoteCommand,
  RemoteKioskCommandType
} from "@/lib/showroom-devices";

export const runtime = "nodejs";

const commandSchema = z.object({
  command: z.enum([
    "reload",
    "clear_cache",
    "set_mode_marketing",
    "set_mode_quoting",
    "reset_draft",
    "run_diagnostics"
  ]),
  payload: z.record(z.string(), z.unknown()).optional()
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getAuthenticatedCompanyContext();
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { features } = await getCompanyPlanFeatures(context.company.id);
    if (!features.canUseShowroomMode) {
      return NextResponse.json({ error: "Showroom Mode plan upgrade required." }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = commandSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid command payload.", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const device = await prisma.showroomDevice.findFirst({
      where: {
        id,
        companyId: context.company.id,
        isActive: true
      },
      select: {
        id: true,
        deviceToken: true,
        deviceName: true
      }
    });

    if (!device) {
      return NextResponse.json({ error: "Device not found or not active." }, { status: 404 });
    }

    const cmd = queueRemoteCommand(
      device.deviceToken,
      parsed.data.command as RemoteKioskCommandType,
      parsed.data.payload
    );

    return NextResponse.json({
      ok: true,
      message: `Command '${parsed.data.command}' queued for ${device.deviceName}.`,
      command: cmd
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to dispatch remote command." },
      { status: 500 }
    );
  }
}
