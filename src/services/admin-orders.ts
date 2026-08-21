import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const ADMIN_ORDER_STATUSES: OrderStatus[] = [
  "SUBMITTED",
  "CK_ORDER_PLACED",
  "CANCELLED",
  "IN_REVIEW",
  "IN_PRODUCTION",
  "COMPLETED",
  "CANCELED"
];

export async function getAdminOrders(status?: OrderStatus | "all") {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    where: status && status !== "all" ? { status } : undefined,
    select: {
      id: true,
      companyId: true,
      orderNumber: true,
      itemName: true,
      status: true,
      ckOrderId: true,
      submittedAt: true,
      createdAt: true,
      updatedAt: true,
      company: {
        select: { id: true, name: true, slug: true }
      },
      quote: {
        select: {
          quoteNumber: true,
          makingPrice: true,
          estimatedSellingPrice: true,
          estimatedPrice: true
        }
      }
    }
  });

  return {
    orders,
    counts: {
      total: await prisma.order.count(),
      submitted: await prisma.order.count({ where: { status: "SUBMITTED" } }),
      ckOrderPlaced: await prisma.order.count({ where: { status: "CK_ORDER_PLACED" } }),
      inReview: await prisma.order.count({ where: { status: "IN_REVIEW" } }),
      inProduction: await prisma.order.count({ where: { status: "IN_PRODUCTION" } }),
      completed: await prisma.order.count({ where: { status: "COMPLETED" } }),
      cancelled: await prisma.order.count({ where: { status: "CANCELLED" } }) + await prisma.order.count({ where: { status: "CANCELED" } })
    }
  };
}

export async function getAdminOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      companyId: true,
      orderNumber: true,
      itemName: true,
      status: true,
      ckOrderId: true,
      ckOrderUrl: true,
      notes: true,
      submittedAt: true,
      reviewedAt: true,
      productionAt: true,
      completedAt: true,
      canceledAt: true,
      cancelledAt: true,
      company: {
        select: { id: true, name: true, slug: true }
      },
      quote: { select: { quoteNumber: true, estimatedPrice: true } },
      timeline: {
        select: { id: true, status: true, note: true, createdAt: true },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  return order;
}
