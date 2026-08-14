import { NextResponse } from "next/server";
import {
  requireCompanyContext,
  AuthRequiredError,
  CompanyAccessError,
  canManageBilling
} from "@/lib/company";
import { createBillingPortalSession } from "@/src/services/subscriptions";
import { getRequestBaseUrl } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const context = await requireCompanyContext();
    if (!canManageBilling(context.membership?.role ?? "CUSTOMER")) {
      throw new CompanyAccessError("You do not have permission to manage billing.");
    }
    const result = await createBillingPortalSession({
      companyId: context.company.id,
      baseUrl: getRequestBaseUrl(request)
    });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error.userMessage },
        { status: result.error.statusCode }
      );
    }

    return NextResponse.redirect(result.data.url, 303);
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof CompanyAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to open billing portal." },
      { status: 400 }
    );
  }
}
