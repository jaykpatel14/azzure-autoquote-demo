import type { Company, Order, OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError, type AppError, type AppResult } from "@/src/lib/errors";
import { assertPlanFeature } from "@/src/stripe/plans";
import { dispatchCustomKingOrder } from "@/lib/customking-api";
import { loadQuoteRenderingDataUrlFromS3 } from "@/lib/quote-pdf-s3";
import { generateAndStoreQuotePdf } from "@/src/services/quote-pdf";

export type OrderTimelineStep = {
  status: OrderStatus | "SUBMITTED" | "CK_ORDER_PLACED" | "CANCELLED";
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
    estimatedSellingPrice: any;
  };
  timeline?: Array<{
    id: string;
    status: OrderStatus;
    note: string | null;
    internalNote: string | null;
    createdAt: Date;
    createdBy: string;
    isAdminAction: boolean;
  }>;
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

function formatStatusLabel(status: string) {
  switch (status) {
    case "SUBMITTED":
      return "Submitted";
    case "CK_ORDER_PLACED":
      return "CK order placed";
    case "IN_REVIEW":
      return "In review";
    case "IN_PRODUCTION":
      return "In production";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
    case "CANCELED":
      return "Cancelled";
    default:
      return status
        .toLowerCase()
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
  }
}

function isActiveOrderStatus(status: OrderStatus) {
  return !["COMPLETED", "CANCELED", "CANCELLED"].includes(status);
}

export function canPlaceOrder(
  company: Pick<Company, "accountStatus" | "ckCustomerVerified" | "ckCustomerVerifiedAt">
) {
  return company.accountStatus === "APPROVED" && company.ckCustomerVerified;
}

export function getOrderPlacementError(
  company: Pick<Company, "accountStatus" | "ckCustomerVerified" | "ckCustomerVerifiedAt">
): AppError | null {
  if (company.accountStatus === "PENDING_APPROVAL") {
    return ConflictError("This company still needs approval before manufacturing orders can be placed.");
  }

  if (company.accountStatus === "SUSPENDED") {
    return ConflictError("This company is suspended and cannot place manufacturing orders.");
  }

  if (!company.ckCustomerVerified) {
    return ConflictError("Custom King verification is required before placing manufacturing orders.");
  }

  return null;
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

async function createOrderEvent(params: {
  orderId: string;
  status: OrderStatus;
  note?: string | null;
  internalNote?: string | null;
  createdBy: string;
  isAdminAction?: boolean;
}) {
  await prisma.orderEvent.create({
    data: {
      orderId: params.orderId,
      status: params.status,
      note: params.note?.trim() || null,
      internalNote: params.internalNote?.trim() || null,
      createdBy: params.createdBy,
      isAdminAction: params.isAdminAction ?? false
    }
  });
}

export async function submitOrder(params: {
  companyId: string;
  quoteId: string;
  itemName?: string | null;
  notes?: string | null;
  createdBy?: string | null;
}): Promise<AppResult<OrderPayload>> {
  await assertPlanFeature(params.companyId, "canPlaceManufacturingOrder");
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

  if (!quote.pdfStoredAt) {
    // Finalize the quote automatically instead of forcing a separate download step.
    const pdfResult = await generateAndStoreQuotePdf({
      quoteId: quote.id,
      companyId: params.companyId
    });
    if ("error" in pdfResult) {
      return { error: pdfResult.error };
    }
  }

  const company = await prisma.company.findUnique({
    where: { id: params.companyId },
    select: {
      accountStatus: true,
      ckCustomerVerified: true,
      ckCustomerVerifiedAt: true
    }
  });

  if (!company) {
    return { error: NotFoundError("Company") };
  }

  const accessError = getOrderPlacementError(company);
  if (accessError) {
    return { error: accessError };
  }

  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await allocateOrderNumber(params.companyId);
    const createdOrder = await tx.order.create({
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
            estimatedPrice: true,
            estimatedSellingPrice: true
          }
        },
        timeline: true
      }
    });

    await tx.orderEvent.create({
      data: {
        orderId: createdOrder.id,
        status: "SUBMITTED",
        note: "Manufacturing order submitted",
        createdBy: params.createdBy ?? params.companyId,
        isAdminAction: false
      }
    });

    return createdOrder;
  });

  // Automatically dispatch to Custom King right away. If this fails (network
  // issue, CK API down, etc.) the order stays SUBMITTED and Azzure staff can
  // still push it manually from the admin console.
  try {
    const renderingImageUrl = quote.renderingStorageKey
      ? await loadQuoteRenderingDataUrlFromS3(quote.renderingStorageKey)
      : quote.renderingDataUrl;

    const ckResult = await dispatchCustomKingOrder({
      companyId: params.companyId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      itemName: order.itemName,
      quoteNumber: quote.quoteNumber,
      metalType: quote.metalType,
      metalWeightGrams: Number(quote.metalWeightGrams),
      centerDiamondCarats: Number(quote.centerDiamondCarats),
      sideDiamondCarats: Number(quote.sideDiamondCarats),
      customerNotes: order.notes,
      renderingImageUrl
    });

    const dispatched = await assignCkOrderId({
      companyId: params.companyId,
      orderId: order.id,
      ckOrderId: ckResult.ckOrderId,
      ckOrderUrl: ckResult.ckOrderUrl,
      placedBy: params.createdBy,
      isAdminAction: false
    });

    if (!("error" in dispatched)) {
      return { data: dispatched.data };
    }
  } catch (dispatchError) {
    console.warn("[CustomKing auto-dispatch]", dispatchError);
  }

  return { data: order };
}

