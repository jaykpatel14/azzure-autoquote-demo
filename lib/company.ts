import { cookies } from "next/headers";
import type {
  Company,
  Membership,
  MembershipRole,
  Plan,
  PricingProfile,
  Subscription,
  User
} from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hasMinimumRole } from "@/lib/tenant";

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

export type CompanyContext = {
  user: Pick<User, "id" | "email" | "name" | "sessionVersion"> & {
    memberships: Array<Membership & { company: Company }>;
  };
  company: Company & {
    pricingProfile: PricingProfile | null;
    subscription: (Subscription & { plan: Plan }) | null;
  };
  membership: Membership;
  memberships: Array<Membership & { company: Company }>;
};

export async function getAuthenticatedCompanyContext(): Promise<CompanyContext | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
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

export async function requireCompanyContext(minimumRole?: MembershipRole) {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    throw new AuthRequiredError();
  }

  if (minimumRole && !hasMinimumRole(context.membership.role, minimumRole)) {
    throw new CompanyAccessError("You do not have permission to access this area.");
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
