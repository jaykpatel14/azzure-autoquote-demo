import { describe, it, expect } from "vitest";
import { validateEmail, isValidEmail } from "@/lib/email-validation";

describe("validateEmail", () => {
  it("accepts valid normal business and personal emails", () => {
    expect(isValidEmail("jeweler@diamonds.com")).toBe(true);
    expect(isValidEmail("sarah.connor@gmail.com")).toBe(true);
    expect(isValidEmail("alex@luxurygemstudio.co.uk")).toBe(true);
    expect(isValidEmail("quotes@azzurejewelry.store")).toBe(true);
  });

  it("rejects empty emails when allowEmpty is false", () => {
    const result = validateEmail("");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Please enter an email address");
  });

  it("accepts empty email when allowEmpty is true", () => {
    const result = validateEmail("", { allowEmpty: true });
    expect(result.valid).toBe(true);
  });

  it("rejects disposable/temporary email providers", () => {
    const testCases = [
      "user@mailinator.com",
      "anon@10minutemail.com",
      "throwaway@tempmail.com",
      "test@guerrillamail.com",
      "hacker@yopmail.com",
      "bot@trashmail.com",
      "fake@burnermail.io"
    ];

    for (const email of testCases) {
      const result = validateEmail(email);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Temporary or disposable email");
    }
  });

  it("rejects dummy, placeholder, and test domains", () => {
    const dummyCases = [
      "dsaf@dsaf.com",
      "john@example.com",
      "tester@test.com",
      "user@dummy.com",
      "someone@fake.com",
      "sample@sample.com",
      "asdf@asdf.com",
      "qwerty@qwerty.com"
    ];

    for (const email of dummyCases) {
      const result = validateEmail(email);
      expect(result.valid).toBe(false);
    }
  });

  it("rejects keyboard-mashing dummy domains and usernames", () => {
    expect(isValidEmail("asdfghjkl@asdfghjkl.com")).toBe(false);
    expect(isValidEmail("dsaf@dsafsaf.com")).toBe(false);
    expect(isValidEmail("aaaa@aaaa.com")).toBe(false);
    expect(isValidEmail("test@test.org")).toBe(false);
  });

  it("rejects invalid syntax and invalid TLDs", () => {
    expect(isValidEmail("notanemail")).toBe(false);
    expect(isValidEmail("missing@tld")).toBe(false);
    expect(isValidEmail("user@domain.123")).toBe(false);
    expect(isValidEmail("user@domain.test")).toBe(false);
    expect(isValidEmail("user@domain.local")).toBe(false);
    expect(isValidEmail("user..name@domain.com")).toBe(false);
  });
});
