import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCompanyContext } from "@/lib/company";
import { sendOrderPlacedEmail, sendOrderSubmittedEmail } from "@/lib/order-workflow";
import { submitOrder } from "@/src/services/orders";
import { buildPublicUrl } from "@/lib/security";
import { PlanError } from "@/src/stripe/plans";

export const runtime = "nodejs";

const schema = z.object({
  quoteId: z.string().trim().min(1),
  itemName: z.string().trim().max(200).optional(),
  purchaseOrderNo: z.string().trim().max(100).optional(),
  jobName: z.string().trim().max(200).optional(),
  productType: z.string().trim().optional(),
  metalType: z.string().trim().optional(),
  size: z.string().trim().optional(),
  qty: z.coerce.number().optional(),
  polishLevel: z.string().trim().optional(),
  matchingBand: z.boolean().optional(),
  deliveryDate: z.string().trim().optional(),
  customerEmail: z.string().trim().optional(),
  engraveMessage: z.string().trim().max(100).optional(),
  fontfamily: z.string().trim().optional(),
  notes: z.string().trim().max(1000).optional(),
  centerStoneType: z.string().trim().optional(),
  centerStoneOrigin: z.string().trim().optional(),
  centerStoneShape: z.string().trim().optional(),
  centerStoneCarat: z.coerce.number().optional(),
  centerStoneColor: z.string().trim().optional(),
  centerStoneClarity: z.string().trim().optional(),
  centerStoneProvider: z.string().trim().optional(),
  sideStoneCarat: z.coerce.number().optional(),
  sideStoneQuantity: z.coerce.number().optional(),
  sideStoneShape: z.string().trim().optional(),
  sideStonePlacement: z.string().trim().optional(),
  sideStoneProvider: z.string().trim().optional(),
  stoneSettingType: z.string().trim().optional(),
  stoneSettingDescription: z.string().trim().optional()
});

async function parseInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return { isJson: true, data: schema.parse(await request.json()) };
  }

  const formData = await request.formData();
  return {
    isJson: false,
    data: schema.parse({
      quoteId: String(formData.get("quoteId") || ""),
      itemName: String(formData.get("itemName") || ""),
      notes: String(formData.get("notes") || "")
    })
  };
}

export async function POST(request: Request) {
  try {
    const context = await requireCompanyContext();

    const { isJson, data: input } = await parseInput(request);
    const result = await submitOrder({
      companyId: context.company.id,
      quoteId: input.quoteId,
      itemName: input.itemName || input.jobName,
      notes: input.notes,
      createdBy: context.user.id,
      customKingSpecs: {
        purchaseOrderNo: input.purchaseOrderNo,
        jobName: input.jobName,
        productType: input.productType,
        metalType: input.metalType,
        size: input.size,
        qty: input.qty,
        polishLevel: input.polishLevel,
        matchingBand: input.matchingBand,
        deliveryDate: input.deliveryDate,
        customerEmail: input.customerEmail,
        engraveMessage: input.engraveMessage,
        fontfamily: input.fontfamily,
        centerStoneType: input.centerStoneType,
        centerStoneOrigin: input.centerStoneOrigin,
        centerStoneShape: input.centerStoneShape,
        centerStoneCarat: input.centerStoneCarat,
        centerStoneColor: input.centerStoneColor,
        centerStoneClarity: input.centerStoneClarity,
        centerStoneProvider: input.centerStoneProvider,
        sideStoneCarat: input.sideStoneCarat,
        sideStoneQuantity: input.sideStoneQuantity,
        sideStoneShape: input.sideStoneShape,
        sideStonePlacement: input.sideStonePlacement,
        sideStoneProvider: input.sideStoneProvider,
        stoneSettingType: input.stoneSettingType,
        stoneSettingDescription: input.stoneSettingDescription
      }
    });

    if ("error" in result) {
      return NextResponse.json({ error: { message: result.error.userMessage, code: result.error.statusCode === 404 ? "NOT_FOUND" : "BAD_REQUEST" } }, { status: result.error.statusCode });
    }

    const orderUrl = buildPublicUrl(`/orders/${result.data.id}`).toString();

    if (result.data.ckOrderId) {
      await sendOrderPlacedEmail({
        companyName: context.company.name,
        orderNumber: result.data.orderNumber,
        ckOrderId: result.data.ckOrderId,
        ckOrderUrl: result.data.ckOrderUrl,
        orderUrl
      });
    } else {
      await sendOrderSubmittedEmail({
        companyName: context.company.name,
        orderNumber: result.data.orderNumber,
        quoteNumber: result.data.quote.quoteNumber,
        itemName: result.data.itemName,
        orderUrl
      });
    }

    if (isJson) {
      return NextResponse.json({
        success: true,
        orderId: result.data.id,
        orderNumber: result.data.orderNumber,
        ckOrderId: result.data.ckOrderId,
        ckOrderUrl: result.data.ckOrderUrl
      });
    }

    return NextResponse.redirect(buildPublicUrl(`/orders/${result.data.id}`), 303);
  } catch (error) {
    if (error instanceof PlanError) {
      return NextResponse.json({ error: { message: error.message, code: "UNAUTHORIZED" } }, { status: 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: { message: error.issues[0]?.message || "Invalid order payload.", code: "BAD_REQUEST" } },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : "Unable to create order.", code: "INTERNAL_ERROR" } },
      { status: 500 }
    );
  }
}
