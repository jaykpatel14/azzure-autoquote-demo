import { prisma } from "@/lib/prisma";

export type LeadItem = {
  id: string;
  quoteNumber: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  jewelryType: string;
  metalType: string;
  estimatedPrice: number;
  centerDiamondCarats: number;
  createdAt: Date;
  source: "Showroom Kiosk" | "Private Share" | "Associate Workbench";
  showroomDisplayCode: string | null;
  notes: string | null;
  hasOrder: boolean;
  orderStatus: string | null;
};

export type LeadsSummary = {
  leads: LeadItem[];
  totalLeads: number;
  contactableCount: number;
  phoneCount: number;
  emailCount: number;
  showroomCount: number;
  totalPipelineValue: number;
  jewelryTypes: string[];
};

export async function getLeadsData(
  companyId: string,
  options?: { query?: string; jewelryType?: string }
): Promise<LeadsSummary> {
  const quotes = await prisma.quote.findMany({
    where: {
      companyId,
      // We prioritize quotes that have at least some customer contact data or showroom origin
      OR: [
        { customerName: { not: null } },
        { customerEmail: { not: null } },
        { customerPhone: { not: null } },
        { showroomQuote: { isNot: null } }
      ]
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      quoteNumber: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      metalType: true,
      metalWeightGrams: true,
      centerDiamondCarats: true,
      estimatedPrice: true,
      estimatedSellingPrice: true,
      publicShareToken: true,
      sharedAt: true,
      notes: true,
      createdAt: true,
      analysis: {
        select: {
          jewelryType: true,
          centerShape: true,
          settingType: true
        }
      },
      showroomQuote: {
        select: {
          displayCode: true,
          status: true,
          customerNotes: true
        }
      },
      order: {
        select: {
          id: true,
          status: true
        }
      }
    }
  });

  const allLeads: LeadItem[] = quotes.map((q) => {
    // Derive Jewelry Type
    let jewelryType = q.analysis?.jewelryType?.trim();
    if (!jewelryType) {
      // Fallback heuristics from notes or metal/stone
      const lowerNotes = (q.notes || "").toLowerCase();
      if (lowerNotes.includes("pendant")) jewelryType = "Pendant";
      else if (lowerNotes.includes("bracelet")) jewelryType = "Bracelet";
      else if (lowerNotes.includes("necklace")) jewelryType = "Necklace";
      else if (lowerNotes.includes("earring")) jewelryType = "Earrings";
      else if (lowerNotes.includes("grill")) jewelryType = "Grillz";
      else jewelryType = "Ring";
    }

    // Capitalize nicely
    jewelryType = jewelryType.charAt(0).toUpperCase() + jewelryType.slice(1);

    // Derive lead source
    let source: "Showroom Kiosk" | "Private Share" | "Associate Workbench" = "Associate Workbench";
    if (q.showroomQuote) {
      source = "Showroom Kiosk";
    } else if (q.sharedAt || q.publicShareToken) {
      source = "Private Share";
    }

    const price = q.estimatedSellingPrice ? Number(q.estimatedSellingPrice) : Number(q.estimatedPrice);

    return {
      id: q.id,
      quoteNumber: q.quoteNumber,
      customerName: q.customerName?.trim() || (q.showroomQuote ? `Showroom Guest (${q.showroomQuote.displayCode})` : "Walk-in Prospect"),
      customerEmail: q.customerEmail?.trim() || null,
      customerPhone: q.customerPhone?.trim() || null,
      jewelryType,
      metalType: q.metalType,
      estimatedPrice: price,
      centerDiamondCarats: Number(q.centerDiamondCarats || 0),
      createdAt: q.createdAt,
      source,
      showroomDisplayCode: q.showroomQuote?.displayCode || null,
      notes: q.notes || q.showroomQuote?.customerNotes || null,
      hasOrder: Boolean(q.order),
      orderStatus: q.order?.status || null
    };
  });

  // Unique jewelry types for filter dropdown
  const uniqueTypes = Array.from(new Set(allLeads.map((l) => l.jewelryType))).filter(Boolean).sort();

  // Apply filters if provided
  let filtered = allLeads;
  if (options?.jewelryType && options.jewelryType !== "all") {
    filtered = filtered.filter(
      (l) => l.jewelryType.toLowerCase() === options.jewelryType?.toLowerCase()
    );
  }

  if (options?.query && options.query.trim()) {
    const q = options.query.toLowerCase().trim();
    filtered = filtered.filter(
      (l) =>
        l.customerName.toLowerCase().includes(q) ||
        (l.customerEmail && l.customerEmail.toLowerCase().includes(q)) ||
        (l.customerPhone && l.customerPhone.toLowerCase().includes(q)) ||
        l.quoteNumber.toLowerCase().includes(q) ||
        l.jewelryType.toLowerCase().includes(q) ||
        l.metalType.toLowerCase().includes(q)
    );
  }

  const phoneCount = allLeads.filter((l) => Boolean(l.customerPhone)).length;
  const emailCount = allLeads.filter((l) => Boolean(l.customerEmail)).length;
  const contactableCount = allLeads.filter((l) => Boolean(l.customerPhone || l.customerEmail)).length;
  const showroomCount = allLeads.filter((l) => l.source === "Showroom Kiosk").length;
  const totalPipelineValue = allLeads.reduce((acc, curr) => acc + curr.estimatedPrice, 0);

  return {
    leads: filtered,
    totalLeads: allLeads.length,
    contactableCount,
    phoneCount,
    emailCount,
    showroomCount,
    totalPipelineValue,
    jewelryTypes: uniqueTypes
  };
}