export async function createOrderFromQuote(params: {
  companyId: string;
  quoteId: string;
  itemName?: string | null;
  notes?: string | null;
  createdBy?: string | null;
}): Promise<AppResult<OrderPayload>> {
  return submitOrder(params);
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
          estimatedPrice: true,
          estimatedSellingPrice: true
        }
      },
      timeline: {
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!order) {
    return { error: NotFoundError("Order") };
  }

  return { data: order };
}

export async function assignCkOrderId(params: {
  companyId: string;
  orderId: string;
  ckOrderId: string;
  ckOrderUrl?: string | null;
  placedBy?: string | null;
  adminUserId?: string | null;
  isAdminAction?: boolean;
}): Promise<AppResult<OrderPayload>> {
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
          estimatedPrice: true,
          estimatedSellingPrice: true
        }
      },
      timeline: {
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!order) {
    return { error: NotFoundError("Order") };
  }

  if (!isActiveOrderStatus(order.status)) {
    return { error: ConflictError("Only active orders can be sent to Custom King.") };
  }

  if (order.ckOrderId && order.ckOrderId !== params.ckOrderId.trim()) {
    return { error: ConflictError("That order already has a different Custom King order id.") };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "CK_ORDER_PLACED",
        ckOrderId: params.ckOrderId.trim(),
        ckOrderUrl: params.ckOrderUrl?.trim() || null,
        ckOrderPlacedAt: new Date(),
        ckOrderPlacedBy: params.placedBy?.trim() || null
      },
      include: {
        quote: {
          select: {
            id: true,
            quoteNumber: true,
            customerName: true,
            metalType: true,
            estimatedPrice: true,
            estimatedSellingPrice: true
          }
        },
        timeline: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    const isAdminAction = params.isAdminAction ?? true;
    await tx.orderEvent.create({
      data: {
        orderId: nextOrder.id,
        status: "CK_ORDER_PLACED",
        note: isAdminAction ? "Order placed with Custom King" : "Order automatically placed with Custom King",
        internalNote: params.ckOrderId.trim(),
        createdBy: params.adminUserId ?? params.placedBy ?? params.companyId,
        isAdminAction
      }
    });

    return nextOrder;
  });

  return { data: updated };
}

