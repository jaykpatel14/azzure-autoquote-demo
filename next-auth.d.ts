import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    companyId?: string;
    companyName?: string;
    planId?: "plan_starter" | "plan_professional" | "plan_enterprise" | "plan_ultra";
    accountStatus?: "PENDING_APPROVAL" | "APPROVED" | "SUSPENDED";
    pricingTier?: "TIER_1" | "TIER_2" | "TIER_3" | null;
    currency?: "USD" | "CAD";
    ckCustomerVerified?: boolean;
    sessionVersion?: number;
    isInternalAdmin?: boolean;
    adminRole?: "SUPER_ADMIN" | "OPERATIONS_MANAGER" | "ESTIMATOR_ADMIN" | "SUPPORT_ADMIN" | "SALESMAN" | null;
    loginIpAddress?: string | null;
    loginUserAgent?: string | null;
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      sessionVersion: number;
      role: "AZZURE_ADMIN" | "CUSTOMER";
      adminRole?: "SUPER_ADMIN" | "OPERATIONS_MANAGER" | "ESTIMATOR_ADMIN" | "SUPPORT_ADMIN" | "SALESMAN" | null;
      companyId: string;
      companyName: string;
      planId: "plan_starter" | "plan_professional" | "plan_enterprise" | "plan_ultra";
      accountStatus: "PENDING_APPROVAL" | "APPROVED" | "SUSPENDED";
      pricingTier: "TIER_1" | "TIER_2" | "TIER_3" | null;
      currency?: "USD" | "CAD";
      ckCustomerVerified: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sessionVersion?: number;
    companyId?: string;
    companyName?: string;
    currency?: "USD" | "CAD";
    planId?: "plan_starter" | "plan_professional" | "plan_enterprise" | "plan_ultra";
    accountStatus?: "PENDING_APPROVAL" | "APPROVED" | "SUSPENDED";
    pricingTier?: "TIER_1" | "TIER_2" | "TIER_3" | null;
    ckCustomerVerified?: boolean;
    role?: "AZZURE_ADMIN" | "CUSTOMER";
    adminRole?: "SUPER_ADMIN" | "OPERATIONS_MANAGER" | "ESTIMATOR_ADMIN" | "SUPPORT_ADMIN" | "SALESMAN" | null;
  }
}
