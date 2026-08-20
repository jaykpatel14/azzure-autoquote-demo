import { OrderStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternalAdminContext, InternalAdminAccessError } from "@/lib/internal-admin";
import { sendOrderCompletedEmail, sendOrderPlacedEmail } from "@/lib/order-workflow";
import { prisma } from "@/lib/prisma";
import { assignCkOrderId, cancelOrder, completeOrder } from "@/src/services/orders";
import { buildPublicUrl } from "@/lib/security";
import { dispatchCustomKingOrder } from "@/lib/customking-api";


export const runtime = "nodejs";

const paramsSchema = z.object({
  orderId: z.string().cuid()
});

const schema = z.object({
  status: z.nativeEnum(OrderStatus),
  notes: z.string().optional(),
  ckOrderId: z.string().optional(),
  ckOrderUrl: z.string().optional(),
  redirectTo: z.string().optional()
});

async function parseInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return schema.parse(await request.json());
  }

  const formData = await request.formData();
  return schema.parse({
    status: String(formData.get("status") || OrderStatus.SUBMITTED),
    notes: String(formData.get("notes") || ""),
    ckOrderId: String(formData.get("ckOrderId") || ""),
    ckOrderUrl: String(formData.get("ckOrderUrl") || ""),
    redirectTo: String(formData.get("redirectTo") || "")
  });
}

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await requireInternalAdminContext();
    const parsedParams = paramsSchema.safeParse(await context.params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: "Invalid order id." }, { status: 400 });
    }

    const input = await parseInput(request);
    const order = await prisma.order.findUnique({
      where: { id: parsedParams.data.orderId },
      select: {
        id: true,
        companyId: true,
        orderNumber: true,
        company: {
          select: {
            name: true
          }
        }
      }
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (input.status === OrderStatus.CK_ORDER_PLACED) {
      let finalCkId = input.ckOrderId?.trim() || "";
      let finalCkUrl = input.ckOrderUrl?.trim() || null;

      // Try automatic dispatch to CustomKing Staging API if no manual ID provided
      if (!finalCkId) {
        try {
          const fullOrder = await prisma.order.findUnique({
            where: { id: order.id },
            include: { quote: true }
          });

          if (fullOrder && fullOrder.quote) {
            const ckResult = await dispatchCustomKingOrder({
              companyId: order.companyId,
              companyName: order.company.name || null,
              customerName: fullOrder.quote.customerName || null,
              orderId: order.id,
              orderNumber: order.orderNumber,
              itemName: fullOrder.itemName,
              quoteNumber: fullOrder.quote.quoteNumber,
              metalType: fullOrder.quote.metalType,
              metalWeightGrams: Number(fullOrder.quote.metalWeightGrams || 6),
              centerDiamondCarats: Number(fullOrder.quote.centerDiamondCarats || 1),
              sideDiamondCarats: Number(fullOrder.quote.sideDiamondCarats || 0),
              customerNotes: fullOrder.notes
            });

            finalCkId = ckResult.ckOrderId;
            finalCkUrl = ckResult.ckOrderUrl;
          }
        } catch (e) {
          console.warn("[CustomKing Staging Dispatch]", e);
        }
      }

      if (!finalCkId) {
        finalCkId = order.orderNumber;
      }

      const result = await assignCkOrderId({
        companyId: order.companyId,
        orderId: order.id,
        ckOrderId: finalCkId,
        ckOrderUrl: finalCkUrl,
        placedBy: admin.user.id,
        adminUserId: admin.user.id
      });

      if ("error" in result) {
        return NextResponse.json({ error: result.error.userMessage }, { status: result.error.statusCode });
      }

      await sendOrderPlacedEmail({
        companyName: order.company.name,
        orderNumber: order.orderNumber,
        ckOrderId: finalCkId,
        ckOrderUrl: finalCkUrl,
        orderUrl: buildPublicUrl(`/admin/orders/${order.id}`).toString()
      });
    } else if (input.status === OrderStatus.COMPLETED) {
      const result = await completeOrder({
        companyId: order.companyId,
        orderId: order.id,
        completedBy: admin.user.id,
        internalNote: input.notes
      });

      if ("error" in result) {
        return NextResponse.json({ error: result.error.userMessage }, { status: result.error.statusCode });
      }

      await sendOrderCompletedEmail({
        companyName: order.company.name,
        orderNumber: order.orderNumber,
        orderUrl: buildPublicUrl(`/admin/orders/${order.id}`).toString()
      });
    } else if (input.status === OrderStatus.CANCELLED || input.status === OrderStatus.CANCELED) {
      const result = await cancelOrder({
        companyId: order.companyId,
        orderId: order.id,
        reason: input.notes,
        cancelledBy: admin.user.id,
        isAdminAction: true
      });

      if ("error" in result) {
        return NextResponse.json({ error: result.error.userMessage }, { status: result.error.statusCode });
      }
    } else {
      const isSubmitted = input.status === OrderStatus.SUBMITTED;
      const isInProduction = input.status === OrderStatus.IN_PRODUCTION;
      await prisma.order.update({
        where: { id: order.id },
        data: {
          status: input.status,
          notes: input.notes?.trim() || null,
          reviewedAt: isSubmitted ? null : new Date(),
          productionAt: isInProduction ? new Date() : undefined
        }
      });
    }

    await prisma.auditLog.create({
      data: {
        companyId: order.companyId,
        actorUserId: admin.user.id,
        action:
          input.status === OrderStatus.CK_ORDER_PLACED
            ? "CK_ORDER_ID_ASSIGNED"
            : input.status === OrderStatus.COMPLETED
              ? "ORDER_COMPLETED"
              : "ORDER_STATUS_UPDATED",
        targetType: "Order",
        targetId: order.id,
        metadata: {
          status: input.status,
          notesUpdated: Boolean(input.notes?.trim())
        }
      }
    });

    const redirectTo = input.redirectTo?.trim() || `/admin/orders/${order.id}`;
    return NextResponse.redirect(buildPublicUrl(redirectTo), 303);
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid order payload." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update order." },
      { status: 400 }
    );
  }
}
