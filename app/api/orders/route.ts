import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCompanyContext } from "@/lib/company";
import { sendOrderSubmittedEmail } from "@/lib/order-workflow";
import { submitOrder } from "@/src/services/orders";

export const runtime = "nodejs";

const schema = z.object({
  quoteId: z.string().trim().min(1),
  itemName: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(300).optional()
});

async function parseInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return schema.parse(await request.json());
  }

  const formData = await request.formData();
  return schema.parse({
    quoteId: String(formData.get("quoteId") || ""),
    itemName: String(formData.get("itemName") || ""),
    notes: String(formData.get("notes") || "")
  });
}

export async function POST(request: Request) {
  try {
    const context = await requireCompanyContext();

    const input = await parseInput(request);
    const result = await submitOrder({
      companyId: context.company.id,
      quoteId: input.quoteId,
      itemName: input.itemName,
      notes: input.notes,
      createdBy: context.user.id
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error.userMessage }, { status: result.error.statusCode });
    }

    await sendOrderSubmittedEmail({
      companyName: context.company.name,
      orderNumber: result.data.orderNumber,
      quoteNumber: result.data.quote.quoteNumber,
      itemName: result.data.itemName,
      orderUrl: new URL(`/orders/${result.data.id}`, request.url).toString()
    });

    return NextResponse.redirect(new URL(`/orders/${result.data.id}`, request.url), 303);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid order payload." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create order." },
      { status: 400 }
    );
  }
}
