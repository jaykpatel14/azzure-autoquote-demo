import type { Order, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError, type AppResult } from "@/src/lib/errors";

export type OrderTimelineStep = {
  status: OrderStatus;
  label: string;
  completed: boolean;
  timestamp: Date | null;
  note?: string | null;
};

export type OrderPayload = Order & {
  quote: {
    id: string;
    quoteNumber: string;
    customerName: string | null;
    metalType: string;
    estimatedPrice: any;
  };
};

export type OrdersOverview = {
  counts: Record<OrderStatus, number>;
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    itemName: string;
    status: OrderStatus;
    submittedAt: Date;
    updatedAt: Date;
    quoteNumber: string;
  }>;
};

function formatStatusLabel(status: OrderStatus) {
  switch (status) {
    case "SUBMITTED":
      return "Submitted";
    case "IN_REVIEW":
      return "In review";
    case "IN_PRODUCTION":
      return "In production";
    case "COMPLETED":
      return "Completed";
    case "CANCELED":
      return "Canceled";
  }
}

export async function allocateOrderNumber(companyId: string) {
  const [row] = await prisma.$queryRaw<Array<{ maxSequence: number | null }>>`
    SELECT COALESCE(
      MAX(
        CASE
          WHEN "orderNumber" ~ '^OR-[0-9]+$' THEN CAST(SUBSTRING("orderNumber" FROM '[0-9]+$') AS INTEGER)
          ELSE 0
        END
      ),
      0
    ) AS "maxSequence"
    FROM "Order"
    WHERE "companyId" = ${companyId}
  `;

  const maxSequence = row?.maxSequence ?? 0;
  return `OR-${String(maxSequence + 1).padStart(6, "0")}`;
}

export async function createOrderFromQuote(params: {
  companyId: string;
  quoteId: string;
  itemName?: string | null;
  notes?: string | null;
}): Promise<AppResult<OrderPayload>> {
  const quote = await prisma.quote.findFirst({
    where: { id: params.quoteId, companyId: params.companyId },
    include: {
      order: true
    }
  });

  if (!quote) {
    return { error: NotFoundError("Quote") };
  }

  if (quote.order) {
    return { error: ConflictError("That quote already has a manufacturing order.") };
  }

  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await allocateOrderNumber(params.companyId);
    return tx.order.create({
      data: {
        companyId: params.companyId,
        quoteId: quote.id,
        orderNumber,
        itemName: params.itemName?.trim() || quote.quoteNumber,
        notes: params.notes?.trim() || null,
        status: "SUBMITTED",
        submittedAt: new Date()
      },
      include: {
        quote: {
          select: {
            id: true,
            quoteNumber: true,
            customerName: true,
            metalType: true,
            estimatedPrice: true
          }
        }
      }
    });
  });

  return { data: order };
}

export async function getOrder(params: { companyId: string; orderId: string }): Promise<AppResult<OrderPayload>> {
  const order = await prisma.order.findFirst({
    where: {
      id: params.orderId,
      companyId: params.companyId
    },
    include: {
      quote: {
        select: {
          id: true,
          quoteNumber: true,
          customerName: true,
          metalType: true,
          estimatedPrice: true
        }
      }
    }
  });

  if (!order) {
    return { error: NotFoundError("Order") };
  }

  return { data: order };
}

export async function cancelOrder(params: {
  companyId: string;
  orderId: string;
}): Promise<AppResult<{ orderId: string }>> {
  const order = await prisma.order.findFirst({
    where: {
      id: params.orderId,
      companyId: params.companyId
    }
  });

  if (!order) {
    return { error: NotFoundError("Order") };
  }

  if (order.status !== "SUBMITTED") {
    return { error: ConflictError("Only submitted orders can be canceled here.") };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "CANCELED",
      canceledAt: new Date()
    }
  });

  return { data: { orderId: order.id } };
}

export async function getOrdersOverview(companyId: string): Promise<OrdersOverview> {
  const orders = await prisma.order.findMany({
    where: { companyId },
    orderBy: { submittedAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      itemName: true,
      status: true,
      submittedAt: true,
      updatedAt: true,
      quote: {
        select: {
          quoteNumber: true
        }
      }
    }
  });

  const counts = orders.reduce(
    (acc, order) => {
      acc[order.status] += 1;
      return acc;
    },
    {
      SUBMITTED: 0,
      IN_REVIEW: 0,
      IN_PRODUCTION: 0,
      COMPLETED: 0,
      CANCELED: 0
    } as Record<OrderStatus, number>
  );

  return {
    counts,
    recentOrders: orders.slice(0, 3).map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      itemName: order.itemName,
      status: order.status,
      submittedAt: order.submittedAt,
      updatedAt: order.updatedAt,
      quoteNumber: order.quote.quoteNumber
    }))
  };
}

export function getOrderTimeline(order: Pick<Order, "status" | "submittedAt" | "reviewedAt" | "productionAt" | "completedAt" | "canceledAt">): OrderTimelineStep[] {
  const isCanceled = order.status === "CANCELED";
  return [
    {
      status: "SUBMITTED",
      label: formatStatusLabel("SUBMITTED"),
      completed: true,
      timestamp: order.submittedAt,
      note: null
    },
    {
      status: "IN_REVIEW",
      label: formatStatusLabel("IN_REVIEW"),
      completed: ["IN_REVIEW", "IN_PRODUCTION", "COMPLETED"].includes(order.status),
      timestamp: order.reviewedAt,
      note: order.reviewedAt ? "Awaiting internal approval" : null
    },
    {
      status: "IN_PRODUCTION",
      label: formatStatusLabel("IN_PRODUCTION"),
      completed: ["IN_PRODUCTION", "COMPLETED"].includes(order.status),
      timestamp: order.productionAt,
      note: order.productionAt ? "Production has started" : null
    },
    {
      status: "COMPLETED",
      label: formatStatusLabel("COMPLETED"),
      completed: order.status === "COMPLETED",
      timestamp: order.completedAt,
      note: order.completedAt ? "Job completed" : isCanceled ? "Canceled before completion" : null
    }
  ];
}
