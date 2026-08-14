import { NextResponse } from "next/server";
import {
  requireCompanyContext,
  AuthRequiredError,
  CompanyAccessError,
  canManageBilling
} from "@/lib/company";

export const runtime = "nodejs";

export async function POST() {
  try {
    const context = await requireCompanyContext();
    if (!canManageBilling(context.membership?.role ?? "CUSTOMER")) {
      throw new CompanyAccessError("You do not have permission to manage pricing.");
    }
    return NextResponse.json(
      { error: "Live metal pricing is managed automatically and cannot be edited." },
      { status: 403 }
    );
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof CompanyAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update pricing." },
      { status: 400 }
    );
  }
}
