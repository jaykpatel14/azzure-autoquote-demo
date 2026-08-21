import { NextResponse } from "next/server";
import { requireInternalAdminContext, InternalAdminAccessError } from "@/lib/internal-admin";
import { deleteInternalAdminUser } from "@/src/services/admin-team";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const admin = await requireInternalAdminContext();
    const { userId } = await context.params;

    if (userId === admin.user.id) {
      return NextResponse.json({ error: "You cannot revoke your own admin account." }, { status: 400 });
    }

    await deleteInternalAdminUser(userId, admin.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Failed to revoke admin user.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await requireInternalAdminContext();
    const { userId } = await context.params;

    if (userId === admin.user.id) {
      return NextResponse.json({ error: "You cannot revoke your own admin account." }, { status: 400 });
    }

    await deleteInternalAdminUser(userId, admin.user.id);
    return NextResponse.redirect(new URL("/admin/team", request.url), 303);
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    const message = error instanceof Error ? error.message : "Failed to revoke admin user.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
