import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toPricingProfileInput } from "@/lib/metal-pricing";

function toMoney(value: unknown) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(Number.isFinite(amount) ? amount : 0);
}

type AdminTenantListCompany = {
  id: string;
  name: string;
  slug: string;
  currency: string;
  accountStatus: string;
  pricingTier: string | null;
  ckCustomerVerified: boolean;
  ckCustomerVerifiedAt: Date | null;
  ckCustomerVerifiedBy: string | null;
  ckCustomerRevokedAt: Date | null;
  ckCustomerNotes: string | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  tierChangedAt: Date | null;
  tierChangedBy: string | null;
  createdAt: Date;
  subscription: {
    status: string;
    plan: { id: string; name: string; code: string; monthlyLimit: number };
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    trialQuotesUsed: number;
    trialQuoteCap: number;
    overageEnabled: boolean;
    overagePriceCents: number | null;
  } | null;
  memberships: {
    id: string;
    role: string;
    user: { email: string; name: string | null };
  }[];
  quotes: {
    id: string;
    quoteNumber: string;
    estimatedPrice: Prisma.Decimal;
    makingPrice?: Prisma.Decimal | null;
    estimatedSellingPrice?: Prisma.Decimal | null;
    pricingTierSnapshot?: string | null;
    tierDivisorSnapshot?: Prisma.Decimal | null;
    createdAt: Date;
  }[];
  orders: {
    id: string;
    orderNumber: string;
    status: string;
    createdAt: Date;
  }[];
  auditLogs: {
    id: string;
    action: string;
    targetType: string | null;
    createdAt: Date;
    metadata: Prisma.JsonValue | null;
  }[];
  _count: {
    quotes: number;
    orders: number;
    memberships: number;
    auditLogs: number;
    analyses: number;
  };
};

type AdminTenantDetailCompany = AdminTenantListCompany & {
  logoUrl: string | null;
  websiteUrl: string | null;
  aboutUs: string | null;
  quoteSequence: number;
  createdAt: Date;
  updatedAt: Date;
  pricingProfile: any;
  usagePeriods: {
    id: string;
    periodStart: Date;
    periodEnd: Date;
    limit: number;
    used: number;
    reserved: number;
  }[];
  analyses: {
    id: string;
    status: string;
    createdAt: Date;
  }[];
};

export async function getAdminTenants() {
  const companies = (await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      memberships: {
        select: {
          id: true,
          role: true,
          user: { select: { email: true, name: true } }
        }
      },
      subscription: {
        include: { plan: true }
      },
      quotes: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          quoteNumber: true,
          estimatedPrice: true,
          makingPrice: true,
          estimatedSellingPrice: true,
          pricingTierSnapshot: true,
          tierDivisorSnapshot: true,
          createdAt: true
        }
      },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          createdAt: true
        }
      },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 3
      },
      _count: {
        select: {
          quotes: true,
          orders: true,
          memberships: true,
          auditLogs: true,
          analyses: true
        }
      }
    }
  })) as unknown as AdminTenantListCompany[];

  const totalQuotes = companies.reduce((count, company) => count + company._count.quotes, 0);
  const totalOrders = companies.reduce((count, company) => count + company._count.orders, 0);
  const activeSubscriptions = companies.filter((company) =>
    ["TRIALING", "ACTIVE", "PAST_DUE"].includes(company.subscription?.status ?? "")
  ).length;
  const pendingApprovals = companies.filter((company) => company.accountStatus === "PENDING_APPROVAL").length;

  const recentActivity = companies
    .flatMap((company) =>
      company.auditLogs.map((entry) => ({
        id: entry.id,
        companyId: company.id,
        companyName: company.name,
        action: entry.action,
        targetType: entry.targetType,
        createdAt: entry.createdAt,
        description:
          entry.metadata && typeof entry.metadata === "object" && "message" in entry.metadata
            ? String((entry.metadata as Record<string, unknown>).message)
            : entry.action
      }))
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 12);

  return {
    companies,
    stats: {
      totalCompanies: companies.length,
      activeSubscriptions,
      pendingApprovals,
      totalQuotes,
      totalOrders,
      trialingCompanies: companies.filter((company) => company.subscription?.status === "TRIALING").length
    },
    recentActivity
  };
}