export async function completeOrder(params: {
  companyId: string;
  orderId: string;
  completedBy?: string | null;
  internalNote?: string | null;
}): Promise<AppResult<OrderPayload>> {
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
          estimatedPrice: true,
          estimatedSellingPrice: true
        }
      },
      timeline: {
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!order) {
    return { error: NotFoundError("Order") };
  }

  if (!isActiveOrderStatus(order.status)) {
    return { error: ConflictError("This order cannot be completed in its current state.") };
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        completedBy: params.completedBy?.trim() || null
      },
      include: {
        quote: {
          select: {
            id: true,
            quoteNumber: true,
            customerName: true,
            metalType: true,
            estimatedPrice: true,
            estimatedSellingPrice: true
          }
        },
        timeline: {
          orderBy: { createdAt: "asc" }
        }
      }
    });

    await tx.orderEvent.create({
      data: {
        orderId: nextOrder.id,
        status: "COMPLETED",
        note: "Order marked complete",
        internalNote: params.internalNote?.trim() || null,
        createdBy: params.completedBy ?? params.companyId,
        isAdminAction: true
      }
    });

    return nextOrder;
  });

  return { data: updated };
}

export async function cancelOrder(params: {
  companyId: string;
  orderId: string;
  reason?: string | null;
  cancelledBy?: string | null;
  isAdminAction?: boolean;
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

  if (!isActiveOrderStatus(order.status)) {
    return { error: ConflictError("This order cannot be canceled in its current state.") };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledBy: params.cancelledBy?.trim() || null,
      cancellationReason: params.reason?.trim() || null
    }
  });

  await createOrderEvent({
    orderId: order.id,
    status: "CANCELLED",
    note: params.reason?.trim() || "Order canceled",
    internalNote: params.reason?.trim() || null,
    createdBy: params.cancelledBy ?? params.companyId,
    isAdminAction: params.isAdminAction ?? false
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
      CK_ORDER_PLACED: 0,
      CANCELLED: 0,
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

export function getOrderTimeline(
  order: Pick<
    Order,
    | "status"
    | "submittedAt"
    | "reviewedAt"
    | "productionAt"
    | "completedAt"
    | "canceledAt"
    | "cancelledAt"
    | "ckOrderPlacedAt"
    | "ckOrderId"
  > & {
    timeline?: Array<{
      status: OrderStatus;
      note: string | null;
      internalNote: string | null;
      createdAt: Date;
      createdBy: string;
      isAdminAction: boolean;
    }>;
  }
): OrderTimelineStep[] {
  const hasLegacyReview = Boolean(order.reviewedAt || order.productionAt || order.completedAt);
  const cancellationTime = order.cancelledAt ?? order.canceledAt ?? null;
  const cancelledStatus = order.status === "CANCELLED" || order.status === "CANCELED";
  const steps: OrderTimelineStep[] = [
    {
      status: "SUBMITTED",
      label: formatStatusLabel("SUBMITTED"),
      completed: true,
      timestamp: order.submittedAt,
      note: null
    },
    {
      status: "CK_ORDER_PLACED",
      label: formatStatusLabel("CK_ORDER_PLACED"),
      completed: Boolean(order.ckOrderPlacedAt) || ["CK_ORDER_PLACED", "COMPLETED"].includes(order.status),
      timestamp: order.ckOrderPlacedAt,
      note: order.ckOrderId ? `CK Order ID: ${order.ckOrderId}` : null
    }
  ];

  if (hasLegacyReview) {
    steps.push(
      {
        status: "IN_REVIEW",
        label: formatStatusLabel("IN_REVIEW"),
        completed: ["IN_REVIEW", "IN_PRODUCTION", "COMPLETED"].includes(order.status),
        timestamp: order.reviewedAt ?? null,
        note: order.reviewedAt ? "Awaiting internal approval" : null
      },
      {
        status: "IN_PRODUCTION",
        label: formatStatusLabel("IN_PRODUCTION"),
        completed: ["IN_PRODUCTION", "COMPLETED"].includes(order.status),
        timestamp: order.productionAt ?? null,
        note: order.productionAt ? "Production has started" : null
      }
    );
  }

  steps.push({
    status: "COMPLETED",
    label: formatStatusLabel("COMPLETED"),
    completed: order.status === "COMPLETED",
    timestamp: order.completedAt ?? null,
    note: order.completedAt ? "Job completed" : cancelledStatus ? "Canceled before completion" : null
  });

  if (cancelledStatus) {
    steps.push({
      status: "CANCELLED",
      label: formatStatusLabel("CANCELLED"),
      completed: true,
      timestamp: cancellationTime,
      note: order.timeline?.find((event) => event.status === "CANCELLED" || event.status === "CANCELED")?.note ?? "Order canceled"
    });
  }

  return steps;
}
