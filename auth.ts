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

        if (!user?.passwordHash || !user.emailVerifiedAt) {
          return null;
        }

        if (!verifyPassword(parsed.data.password, user.passwordHash)) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          sessionVersion: user.sessionVersion,
          companyId: user.memberships[0]?.companyId ?? "",
          companyName: user.memberships[0]?.company.name ?? "",
          planId: user.memberships[0]?.company.subscription?.planId ?? "",
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
        token.companyId = "companyId" in user ? user.companyId ?? "" : "";
        token.companyName = "companyName" in user ? user.companyName ?? "" : "";
        token.planId = "planId" in user ? user.planId ?? "" : "";
        token.accountStatus = "accountStatus" in user ? user.accountStatus ?? "PENDING_APPROVAL" : "PENDING_APPROVAL";
        token.pricingTier = "pricingTier" in user ? user.pricingTier ?? null : null;
        token.ckCustomerVerified =
          "ckCustomerVerified" in user ? user.ckCustomerVerified ?? false : false;
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
        session.user.planId = token.planId === "plan_starter" || token.planId === "plan_professional" || token.planId === "plan_enterprise" || token.planId === "plan_ultra" ? token.planId : "plan_starter";
        session.user.accountStatus =
          token.accountStatus === "APPROVED" ||
          token.accountStatus === "SUSPENDED" ||
          token.accountStatus === "PENDING_APPROVAL"
            ? token.accountStatus
            : "PENDING_APPROVAL";
        session.user.pricingTier =
          token.pricingTier === "TIER_1" ||
          token.pricingTier === "TIER_2" ||
          token.pricingTier === "TIER_3"
            ? token.pricingTier
            : null;
        session.user.ckCustomerVerified = token.ckCustomerVerified === true;
      }

      return session;
    }
  },
  events: {
    async signIn({ user }) {
      let membership;
      try {
        membership = await prisma.membership.findFirst({
          where: { userId: user.id },
          select: { companyId: true }
        });
      } catch (error) {
        if (isPrismaConnectionError(error)) {
          return;
        }

        throw error;
      }

      if (!membership) return;

      await logAuditEvent({
        action: "SIGN_IN",
        companyId: membership.companyId,
        actorUserId: user.id,
        metadata: { provider: "credentials", admin: isInternalAdminEmail(user.email) }
      }).catch(() => undefined);
    },
    async signOut(event) {
      const token = "token" in event ? event.token : null;
      if (!token?.sub) return;

      let membership;
      try {
        membership = await prisma.membership.findFirst({
          where: { userId: token.sub },
          select: { companyId: true }
        });
      } catch (error) {
        if (isPrismaConnectionError(error)) {
          return;
        }

        throw error;
      }

      if (!membership) return;

      await logAuditEvent({
        action: "SIGN_OUT",
        companyId: membership.companyId,
        actorUserId: token.sub,
        metadata: { provider: "credentials", admin: token.role === "AZZURE_ADMIN" }
      }).catch(() => undefined);
    }
  }
});
