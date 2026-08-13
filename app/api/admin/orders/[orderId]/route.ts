import { OrderStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternalAdminContext, InternalAdminAccessError } from "@/lib/internal-admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const paramsSchema = z.object({
  orderId: z.string().cuid()
});

const schema = z.object({
  status: z.nativeEnum(OrderStatus),
  notes: z.string().optional(),
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
      select: { id: true, companyId: true }
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: input.status,
        notes: input.notes?.trim() || null,
        reviewedAt: input.status === OrderStatus.SUBMITTED ? null : new Date(),
        productionAt: input.status === OrderStatus.IN_PRODUCTION ? new Date() : undefined,
        completedAt: input.status === OrderStatus.COMPLETED ? new Date() : undefined,
        canceledAt: input.status === OrderStatus.CANCELED ? new Date() : undefined
      }
    });

    await prisma.auditLog.create({
      data: {
        companyId: order.companyId,
        actorUserId: admin.user.id,
        action: "ORDER_STATUS_UPDATED",
        targetType: "Order",
        targetId: order.id,
        metadata: {
          status: input.status,
          notesUpdated: Boolean(input.notes?.trim())
        }
      }
    });

    const redirectTo = input.redirectTo?.trim() || `/admin/orders/${order.id}`;
    return NextResponse.redirect(new URL(redirectTo, request.url), 303);
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
