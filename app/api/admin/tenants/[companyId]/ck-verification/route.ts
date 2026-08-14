import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternalAdminContext, InternalAdminAccessError } from "@/lib/internal-admin";
import { revokeCkVerification, verifyCkCustomer } from "@/src/services/admin-tenants";

export const runtime = "nodejs";

const paramsSchema = z.object({
  companyId: z.string().cuid()
});

const schema = z.object({
  action: z.enum(["verify", "revoke"]),
  notes: z.string().optional()
});

async function parseInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return schema.parse(await request.json());
  }

  const formData = await request.formData();
  return schema.parse({
    action: String(formData.get("action") || "verify"),
    notes: String(formData.get("notes") || "")
  });
}

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await requireInternalAdminContext();
    const parsedParams = paramsSchema.safeParse(await context.params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: "Invalid company id." }, { status: 400 });
    }

    const input = await parseInput(request);
    if (input.action === "verify") {
      await verifyCkCustomer({
        companyId: parsedParams.data.companyId,
        adminUserId: admin.user.id,
        notes: input.notes
      });
    } else {
      await revokeCkVerification({
        companyId: parsedParams.data.companyId,
        adminUserId: admin.user.id,
        notes: input.notes
      });
    }

    return NextResponse.redirect(new URL(`/admin/tenants/${parsedParams.data.companyId}`, request.url), 303);
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid verification payload." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update CK verification." },
      { status: 400 }
    );
  }
}
