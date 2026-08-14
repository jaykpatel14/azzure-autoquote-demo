import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      sessionVersion: number;
      role: "AZZURE_ADMIN" | "CUSTOMER";
      companyId: string;
      companyName: string;
      planId: string;
      accountStatus: "PENDING_APPROVAL" | "APPROVED" | "SUSPENDED";
      pricingTier: "TIER_1" | "TIER_2" | "TIER_3" | null;
      ckCustomerVerified: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sessionVersion?: number;
    companyId?: string;
    companyName?: string;
    planId?: string;
    accountStatus?: "PENDING_APPROVAL" | "APPROVED" | "SUSPENDED";
    pricingTier?: "TIER_1" | "TIER_2" | "TIER_3" | null;
    ckCustomerVerified?: boolean;
    role?: "AZZURE_ADMIN" | "CUSTOMER";
  }
}
