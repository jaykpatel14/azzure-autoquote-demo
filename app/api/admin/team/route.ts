import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternalAdminContext, InternalAdminAccessError } from "@/lib/internal-admin";
import { createInternalAdminUser, getInternalAdminUsers } from "@/src/services/admin-team";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().optional(),
  email: z.string().trim().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  adminRole: z.enum(["SUPER_ADMIN", "OPERATIONS_MANAGER", "ESTIMATOR_ADMIN", "SUPPORT_ADMIN"]).default("OPERATIONS_MANAGER")
});

export async function GET() {
  try {
    await requireInternalAdminContext();
    const users = await getInternalAdminUsers();
    return NextResponse.json({ users });
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to fetch admin users." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireInternalAdminContext();
    let body;
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const formData = await request.formData();
      body = {
        name: String(formData.get("name") || ""),
        email: String(formData.get("email") || ""),
        password: String(formData.get("password") || ""),
        adminRole: String(formData.get("adminRole") || "OPERATIONS_MANAGER")
      };
    }

    const parsed = createSchema.parse(body);
    const user = await createInternalAdminUser({
      ...parsed,
      actorAdminId: admin.user.id
    });

    if (!contentType.includes("application/json")) {
      return NextResponse.redirect(new URL("/admin/team", request.url), 303);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        adminRole: user.adminRole
      }
    });
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Invalid input." }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to create backend user.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
