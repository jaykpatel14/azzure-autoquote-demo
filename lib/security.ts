import type { NextRequest } from "next/server";

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP_SIGNATURE_PREFIX = [0x52, 0x49, 0x46, 0x46];
const WEBP_SIGNATURE_SUFFIX = [0x57, 0x45, 0x42, 0x50];

export function getAppOrigin() {
  return new URL(process.env.APP_URL || "http://localhost:3000").origin;
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
