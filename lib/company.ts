import { cookies } from "next/headers";
import type {
  Company,
  Membership,
  Plan,
  MembershipRole,
  PricingProfile,
  Subscription,
  User
} from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isPrismaConnectionError } from "@/lib/prisma-errors";

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

export type CompanyRole = MembershipRole | "CUSTOMER";

const COMPANY_ROLE_RANK: Record<CompanyRole, number> = {
  VIEWER: 0,
  ESTIMATOR: 1,
  ADMIN: 2,
  OWNER: 3,
  CUSTOMER: 3
};

type CompanyMembershipCompany = Company & {
  pricingProfile: PricingProfile | null;
  subscription: (Subscription & { plan: Plan }) | null;
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
};

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

  let user: CompanyContext["user"] | null = null;
  try {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        sessionVersion: true,
        memberships: {
          select: {
            id: true,
            role: true,
            companyId: true,
            userId: true,
            company: {
              select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
                websiteUrl: true,
                aboutUs: true,
                quoteSequence: true,
                createdAt: true,
                updatedAt: true,
                pricingProfile: true,
                subscription: {
                  include: {
                    plan: true
                  }
                }
              }
            }
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
  if (user.memberships.length === 0) {
    throw new CompanyAccessError("Your account is not assigned to any companies.");
  }

  const cookieStore = await cookies();
  const cookieCompanyId = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value;
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
    company: membership.company
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
