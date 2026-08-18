import { describe, expect, it } from "vitest";
import { normalizeShowroomCode, safeBrandColor } from "@/lib/showroom";

describe("showroom public input safety", () => {
  it("normalizes short customer codes without accepting arbitrary input", () => {
    expect(normalizeShowroomCode("qt-93")).toBe("QT-0093");
    expect(normalizeShowroomCode("other-company-id")).toBeNull();
  });

  it("allows only six-digit hexadecimal brand colors", () => {
    expect(safeBrandColor("#C9A84C")).toBe("#C9A84C");
    expect(safeBrandColor("red; background:url(x)")).toBeNull();
  });
});
