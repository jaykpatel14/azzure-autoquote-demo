import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ACTIVE_COMPANY_COOKIE } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAppOrigin, getClientIp, isSameOriginRequest } from "@/lib/security";

const rateLimits: Array<{ prefix: string; limit: number; windowMs: number }> = [
  { prefix: "/api/auth/register", limit: 5, windowMs: 60_000 },
  { prefix: "/api/auth/forgot-password", limit: 5, windowMs: 60_000 },
  { prefix: "/api/auth/callback/credentials", limit: 20, windowMs: 60_000 },
  { prefix: "/api/analyze", limit: 10, windowMs: 60_000 },
  { prefix: "/api/billing/checkout", limit: 10, windowMs: 60_000 },
  { prefix: "/api/billing/portal", limit: 10, windowMs: 60_000 },
  { prefix: "/api/company/switch", limit: 20, windowMs: 60_000 }
];

const publicPagePrefixes = [
  "/signin",
  "/signup",
  "/pricing",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/pending-approval",
  "/suspended"
];

const publicApiPrefixes = ["/api/auth", "/api/health", "/api/billing/webhook", "/api/account/status"];

function withSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("Origin-Agent-Cluster", "?1");
  response.headers.set("X-App-Origin", getAppOrigin());
  return response;
}

function getRateLimitConfig(pathname: string) {
  return rateLimits.find((entry) => pathname.startsWith(entry.prefix));
}

function isPublicRoute(pathname: string) {
  return publicPagePrefixes.some((prefix) => pathname.startsWith(prefix));
}

function isPublicApiRoute(pathname: string) {
  return publicApiPrefixes.some((prefix) => pathname.startsWith(prefix));
}

async function applyAdminAccessControl(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  if (!isAdminRoute) {
    return null;
  }

  const session = await auth();
  if (!session) {
    if (pathname.startsWith("/api/admin")) {
      return withSecurityHeaders(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }

    const loginUrl = new URL("/signin", getAppOrigin());
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return withSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  if (session.user?.role !== "AZZURE_ADMIN") {
    if (pathname.startsWith("/api/admin")) {
      return withSecurityHeaders(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
    }

    return withSecurityHeaders(NextResponse.redirect(new URL("/", getAppOrigin())));
  }

  return null;
}

async function applyAccountAccessControl(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isPublicRoute(pathname) || pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    return null;
  }

  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        memberships: {
          select: {
            companyId: true,
            company: {
              select: {
                id: true,
                accountStatus: true
              }
            }
          }
        }
      }
    });

    if (!user || user.memberships.length === 0) {
      return null;
    }

    const cookieCompanyId = request.cookies.get(ACTIVE_COMPANY_COOKIE)?.value;
    const activeMembership =
      user.memberships.find((membership) => membership.companyId === cookieCompanyId) ?? user.memberships[0];
    const companyStatus = activeMembership.company.accountStatus;

    if (companyStatus === "APPROVED") {
      return null;
    }

    if (pathname.startsWith("/api/")) {
      if (isPublicApiRoute(pathname)) {
        return null;
      }

      const statusMessage =
        companyStatus === "SUSPENDED"
          ? "Your account has been suspended. Contact Azzure support."
          : "Your account is pending approval. You cannot access this resource yet.";

      return withSecurityHeaders(NextResponse.json({ error: statusMessage }, { status: 403 }));
    }

    const redirectTarget = companyStatus === "SUSPENDED" ? "/suspended" : "/pending-approval";
    if (pathname === redirectTarget) {
      return null;
    }

    return withSecurityHeaders(NextResponse.redirect(new URL(redirectTarget, getAppOrigin())));
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const adminAccessResponse = await applyAdminAccessControl(request);
  if (adminAccessResponse) {
    return adminAccessResponse;
  }

  const accountAccessResponse = await applyAccountAccessControl(request);
  if (accountAccessResponse) {
    return accountAccessResponse;
  }

  if (
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    request.method !== "OPTIONS" &&
    pathname.startsWith("/api/") &&
    pathname !== "/api/billing/webhook" &&
    !isSameOriginRequest(request)
  ) {
    return withSecurityHeaders(
      NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 })
    );
  }

  const config = getRateLimitConfig(pathname);
  if (config && request.method === "POST") {
    const key = `${pathname}:${getClientIp(request)}`;
    const outcome = checkRateLimit({
      key,
      limit: config.limit,
      windowMs: config.windowMs
    });

    if (!outcome.allowed) {
      const retryAfter = Math.max(1, Math.ceil((outcome.resetAt - Date.now()) / 1000));
      const response = NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
      response.headers.set("Retry-After", String(retryAfter));
      return withSecurityHeaders(response);
    }
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"]
};
