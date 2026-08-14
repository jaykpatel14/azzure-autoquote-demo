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

export function buildBrandedPublicUrl(companySlug: string, path: string) {
  const url = new URL(getAppOrigin());
  url.hostname = `${companySlug}.${url.hostname}`;
  url.pathname = path;
  return url.toString();
}

export function extractTenantSlugFromHost(hostname: string) {
  const appHostname = getAppHostname();
  if (hostname === appHostname || !hostname.endsWith(`.${appHostname}`)) {
    return null;
  }

  const prefix = hostname.slice(0, hostname.length - appHostname.length - 1);
  if (!prefix || prefix.includes(".") || prefix === "www") {
    return null;
  }

  return prefix;
}

export function getRequestOrigin(request: Request | NextRequest) {
  return request.headers.get("origin") || request.headers.get("referer") || "";
}

export function isSameOriginRequest(request: Request | NextRequest) {
  const origin = getRequestOrigin(request);
  if (!origin) return true;

  try {
    return new URL(origin).origin === getAppOrigin();
  } catch {
    return false;
  }
}

export function hasAllowedImageSignature(bytes: Uint8Array, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return JPEG_SIGNATURE.every((byte, index) => bytes[index] === byte);
  }

  if (mimeType === "image/png") {
    return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte);
  }

  if (mimeType === "image/webp") {
    return (
      WEBP_SIGNATURE_PREFIX.every((byte, index) => bytes[index] === byte) &&
      WEBP_SIGNATURE_SUFFIX.every((byte, index) => bytes[index + 8] === byte)
    );
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
