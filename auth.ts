import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { logAuditEvent } from "@/lib/audit";
import { isPrismaConnectionError } from "@/lib/prisma-errors";
import { isInternalAdminEmail } from "@/lib/internal-admin";

const credentialsSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(200)
});

function getAuthSecret() {
  const value = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (value) {
    return value;
  }

  console.warn(
    process.env.NODE_ENV === "production"
      ? "AUTH_SECRET is not configured. Using a fallback secret so the build can continue; set AUTH_SECRET before production deployment."
      : "AUTH_SECRET is not configured. Using a development-only fallback secret."
  );
  return "development-only-auth-secret";
}

const authSecret = getAuthSecret();

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/signin",
    error: "/signin"
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        let user;
        try {
          user = await prisma.user.findUnique({
            where: { email: parsed.data.email },
            select: {
              id: true,
              email: true,
              name: true,
              passwordHash: true,
              emailVerifiedAt: true,
              sessionVersion: true,
              memberships: {
                select: {
                  companyId: true,
                  company: {
                    select: {
                      name: true,
                      accountStatus: true,
                      pricingTier: true,
                      ckCustomerVerified: true,
                      subscription: {
                        select: {
                          planId: true
                        }
                      }
                    }
                  }
                },
                take: 1,
                orderBy: {
                  company: {
                    createdAt: "asc"
                  }
                }
              }
            }
          });
        } catch (error) {
          if (isPrismaConnectionError(error)) {
            console.warn("Database is unavailable while authenticating credentials.");
            return null;
          }

          throw error;
        }

        const bypassEmailVerification =
          process.env.BYPASS_EMAIL_VERIFICATION === "true" ||
          process.env.NODE_ENV !== "production";

        if (!user?.passwordHash) {
          return null;
        }

        if (!user.emailVerifiedAt && !bypassEmailVerification) {
          return null;
        }

        if (!verifyPassword(parsed.data.password, user.passwordHash)) {
          return null;
        }

        // Auto-verify user in DB during local bypass if not yet verified
        if (!user.emailVerifiedAt && bypassEmailVerification) {
          await prisma.user
            .update({
              where: { id: user.id },
              data: { emailVerifiedAt: new Date() }
            })
            .catch(() => {});
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          sessionVersion: user.sessionVersion,
          companyId: user.memberships[0]?.companyId ?? "",
          companyName: user.memberships[0]?.company.name ?? "",
          planId: user.memberships[0]?.company.subscription?.planId ?? "plan_starter",
          accountStatus: user.memberships[0]?.company.accountStatus ?? "PENDING_APPROVAL",
          pricingTier: user.memberships[0]?.company.pricingTier ?? null,
          ckCustomerVerified: user.memberships[0]?.company.ckCustomerVerified ?? false
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
        token.sessionVersion = "sessionVersion" in user ? user.sessionVersion ?? 0 : 0;
        token.role = isInternalAdminEmail(user.email) ? "AZZURE_ADMIN" : "CUSTOMER";
        token.companyId = "companyId" in user && typeof user.companyId === "string" ? user.companyId : "";
        token.companyName = "companyName" in user && typeof user.companyName === "string" ? user.companyName : "";
        token.planId =
          "planId" in user && typeof user.planId === "string"
            ? (user.planId as "plan_starter" | "plan_professional" | "plan_enterprise" | "plan_ultra")
            : "plan_starter";
        token.accountStatus =
          "accountStatus" in user && typeof user.accountStatus === "string"
            ? (user.accountStatus as "PENDING_APPROVAL" | "APPROVED" | "SUSPENDED")
            : "PENDING_APPROVAL";
        token.pricingTier =
          "pricingTier" in user && typeof user.pricingTier === "string"
            ? (user.pricingTier as "TIER_1" | "TIER_2" | "TIER_3")
            : null;
        token.ckCustomerVerified =
          "ckCustomerVerified" in user ? Boolean(user.ckCustomerVerified) : false;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.sessionVersion = typeof token.sessionVersion === "number" ? token.sessionVersion : 0;
        session.user.role = token.role === "AZZURE_ADMIN" ? "AZZURE_ADMIN" : "CUSTOMER";
        session.user.companyId = typeof token.companyId === "string" ? token.companyId : "";
        session.user.companyName = typeof token.companyName === "string" ? token.companyName : "";
        session.user.planId =
          typeof token.planId === "string"
            ? (token.planId as "plan_starter" | "plan_professional" | "plan_enterprise" | "plan_ultra")
            : "plan_starter";
        session.user.accountStatus =
          typeof token.accountStatus === "string"
            ? (token.accountStatus as "PENDING_APPROVAL" | "APPROVED" | "SUSPENDED")
            : "PENDING_APPROVAL";
        session.user.pricingTier =
          typeof token.pricingTier === "string"
            ? (token.pricingTier as "TIER_1" | "TIER_2" | "TIER_3")
            : null;
        session.user.ckCustomerVerified = Boolean(token.ckCustomerVerified);
      }

      return session;
    }
  },
  events: {
    async signIn({ user }) {
      if (!user?.id || !user.email) {
        return;
      }

      const role = isInternalAdminEmail(user.email) ? "AZZURE_ADMIN" : "CUSTOMER";
      const companyId = "companyId" in user && typeof user.companyId === "string" && user.companyId ? user.companyId : "";

      if (companyId) {
        await logAuditEvent({
          action: "SIGN_IN",
          actorUserId: user.id,
          targetType: "User",
          targetId: user.id,
          companyId,
          metadata: {
            email: user.email,
            role
          }
        }).catch(() => undefined);
      }
    }
  }
});
