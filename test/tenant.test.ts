import { describe, expect, test } from "vitest";
import { assertCompanyOwnership } from "@/lib/tenant";

describe("tenant", () => {
  test("assertCompanyOwnership returns matching records", () => {
    const record = assertCompanyOwnership({ companyId: "company-a", id: "1" }, "company-a");
    expect(record.id).toBe("1");
  });

  test("assertCompanyOwnership rejects mismatched companies", () => {
    expect(() =>
      assertCompanyOwnership({ companyId: "company-a", id: "1" }, "company-b")
    ).toThrow(/does not belong to this company/);
  });

  test("assertCompanyOwnership rejects missing records", () => {
    expect(() => assertCompanyOwnership(null, "company-a")).toThrow(/not found/);
  });
});
