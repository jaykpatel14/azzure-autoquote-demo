import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      sessionVersion: number;
      role: "AZZURE_ADMIN" | "CUSTOMER";
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sessionVersion?: number;
    companyId?: string;
    role?: "AZZURE_ADMIN" | "CUSTOMER";
  }
}
