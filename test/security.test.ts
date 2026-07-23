import { afterEach, describe, expect, test, vi } from "vitest";
import { clearRateLimitState, checkRateLimit } from "@/lib/rate-limit";
import { hasAllowedImageSignature, isSameOriginRequest } from "@/lib/security";
import { requireEnv } from "@/lib/env";

afterEach(() => {
  clearRateLimitState();
  vi.unstubAllEnvs();
});

describe("security helpers", () => {
  test("recognizes valid image signatures", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50
    ]);

    expect(hasAllowedImageSignature(jpeg, "image/jpeg")).toBe(true);
    expect(hasAllowedImageSignature(png, "image/png")).toBe(true);
    expect(hasAllowedImageSignature(webp, "image/webp")).toBe(true);
    expect(hasAllowedImageSignature(new Uint8Array([1, 2, 3]), "image/png")).toBe(false);
  });

  test("rejects cross-origin requests", () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");

    const request = new Request("http://localhost:3000/api/analyze", {
      method: "POST",
      headers: {
        origin: "http://evil.test"
      }
    });

    expect(isSameOriginRequest(request)).toBe(false);
  });

  test("enforces a simple in-memory rate limit", () => {
    const first = checkRateLimit({ key: "analyze:127.0.0.1", limit: 2, windowMs: 60_000 });
    const second = checkRateLimit({ key: "analyze:127.0.0.1", limit: 2, windowMs: 60_000 });
    const third = checkRateLimit({ key: "analyze:127.0.0.1", limit: 2, windowMs: 60_000 });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
  });

  test("requires configured environment values", () => {
    vi.stubEnv("AUTH_SECRET", "");
    expect(() => requireEnv("AUTH_SECRET")).toThrow("AUTH_SECRET is not configured.");
  });
});
