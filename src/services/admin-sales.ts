import { prisma } from "@/lib/prisma";

export async function getAdminSalesQuotes() {
  const quotes = await prisma.quote.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      company: {
        select: { name: true }
      }
    }
  });

  const companies = await prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } });

  return { quotes, companies };
}
