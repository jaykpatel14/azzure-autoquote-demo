import { NextRequest, NextResponse, type NextFetchEvent } from "next/server";
import { auth } from "@/auth";
import { ACTIVE_COMPANY_COOKIE } from "@/lib/company";
import { normalizeIpAddress } from "@/lib/ip-access";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractTenantSlugFromHost, getAppOrigin, getClientIp, isSameOriginRequest } from "@/lib/security";

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
  "/configuration",
  "/suspended",
  "/showroom"
];

const publicApiPrefixes = ["/api/auth", "/api/health", "/api/billing/webhook", "/api/account/status", "/api/showroom/validate", "/api/showroom/analyze", "/api/showroom/quotes", "/api/showroom/render", "/api/showroom/devices/heartbeat"];
const ipBlockExemptPrefixes = ["/api/health", "/api/cron", "/api/billing/webhook"];

function withSecurityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  response.headers.set("X-DNS-Prefetch-Control", "off");
  response.headers.set("Origin-Agent-Cluster", "?1");
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
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

function isIpBlockExempt(pathname: string) {
  return ipBlockExemptPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function isPageNavigation(request: NextRequest) {
  if (request.method !== "GET" || request.nextUrl.pathname.startsWith("/api/")) return false;
  if (request.headers.get("next-router-prefetch") || request.headers.get("purpose") === "prefetch") return false;

  return request.headers.get("sec-fetch-dest") === "document" || request.headers.get("rsc") === "1";
}

function getReferrerPath(request: NextRequest) {
  const referer = request.headers.get("referer");
  if (!referer) return null;

  try {
    return new URL(referer).pathname;
  } catch {
    return null;
  }
}

async function applyIpAccessControl(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  if (isIpBlockExempt(pathname)) return null;

  const ipAddress = normalizeIpAddress(getClientIp(request));
  if (!ipAddress) return null;

  try {
    const blockedIp = await prisma.blockedIp.findUnique({
      where: { ipAddress },
      select: { id: true }
    });
    if (!blockedIp) return null;

    if (isPageNavigation(request) || pathname.startsWith("/api/auth/")) {
      event.waitUntil(
        prisma.auditLog.create({
          data: {
            action: "BLOCKED_IP_ATTEMPT",
            companyId: null,
            targetType: "BlockedIp",
            targetId: blockedIp.id,
            ipAddress,
            userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
            metadata: { path: pathname, method: request.method }
          }
        }).catch(() => undefined)
      );
    }

    if (pathname.startsWith("/api/")) {
      return withSecurityHeaders(
        NextResponse.json({ error: "Access from this IP address has been blocked." }, { status: 403 })
      );
    }

    return withSecurityHeaders(
      new NextResponse(
        "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Access blocked</title></head><body style=\"margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;color:#0f172a;font-family:system-ui,sans-serif\"><main style=\"max-width:520px;padding:32px;text-align:center\"><h1 style=\"font-size:28px;margin:0 0 12px\">Access blocked</h1><p style=\"margin:0;color:#475569;line-height:1.6\">Requests from this IP address are not permitted. Contact Azzure support if you believe this is an error.</p></main></body></html>",
        { status: 403, headers: { "content-type": "text/html; charset=utf-8" } }
      )
    );
  } catch (error) {
    console.warn("Unable to evaluate IP access policy.", error);
    return null;
  }
}

function schedulePageViewAudit(request: NextRequest, event: NextFetchEvent) {
  if (!isPageNavigation(request)) return;

  event.waitUntil(
    (async () => {
      const session = await auth();
      if (!session?.user?.id) return;

      const ipAddress = normalizeIpAddress(getClientIp(request));
      await prisma.auditLog.create({
        data: {
          action: "PAGE_VIEW",
          actorUserId: session.user.id,
          companyId: session.user.companyId || null,
          targetType: "Route",
          targetId: request.nextUrl.pathname.slice(0, 500),
          ipAddress,
          userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
          metadata: {
            path: request.nextUrl.pathname,
            method: request.method,
            referrerPath: getReferrerPath(request),
            area: request.nextUrl.pathname.startsWith("/admin") ? "admin" : "workspace"
          }
        }
      });
    })().catch((error) => {
      console.warn("Unable to record page activity.", error);
    })
  );
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
  if (isPublicRoute(pathname) || isPublicApiRoute(pathname) || pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    return null;
  }

  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  if (session.user.role === "AZZURE_ADMIN") {
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
                ,pricingTier: true
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
    const pricingTier = activeMembership.company.pricingTier;

    if (companyStatus === "APPROVED" && pricingTier) {
      return null;
    }

    if (pathname.startsWith("/api/")) {
      if (isPublicApiRoute(pathname)) {
        return null;
      }

      const statusMessage =
        companyStatus === "SUSPENDED"
          ? "Your account has been suspended. Contact Azzure support."
          : companyStatus === "APPROVED"
            ? "Your pricing configuration is not complete. Contact Azzure support."
          : "Your account is pending approval. You cannot access this resource yet.";

      return withSecurityHeaders(NextResponse.json({ error: statusMessage }, { status: 403 }));
    }

    const redirectTarget = companyStatus === "SUSPENDED" ? "/suspended" : companyStatus === "APPROVED" ? "/configuration" : "/pending-approval";
    if (pathname === redirectTarget) {
      return null;
    }

    return withSecurityHeaders(NextResponse.redirect(new URL(redirectTarget, getAppOrigin())));
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl;
  const tenantSlug = pathname.startsWith("/q/")
    ? extractTenantSlugFromHost(request.nextUrl.hostname)
    : null;

  const ipAccessResponse = await applyIpAccessControl(request, event);
  if (ipAccessResponse) {
    return ipAccessResponse;
  }

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

  schedulePageViewAudit(request, event);

  if (tenantSlug) {
    const forwardedHeaders = new Headers(request.headers);
    forwardedHeaders.set("x-tenant-slug", tenantSlug);
    return withSecurityHeaders(NextResponse.next({ request: { headers: forwardedHeaders } }));
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"]
};
