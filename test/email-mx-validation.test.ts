import { describe, it, expect, vi } from "vitest";
import { validateEmailDomainMx } from "@/lib/email-mx-validation";

describe("validateEmailDomainMx", () => {
  it("rejects invalid email formats upfront", async () => {
    const res1 = await validateEmailDomainMx("not-an-email");
    expect(res1.valid).toBe(false);
    expect(res1.error).toContain("valid email address");

    const res2 = await validateEmailDomainMx("@nodomain.com");
    expect(res2.valid).toBe(false);
  });

  it("rejects static disposable domains upfront", async () => {
    const res = await validateEmailDomainMx("user@mailinator.com");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("disposable");
  });

  it("rejects static dummy/placeholder domains upfront", async () => {
    const res = await validateEmailDomainMx("user@example.com");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("dummy domains");
  });

  it("rejects non-existent domains with no MX servers", async () => {
    const res = await validateEmailDomainMx("fakeuser123456@this-domain-does-not-exist-xyz-987654.com");
    expect(res.valid).toBe(false);
    expect(res.error).toContain("does not exist or has no active mail servers");
  });

  it("accepts genuine email domains with active MX records", async () => {
    const res = await validateEmailDomainMx("testjeweler@gmail.com");
    expect(res.valid).toBe(true);
    expect(res.normalizedEmail).toBe("testjeweler@gmail.com");
  });
});
