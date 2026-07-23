import { NextRequest, NextResponse } from "next/server";
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"
  ]
};
