import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { logAuditEvent } from "@/lib/audit";
import { requireEnv } from "@/lib/env";

const credentialsSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(200)
});

const authSecret = requireEnv("AUTH_SECRET");

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

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            emailVerifiedAt: true,
            sessionVersion: true
          }
        });

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
          sessionVersion: user.sessionVersion
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
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.sessionVersion = typeof token.sessionVersion === "number" ? token.sessionVersion : 0;
      }

      return session;
    }
  },
  events: {
    async signIn({ user }) {
      const membership = await prisma.membership.findFirst({
        where: { userId: user.id },
        select: { companyId: true }
      });

      if (!membership) return;

      await logAuditEvent({
        action: "SIGN_IN",
        companyId: membership.companyId,
        actorUserId: user.id,
        metadata: { provider: "credentials" }
      }).catch(() => undefined);
    },
    async signOut(event) {
      const token = "token" in event ? event.token : null;
      if (!token?.sub) return;

      const membership = await prisma.membership.findFirst({
        where: { userId: token.sub },
        select: { companyId: true }
      });

      if (!membership) return;

      await logAuditEvent({
        action: "SIGN_OUT",
        companyId: membership.companyId,
        actorUserId: token.sub,
        metadata: { provider: "credentials" }
      }).catch(() => undefined);
    }
  }
});
