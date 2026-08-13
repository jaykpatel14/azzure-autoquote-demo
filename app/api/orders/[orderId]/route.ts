import { NextResponse } from "next/server";
import { canManageBilling, requireCompanyContext } from "@/lib/company";
import { cancelOrder } from "@/src/services/orders";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const companyContext = await requireCompanyContext();
    if (!canManageBilling(companyContext.membership?.role ?? "CUSTOMER")) {
      return NextResponse.json({ error: "You do not have permission to manage orders." }, { status: 403 });
    }

    const { orderId } = await context.params;
    const result = await cancelOrder({
      companyId: companyContext.company.id,
      orderId
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error.userMessage }, { status: result.error.statusCode });
    }

    return NextResponse.json({ ok: true, orderId: result.data.orderId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to cancel order." },
      { status: 400 }
    );
  }
}
