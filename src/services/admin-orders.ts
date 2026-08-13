import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const ADMIN_ORDER_STATUSES: OrderStatus[] = [
  "SUBMITTED",
  "IN_REVIEW",
  "IN_PRODUCTION",
  "COMPLETED",
  "CANCELED"
];

export async function getAdminOrders(status?: OrderStatus | "all") {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    where: status && status !== "all" ? { status } : undefined,
    include: {
      company: {
        select: { id: true, name: true, slug: true }
      },
      quote: true
    }
  });

  return {
    orders,
    counts: {
      total: await prisma.order.count(),
      submitted: await prisma.order.count({ where: { status: "SUBMITTED" } }),
      inReview: await prisma.order.count({ where: { status: "IN_REVIEW" } }),
      inProduction: await prisma.order.count({ where: { status: "IN_PRODUCTION" } }),
      completed: await prisma.order.count({ where: { status: "COMPLETED" } }),
      canceled: await prisma.order.count({ where: { status: "CANCELED" } })
    }
  };
}

export async function getAdminOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      company: {
        include: {
          subscription: {
            include: { plan: true }
          }
        }
      },
      quote: true
    }
  });

  return order;
}
