import { cookies } from "next/headers";
import type {
  Company,
  Membership,
  Plan,
  MembershipRole,
  PricingProfile,
  AccountStatus,
  PricingTier,
  Subscription,
  User
} from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isPrismaConnectionError } from "@/lib/prisma-errors";
import { isInternalAdminEmail, getInternalAdminContext } from "@/lib/internal-admin";

export const ACTIVE_COMPANY_COOKIE = "azzure-active-company-id";

export class AuthRequiredError extends Error {
  constructor(message = "Please sign in to continue.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export class CompanyAccessError extends Error {
  constructor(message = "You do not have access to that company.") {
    super(message);
    this.name = "CompanyAccessError";
  }
}

export type CompanyRole = MembershipRole | "CUSTOMER" | "MANUFACTURING";

const COMPANY_ROLE_RANK: Record<CompanyRole, number> = {
  VIEWER: 0,
  ESTIMATOR: 1,
  SALESMAN: 1,
  MANUFACTURING: 1,
  ADMIN: 2,
  OWNER: 3,
  CUSTOMER: 3
};

type CompanyMembershipCompany = Company & {
  pricingProfile: PricingProfile | null;
  subscription: (Subscription & { plan: Plan }) | null;
  accountStatus: AccountStatus;
  pricingTier: PricingTier | null;
  ckCustomerVerified: boolean;
};

type CompanyMembership = Membership & {
  company: CompanyMembershipCompany;
};

export type CompanyContext = {
  user: Pick<User, "id" | "email" | "name" | "sessionVersion"> & {
    memberships: CompanyMembership[];
  };
  company: CompanyMembershipCompany;
  membership: CompanyMembership;
  memberships: CompanyMembership[];
  /** True when this context was synthesized for an internal admin previewing a
   *  tenant's workspace read-only, rather than a real company membership. */
  isImpersonating: boolean;
};

const COMPANY_SELECT = {
  id: true,
  name: true,
  slug: true,
  logoUrl: true,
  websiteUrl: true,
  aboutUs: true,
  primaryColor: true,
  showroomBackgroundColor: true,
  showroomBackgroundMediaKey: true,
  showroomBackgroundMediaType: true,
  showroomOverlayColor: true,
  showroomOverlayOpacity: true,
  showroomTextColor: true,
  showroomBackgroundFit: true,
  showroomBackgroundPosition: true,
  showroomPanelOpacity: true,
  quoteSequence: true,
  accountStatus: true,
  pricingTier: true,
  customerMarginPct: true,
  ckCustomerVerified: true,
  ckCustomerVerifiedAt: true,
  ckCustomerVerifiedBy: true,
  ckCustomerRevokedAt: true,
  ckCustomerNotes: true,
  approvedAt: true,
  approvedBy: true,
  tierChangedAt: true,
  tierChangedBy: true,
  suspendedAt: true,
  suspendedReason: true,
  adminNotes: true,
  createdAt: true,
  updatedAt: true,
  pricingProfile: true,
  subscription: {
    include: {
      plan: true
    }
  }
} as const;

export function getCompanyRoleRank(role: CompanyRole | null | undefined) {
  if (!role) return 0;
  return COMPANY_ROLE_RANK[role] ?? 0;
}

export function hasCompanyRole(
  role: CompanyRole | null | undefined,
  minimumRole: CompanyRole
) {
  return getCompanyRoleRank(role) >= getCompanyRoleRank(minimumRole);
}

export function canCreateQuotes(role: CompanyRole | null | undefined) {
  return hasCompanyRole(role, "ESTIMATOR");
}

export function canManageBilling(role: CompanyRole | null | undefined) {
  return hasCompanyRole(role, "ADMIN");
}

export function canManageTeam(role: CompanyRole | null | undefined) {
  return hasCompanyRole(role, "ADMIN");
}

export function canDeleteQuotes(role: CompanyRole | null | undefined) {
  return hasCompanyRole(role, "ADMIN");
}

export function canViewQuotes(role: CompanyRole | null | undefined) {
  return hasCompanyRole(role, "VIEWER");
}

export function canViewOrders(role: CompanyRole | null | undefined) {
  return hasCompanyRole(role, "MANUFACTURING");
}

export function canManageOrders(role: CompanyRole | null | undefined) {
  return hasCompanyRole(role, "MANUFACTURING");
}

export function isCompanyApproved(company: Pick<CompanyMembershipCompany, "accountStatus">) {
  return company.accountStatus === "APPROVED";
}

export function isCompanySuspended(company: Pick<CompanyMembershipCompany, "accountStatus">) {
  return company.accountStatus === "SUSPENDED";
}

export function assertCompanyRole(
  role: CompanyRole | null | undefined,
  minimumRole: CompanyRole,
  message?: string
) {
  if (!hasCompanyRole(role, minimumRole)) {
    throw new CompanyAccessError(
      message || `You need ${minimumRole.toLowerCase()} access to continue.`
    );
  }
}

export async function getAuthenticatedCompanyContext(): Promise<CompanyContext | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  let user: (CompanyContext["user"] & { isInternalAdmin: boolean }) | null = null;
  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        sessionVersion: true,
        isInternalAdmin: true,
        memberships: {
          select: {
            id: true,
            role: true,
            companyId: true,
            userId: true,
            company: { select: COMPANY_SELECT }
          },
          orderBy: {
            company: { createdAt: "asc" }
          }
        }
      }
    });
  } catch (error) {
    if (isPrismaConnectionError(error)) {
      console.warn("Database is unavailable while loading the company context.");
      return null;
    }

    throw error;
  }

  if (!user) return null;
  if (user.sessionVersion !== session.user.sessionVersion) return null;

  const cookieStore = await cookies();
  const cookieCompanyId = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value;

  if (user.memberships.length === 0) {
    // Internal admin/support staff have no company of their own. If they've opened a
    // tenant's context from the admin console, synthesize a read-only preview instead
    // of treating them as an unaffiliated (and therefore blocked) customer.
    if ((user.isInternalAdmin || isInternalAdminEmail(user.email)) && cookieCompanyId) {
      const company = await prisma.company.findUnique({
        where: { id: cookieCompanyId },
        select: COMPANY_SELECT
      });

      if (!company) return null;

      const impersonatedMembership: CompanyMembership = {
        id: `impersonation:${company.id}`,
        role: "VIEWER",
        companyId: company.id,
        userId: user.id,
        company
      };

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          sessionVersion: user.sessionVersion,
          memberships: [impersonatedMembership]
        },
        membership: impersonatedMembership,
        memberships: [impersonatedMembership],
        company,
        isImpersonating: true
      };
    }

    throw new CompanyAccessError("Your account is not assigned to any companies.");
  }

  const membership =
    user.memberships.find((entry) => entry.companyId === cookieCompanyId) ?? user.memberships[0];

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      sessionVersion: user.sessionVersion,
      memberships: user.memberships
    },
    membership,
    memberships: user.memberships,
    company: membership.company,
    isImpersonating: false
  };
}

