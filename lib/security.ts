import type { NextRequest } from "next/server";

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP_SIGNATURE_PREFIX = [0x52, 0x49, 0x46, 0x46];
const WEBP_SIGNATURE_SUFFIX = [0x57, 0x45, 0x42, 0x50];

export function getAppOrigin() {
  return new URL(process.env.APP_URL || "http://localhost:3000").origin;
}

export function buildPublicUrl(path: string) {
  return new URL(path, getAppOrigin());
}

export function getAppHostname() {
  return new URL(getAppOrigin()).hostname;
}

// Branded tenant links use this as the root instead of the app's own hostname, so a
// nested app host (e.g. autoquote-test.azzuresolutions.com) can still hand out
// apex-level links (demo-jewelry.azzuresolutions.com) covered by a single wildcard cert.
export function getBrandRootDomain() {
  return process.env.BRAND_ROOT_DOMAIN || getAppHostname();
}

export function buildBrandedPublicUrl(companySlug: string, path: string) {
  const url = new URL(getAppOrigin());
  url.hostname = `${companySlug}.${getBrandRootDomain()}`;
  url.pathname = path;
  return url.toString();
}

export function extractTenantSlugFromHost(hostname: string) {
  const rootDomain = getBrandRootDomain();
  if (hostname === rootDomain || !hostname.endsWith(`.${rootDomain}`)) {
    return null;
  }

  const prefix = hostname.slice(0, hostname.length - rootDomain.length - 1);
  if (!prefix || prefix.includes(".") || prefix === "www") {
    return null;
  }

  return prefix;
}

export function getRequestOrigin(request: Request | NextRequest) {
  return request.headers.get("origin") || request.headers.get("referer") || "";
}

export function getRequestUrlOrigin(request: Request | NextRequest) {
  return "nextUrl" in request && request.nextUrl ? request.nextUrl.origin : new URL(request.url).origin;
}

export function getEffectiveRequestOrigin(request: Request | NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const host = forwardedHost.split(",")[0]?.trim();
    if (host) {
      const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
      return `${forwardedProto}://${host}`;
    }
  }

  const host = request.headers.get("host");
  if (host) {
    const protocol = "nextUrl" in request && request.nextUrl ? request.nextUrl.protocol : new URL(request.url).protocol;
    return `${protocol}//${host}`;
  }

  return getRequestUrlOrigin(request);
}

export function getRequestBaseUrl(request: Request | NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const host = forwardedHost.split(",")[0]?.trim();
    if (host) {
      const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
      return `${forwardedProto}://${host}`;
    }
  }

  const host = request.headers.get("host");
  if (host) {
    const protocol = "nextUrl" in request && request.nextUrl ? request.nextUrl.protocol : new URL(request.url).protocol;
    return `${protocol}//${host}`;
  }

  return getRequestUrlOrigin(request);
}

export function isSameOriginRequest(request: Request | NextRequest) {
  const origin = getRequestOrigin(request);
  if (!origin) return true;

  try {
    const requestOrigin = new URL(origin).origin;
    return requestOrigin === getEffectiveRequestOrigin(request) || requestOrigin === getAppOrigin();
  } catch {
    return false;
  }
}

export function hasAllowedImageSignature(bytes: Uint8Array, _mimeType?: string) {
  // Verify actual file bytes regardless of the declared MIME type.
  // Browsers sometimes send a mismatched MIME type (e.g. a WebP file with a
  // .jpg extension is uploaded as image/jpeg), so trust the bytes, not the type.
  if (JPEG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    return true;
  }

  if (PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    return true;
  }

  if (
    WEBP_SIGNATURE_PREFIX.every((byte, index) => bytes[index] === byte) &&
    WEBP_SIGNATURE_SUFFIX.every((byte, index) => bytes[index + 8] === byte)
  ) {
    return true;
  }

  return false;
}

export function detectImageMimeType(bytes: Uint8Array): string | null {
  if (JPEG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    return "image/jpeg";
  }

  if (PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) {
    return "image/png";
  }

  if (
    WEBP_SIGNATURE_PREFIX.every((byte, index) => bytes[index] === byte) &&
    WEBP_SIGNATURE_SUFFIX.every((byte, index) => bytes[index + 8] === byte)
  ) {
    return "image/webp";
  }

  return null;
}

export function hasAllowedShowroomMediaSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType.startsWith("image/")) return hasAllowedImageSignature(bytes, mimeType);
  if (mimeType === "video/mp4") {
    return bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
  }
  if (mimeType === "video/webm") {
    return bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  }
  return false;
}

export function getClientIp(request: Request | NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") || "unknown";
}
