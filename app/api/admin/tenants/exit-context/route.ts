import { NextResponse } from "next/server";
import { logAuditEvent } from "@/lib/audit";
import { clearActiveCompanyCookie } from "@/lib/company";
import { requireInternalAdminContext, InternalAdminAccessError } from "@/lib/internal-admin";
import { buildPublicUrl } from "@/lib/security";

export const runtime = "nodejs";

export async function POST() {
  try {
    const admin = await requireInternalAdminContext();
    await clearActiveCompanyCookie();
    await logAuditEvent({
      action: "COMPANY_CONTEXT_EXITED",
      companyId: "system",
      actorUserId: admin.user.id,
      targetType: "User",
      targetId: admin.user.id,
      metadata: { fromAdminConsole: true }
    }).catch(() => undefined);

    return NextResponse.redirect(buildPublicUrl("/admin"), 303);
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to exit company context." },
      { status: 400 }
    );
  }
}