export async function getAdminTenant(companyId: string) {
  const company = (await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      subscription: {
        include: { plan: true }
      },
      pricingProfile: true,
      memberships: {
        select: {
          id: true,
          role: true,
          user: { select: { email: true, name: true, createdAt: true } }
        },
        orderBy: { id: "desc" }
      },
      quotes: {
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          order: true
        }
      },
      orders: {
        orderBy: { createdAt: "desc" },
        take: 8,
        include: {
          quote: true
        }
      },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 12
      },
      usagePeriods: {
        orderBy: { periodStart: "desc" },
        take: 4
      },
      analyses: {
        orderBy: { createdAt: "desc" },
        take: 5
      },
      _count: {
        select: {
          quotes: true,
          orders: true,
          memberships: true,
          analyses: true,
          auditLogs: true
        }
      }
    }
  })) as unknown as AdminTenantDetailCompany | null;

  if (!company) {
    return null;
  }

  const pricingProfile = toPricingProfileInput(company.pricingProfile);
  return {
    company,
    pricingProfile,
    stats: {
      quotes: company._count.quotes,
      orders: company._count.orders,
      members: company._count.memberships,
      analyses: company._count.analyses,
      activity: company._count.auditLogs
    },
    recentQuotes: company.quotes,
    recentOrders: company.orders,
    recentActivity: company.auditLogs,
    usagePeriods: company.usagePeriods,
    analyses: company.analyses,
    subscription: company.subscription
  };
}

export async function verifyCkCustomer(params: {
  companyId: string;
  adminUserId: string;
  notes?: string | null;
}) {
  const company = await prisma.$transaction(async (tx) => {
    const updated = await tx.company.update({
      where: { id: params.companyId },
      data: {
        ckCustomerVerified: true,
        ckCustomerVerifiedAt: new Date(),
        ckCustomerVerifiedBy: params.adminUserId,
        ckCustomerRevokedAt: null,
        ckCustomerNotes: params.notes?.trim() || null
      }
    });
    await tx.auditLog.create({ data: {
      action: "CK_CUSTOMER_VERIFIED", companyId: updated.id, actorUserId: params.adminUserId,
      targetType: "Company", targetId: updated.id,
      metadata: { message: "Custom King customer verification approved", ckCustomerVerified: true }
    } });
    return updated;
  });

  return company;
}

export async function revokeCkVerification(params: {
  companyId: string;
  adminUserId: string;
  notes?: string | null;
}) {
  const company = await prisma.$transaction(async (tx) => {
    const updated = await tx.company.update({
      where: { id: params.companyId },
      data: {
        ckCustomerVerified: false,
        ckCustomerVerifiedAt: null,
        ckCustomerVerifiedBy: null,
        ckCustomerRevokedAt: new Date(),
        ckCustomerNotes: params.notes?.trim() || null
      }
    });
    await tx.auditLog.create({ data: {
      action: "CK_VERIFICATION_REVOKED", companyId: updated.id, actorUserId: params.adminUserId,
      targetType: "Company", targetId: updated.id,
      metadata: { message: "Custom King verification revoked", reason: params.notes?.trim() || null }
    } });
    return updated;
  });

  return company;
}

export async function getAdminSubscriptions() {
  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subscription: {
        include: { plan: true }
      },
      usagePeriods: {
        orderBy: { periodStart: "desc" },
        take: 1
      },
      _count: {
        select: { quotes: true, orders: true, memberships: true }
      }
    }
  });

  const rows = companies
    .filter((company) => company.subscription)
    .map((company) => ({
      companyId: company.id,
      companyName: company.name,
      companySlug: company.slug,
      subscription: company.subscription!,
      quotes: company._count.quotes,
      orders: company._count.orders,
      members: company._count.memberships,
      usagePeriod: company.usagePeriods[0] ?? null
    }));

  return {
    rows,
    totals: {
      active: rows.filter((row) => row.subscription.status === "ACTIVE").length,
      trialing: rows.filter((row) => row.subscription.status === "TRIALING").length,
      pastDue: rows.filter((row) => row.subscription.status === "PAST_DUE").length,
      canceled: rows.filter((row) => row.subscription.status === "CANCELED").length
    }
  };
}

export function formatAdminMoney(value: unknown) {
  return toMoney(value);
}

export async function getPendingApprovalCompanies() {
  const companies = await prisma.company.findMany({
    where: { accountStatus: "PENDING_APPROVAL" },
    orderBy: { createdAt: "asc" },
    include: {
      memberships: {
        orderBy: { role: "desc" },
        take: 1,
        select: {
          id: true,
          role: true,
          user: { select: { id: true, email: true, name: true } }
        }
      },
      subscription: {
        include: { plan: true }
      }
    }
  });

  return companies.map((company) => ({
    id: company.id,
    name: company.name,
    slug: company.slug,
    websiteUrl: company.websiteUrl,
    createdAt: company.createdAt,
    pricingTier: company.pricingTier,
    membership: company.memberships[0] ?? null,
    subscription: company.subscription
  }));
}