export async function requireCompanyContext() {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    throw new AuthRequiredError();
  }

  return context;
}

export function getActiveCompanyIdFromContext(context: CompanyContext) {
  return context.company.id;
}

export function isCompanyMember(
  context: Pick<CompanyContext, "memberships">,
  companyId: string
) {
  return context.memberships.some((membership) => membership.companyId === companyId);
}

export async function clearActiveCompanyCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_COMPANY_COOKIE);
}

export async function setActiveCompanyCookie(companyId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export function toMembershipCompanies(
  memberships: CompanyContext["memberships"]
) {
  return memberships.map((membership) => ({
    id: membership.company.id,
    name: membership.company.name,
    slug: membership.company.slug,
    role: membership.role
  }));
}
export function canAccessShowroomRole(role: CompanyRole | null | undefined) {
  return role !== "SALESMAN" && hasCompanyRole(role, "ESTIMATOR");
}

export function canSeeFullPricing(role: CompanyRole | null | undefined) {
  return role !== "SALESMAN" && hasCompanyRole(role, "ESTIMATOR");
}


export async function requireAdminSalesContext(companyId: string) {
  const adminContext = await getInternalAdminContext();
  if (!adminContext || (adminContext.user.adminRole !== "SALESMAN" && adminContext.user.adminRole !== "SUPER_ADMIN" && adminContext.user.adminRole !== "OPERATIONS_MANAGER")) {
    throw new CompanyAccessError("Not authorized to assign quotes as an admin.");
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: COMPANY_SELECT
  });

  if (!company) {
    throw new CompanyAccessError("Invalid target company.");
  }

  const syntheticMembership = {
    id: "salesman:" + company.id,
    role: "ESTIMATOR" as CompanyRole,
    companyId: company.id,
    userId: adminContext.user.id,
    company: company as any
  };

  return {
    user: adminContext.user,
    membership: syntheticMembership,
    company: company as any,
    memberships: [syntheticMembership],
    isImpersonating: true
  };
}