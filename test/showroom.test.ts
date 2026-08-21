import { describe, expect, it } from "vitest";
import { normalizeShowroomCode, safeBrandColor } from "@/lib/showroom";
import { hasAllowedShowroomMediaSignature } from "@/lib/security";
import { clearMobileUploads, getMobileUploads, saveMobileUploads } from "@/lib/mobile-upload-store";

describe("showroom public input safety", () => {
  it("normalizes short customer codes without accepting arbitrary input", () => {
    expect(normalizeShowroomCode("qt-93")).toBe("QT-0093");
    expect(normalizeShowroomCode("other-company-id")).toBeNull();
  });

  it("allows only six-digit hexadecimal brand colors", () => {
    expect(safeBrandColor("#C9A84C")).toBe("#C9A84C");
    expect(safeBrandColor("red; background:url(x)")).toBeNull();
  });

  it("checks showroom media content instead of trusting its MIME type", () => {
    expect(hasAllowedShowroomMediaSignature(Uint8Array.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0, 0, 0, 0]), "video/mp4")).toBe(true);
    expect(hasAllowedShowroomMediaSignature(Uint8Array.from([0x4d, 0x5a, 0, 0, 0, 0, 0, 0]), "video/mp4")).toBe(false);
  });

  it("requires the matching kiosk token to retrieve mobile uploads", () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    saveMobileUploads(sessionId, "valid-token", [{ name: "ring.jpg", type: "image/jpeg", dataUrl: "data:image/jpeg;base64,/9j/" }]);
    expect(getMobileUploads(sessionId, "wrong-token")).toBeNull();
    expect(getMobileUploads(sessionId, "valid-token")).toHaveLength(1);
    clearMobileUploads(sessionId);
  });
});
