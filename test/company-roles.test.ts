import { vi, describe, expect, test } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {}
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn()
}));

import {
  canCreateQuotes,
  canDeleteQuotes,
  canManageBilling,
  canManageTeam,
  canSeeFullPricing,
  canViewQuotes,
  getCompanyRoleRank
} from "@/lib/company";

describe("company roles", () => {
  test("ranks legacy customer access as full workspace access", () => {
    expect(getCompanyRoleRank("CUSTOMER")).toBeGreaterThan(getCompanyRoleRank("VIEWER"));
    expect(canViewQuotes("CUSTOMER")).toBe(true);
    expect(canCreateQuotes("CUSTOMER")).toBe(true);
    expect(canManageBilling("CUSTOMER")).toBe(true);
    expect(canManageTeam("CUSTOMER")).toBe(true);
    expect(canDeleteQuotes("CUSTOMER")).toBe(true);
  });

  test("keeps lower roles read-only or limited", () => {
    expect(canViewQuotes("VIEWER")).toBe(true);
    expect(canCreateQuotes("VIEWER")).toBe(false);
    expect(canManageBilling("ESTIMATOR")).toBe(false);
    expect(canManageTeam("ESTIMATOR")).toBe(false);
    expect(canDeleteQuotes("ESTIMATOR")).toBe(false);
  });

  test("keeps Azzure making prices away from sales and viewer roles", () => {
    expect(canSeeFullPricing("OWNER")).toBe(true);
    expect(canSeeFullPricing("ADMIN")).toBe(true);
    expect(canSeeFullPricing("ESTIMATOR")).toBe(true);
    expect(canSeeFullPricing("SALESMAN")).toBe(false);
    expect(canSeeFullPricing("VIEWER")).toBe(false);
    expect(canSeeFullPricing("MANUFACTURING")).toBe(false);
  });
});
