import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { logAuditEvent } from "@/lib/audit";
import { isPrismaConnectionError } from "@/lib/prisma-errors";
import { isInternalAdminEmail } from "@/lib/internal-admin";
import { normalizeIpAddress } from "@/lib/ip-access";
import { getClientIp } from "@/lib/security";

const credentialsSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(200)
});

function truncateRequestValue(value: string | null, maxLength: number) {
  if (!value) return null;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

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
      async authorize(rawCredentials, request) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const loginIpAddress = normalizeIpAddress(getClientIp(request));
        if (loginIpAddress) {
          try {
            const blockedIp = await prisma.blockedIp.findUnique({
              where: { ipAddress: loginIpAddress },
              select: { id: true }
            });

            if (blockedIp) {
              await logAuditEvent({
                action: "BLOCKED_IP_ATTEMPT",
                companyId: null,
                targetType: "BlockedIp",
                targetId: blockedIp.id,
                ipAddress: loginIpAddress,
                userAgent: truncateRequestValue(request.headers.get("user-agent"), 500),
                metadata: {
                  path: "/api/auth/callback/credentials",
                  method: "POST",
                  email: parsed.data.email
                }
              }).catch(() => undefined);
              return null;
            }
          } catch (error) {
            console.warn("Unable to verify IP access policy during sign-in.", error);
          }
        }

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
              isInternalAdmin: true,
              adminRole: true,
              memberships: {
                select: {
                  companyId: true,
                  company: {
                    select: {
                      name: true,
                      currency: true,
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

        const isAdmin = isInternalAdminEmail(user.email) || Boolean(user.isInternalAdmin);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          sessionVersion: user.sessionVersion,
          isInternalAdmin: isAdmin,
          adminRole: (user.adminRole || (isAdmin ? "SUPER_ADMIN" : null)) as
            | "SUPER_ADMIN"
            | "OPERATIONS_MANAGER"
            | "ESTIMATOR_ADMIN"
            | "SUPPORT_ADMIN"
            | "SALESMAN"
            | null,
          companyId: isAdmin ? "" : (user.memberships[0]?.companyId ?? ""),
          companyName: isAdmin ? "" : (user.memberships[0]?.company.name ?? ""),
          planId: (user.memberships[0]?.company.subscription?.planId ?? "plan_starter") as
            | "plan_starter"
            | "plan_professional"
            | "plan_enterprise"
            | "plan_ultra",
          accountStatus: user.memberships[0]?.company.accountStatus ?? (isAdmin ? "APPROVED" : "PENDING_APPROVAL"),
          pricingTier: user.memberships[0]?.company.pricingTier ?? null,
          currency: (user.memberships[0]?.company.currency as "USD" | "CAD") ?? "USD",
          ckCustomerVerified: user.memberships[0]?.company.ckCustomerVerified ?? false,
          loginIpAddress,
          loginUserAgent: truncateRequestValue(request.headers.get("user-agent"), 500)
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
        const isAdmin = isInternalAdminEmail(user.email) || ("isInternalAdmin" in user && Boolean(user.isInternalAdmin));
        token.role = isAdmin ? "AZZURE_ADMIN" : "CUSTOMER";
        token.adminRole = "adminRole" in user && typeof user.adminRole === "string"
          ? (user.adminRole as "SUPER_ADMIN" | "OPERATIONS_MANAGER" | "ESTIMATOR_ADMIN" | "SUPPORT_ADMIN" | "SALESMAN")
          : (isAdmin ? "SUPER_ADMIN" : null);
        token.companyId = isAdmin ? "" : ("companyId" in user && typeof user.companyId === "string" ? user.companyId : "");
        token.companyName = isAdmin ? "" : ("companyName" in user && typeof user.companyName === "string" ? user.companyName : "");
        token.currency = "currency" in user && typeof user.currency === "string" ? (user.currency as "USD" | "CAD") : "USD";
        token.planId =
          "planId" in user && typeof user.planId === "string"
            ? (user.planId as "plan_starter" | "plan_professional" | "plan_enterprise" | "plan_ultra")
            : "plan_starter";
        token.accountStatus =
          "accountStatus" in user && typeof user.accountStatus === "string"
            ? (user.accountStatus as "PENDING_APPROVAL" | "APPROVED" | "SUSPENDED")
            : (isAdmin ? "APPROVED" : "PENDING_APPROVAL");
        token.pricingTier =
          "pricingTier" in user && typeof user.pricingTier === "string"
            ? (user.pricingTier as "TIER_1" | "TIER_2" | "TIER_3")
            : null;
        token.ckCustomerVerified =
          "ckCustomerVerified" in user ? Boolean(user.ckCustomerVerified) : false;
      }

      if (token.email && isInternalAdminEmail(token.email as string)) {
        token.role = "AZZURE_ADMIN";
        if (!token.adminRole) {
          token.adminRole = "SUPER_ADMIN";
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.sessionVersion = typeof token.sessionVersion === "number" ? token.sessionVersion : 0;
        session.user.role = token.role === "AZZURE_ADMIN" ? "AZZURE_ADMIN" : "CUSTOMER";
        session.user.adminRole = (token.adminRole as "SUPER_ADMIN" | "OPERATIONS_MANAGER" | "ESTIMATOR_ADMIN" | "SUPPORT_ADMIN" | "SALESMAN" | null) ?? null;
        session.user.companyId = typeof token.companyId === "string" ? token.companyId : "";
        session.user.companyName = typeof token.companyName === "string" ? token.companyName : "";
        session.user.currency = (token.currency as "USD" | "CAD") ?? "USD";
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

      const userIsInternalAdmin =
        isInternalAdminEmail(user.email) || ("isInternalAdmin" in user && Boolean(user.isInternalAdmin));
      const role = userIsInternalAdmin ? "AZZURE_ADMIN" : "CUSTOMER";
      const companyId = "companyId" in user && typeof user.companyId === "string" && user.companyId ? user.companyId : "";
      const isAdmin = role === "AZZURE_ADMIN";

      await logAuditEvent({
        action: "SIGN_IN",
        actorUserId: user.id,
        targetType: "User",
        targetId: user.id,
        companyId: companyId || null,
        ipAddress: user.loginIpAddress ?? null,
        userAgent: user.loginUserAgent ?? null,
        metadata: {
          email: user.email,
          role,
          admin: isAdmin
        }
      }).catch(() => undefined);
    }
  }
});
