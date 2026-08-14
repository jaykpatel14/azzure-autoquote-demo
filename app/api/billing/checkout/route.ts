import { NextResponse } from "next/server";
import { z } from "zod";
import {
  requireCompanyContext,
  AuthRequiredError,
  CompanyAccessError,
  canManageBilling
} from "@/lib/company";
import { createCheckoutSession } from "@/src/services/subscriptions";
import { getRequestBaseUrl } from "@/lib/security";

export const runtime = "nodejs";

const schema = z.object({
  planCode: z.string().trim().min(1).max(50)
});

async function parseInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return schema.parse(await request.json());
  }

  const formData = await request.formData();
  return schema.parse({
    planCode: formData.get("planCode")
  });
}

export async function POST(request: Request) {
  try {
    const context = await requireCompanyContext();
    if (!canManageBilling(context.membership?.role ?? "CUSTOMER")) {
      throw new CompanyAccessError("You do not have permission to manage billing.");
    }
    const input = await parseInput(request);
    const result = await createCheckoutSession({
      companyId: context.company.id,
      companyName: context.company.name,
      email: context.user.email,
      planCode: input.planCode,
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

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid billing request." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start checkout." },
      { status: 400 }
    );
  }
}
