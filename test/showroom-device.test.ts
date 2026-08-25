import { describe, expect, it, vi } from "vitest";
import { getShowroomConfigHash } from "@/lib/showroom-devices";
import {
  validatePinFormat,
  hashKioskPin,
  verifyKioskPin
} from "@/lib/showroom-staff";
import { checkRateLimit, clearRateLimitState } from "@/lib/rate-limit";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: {
      findUnique: vi.fn().mockImplementation(async ({ where }: { where: { id: string } }) => {
        if (where.id === "comp_123") {
          return {
            name: "Jewelry Studio",
            logoUrl: "https://example.com/logo.png",
            primaryColor: "#c9a84c",
            aboutUs: "Fine custom jewelry",
            showroomBackgroundColor: "#0a0b0e",
            showroomOverlayColor: "#000000",
            showroomOverlayOpacity: 60,
            showroomTextColor: "#ffffff",
            showroomBackgroundFit: "cover",
            showroomBackgroundPosition: "center",
            showroomPanelOpacity: 40,
            showroomBackgroundMediaKey: null,
            showroomBackgroundMediaType: null,
            pricingProfile: {
              sellingMarginDivisor: 0.7,
              finalMultiplier: 2
            }
          };
        }
        return null;
      })
    }
  }
}));

describe("Device Registration & Heartbeat logic", () => {
  it("generates deterministic MD5 config version hashes", async () => {
    const hash1 = await getShowroomConfigHash("comp_123");
    const hash2 = await getShowroomConfigHash("comp_123");
    expect(hash1).toBeDefined();
    expect(typeof hash1).toBe("string");
    expect(hash1.length).toBe(16);
    expect(hash1).toBe(hash2);
  });

  it("returns default hash when company is not found", async () => {
    const defaultHash = await getShowroomConfigHash("non_existent_company");
    expect(defaultHash).toBe("default_config");
  });

  it("enforces rate limit for device registrations (max 5 per session per hour)", () => {
    clearRateLimitState();
    const sessionKey = "showroom_device_reg:session_123";

    for (let i = 0; i < 5; i++) {
      const res = checkRateLimit({ key: sessionKey, limit: 5, windowMs: 3600000 });
      expect(res.allowed).toBe(true);
    }

    // 6th attempt should be blocked
    const blocked = checkRateLimit({ key: sessionKey, limit: 5, windowMs: 3600000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });
});

describe("Staff PIN Security & Format Validation", () => {
  it("accepts valid 4-digit numeric PINs", () => {
    const res = validatePinFormat("4829");
    expect(res.valid).toBe(true);
    expect(res.error).toBeUndefined();
  });

  it("rejects non-4-digit PINs", () => {
    expect(validatePinFormat("123").valid).toBe(false);
    expect(validatePinFormat("12345").valid).toBe(false);
    expect(validatePinFormat("abcd").valid).toBe(false);
    expect(validatePinFormat("").valid).toBe(false);
  });

  it("warns on repeated and sequential digits", () => {
    expect(validatePinFormat("1111").warning).toBeDefined();
    expect(validatePinFormat("0000").warning).toBeDefined();
    expect(validatePinFormat("1234").warning).toBeDefined();
    expect(validatePinFormat("4321").warning).toBeDefined();
  });

  it("hashes and verifies PINs securely with timing safety", () => {
    const pin = "8391";
    const hash = hashKioskPin(pin);
    expect(hash).not.toBe(pin);
    expect(hash).toContain(":");

    expect(verifyKioskPin("8391", hash)).toBe(true);
    expect(verifyKioskPin("1234", hash)).toBe(false);
    expect(verifyKioskPin("8392", hash)).toBe(false);
  });

  it("enforces 3-attempt lockout for PIN verification rate limit", () => {
    clearRateLimitState();
    const pinKey = "pin_attempts:company_test:127.0.0.1";

    const attempt1 = checkRateLimit({ key: pinKey, limit: 3, windowMs: 300000 });
    expect(attempt1.allowed).toBe(true);
    expect(attempt1.remaining).toBe(2);

    const attempt2 = checkRateLimit({ key: pinKey, limit: 3, windowMs: 300000 });
    expect(attempt2.allowed).toBe(true);
    expect(attempt2.remaining).toBe(1);

    const attempt3 = checkRateLimit({ key: pinKey, limit: 3, windowMs: 300000 });
    expect(attempt3.allowed).toBe(true);
    expect(attempt3.remaining).toBe(0);

    const attempt4 = checkRateLimit({ key: pinKey, limit: 3, windowMs: 300000 });
    expect(attempt4.allowed).toBe(false);
    expect(attempt4.remaining).toBe(0);
  });
});
