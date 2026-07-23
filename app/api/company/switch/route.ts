import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedCompanyContext, isCompanyMember, setActiveCompanyCookie } from "@/lib/company";
import { logAuditEvent } from "@/lib/audit";

const schema = z.object({
  companyId: z.string().min(1)
});

export async function POST(request: Request) {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  }

  const form = await request.formData();
  const parseResult = schema.safeParse({
    companyId: form.get("companyId")
  });

  if (!parseResult.success) {
    return NextResponse.json({ error: "Company selection is required." }, { status: 400 });
  }

  const { companyId } = parseResult.data;
  if (!isCompanyMember(context, companyId)) {
    return NextResponse.json({ error: "You do not belong to that company." }, { status: 403 });
  }

  await setActiveCompanyCookie(companyId);
  await logAuditEvent({
    action: "COMPANY_SWITCHED",
    companyId,
    actorUserId: context.user.id,
    targetType: "Company",
    targetId: companyId,
    metadata: { fromCompanyId: context.company.id }
  }).catch(() => undefined);

  return NextResponse.redirect(new URL("/", request.url));
}
