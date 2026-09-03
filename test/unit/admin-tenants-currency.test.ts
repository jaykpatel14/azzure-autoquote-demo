import { describe, it, expect } from "vitest";
import { formatMoneyWithFx, convertCurrency, getUsdToCadRate } from "@/lib/currency";

describe("Admin Tenant Currency Assignment & Formatting", () => {
  it("formats company quotes in CAD when company currency is CAD", () => {
    const quotePriceUsd = 1000;
    const rate = getUsdToCadRate();
    const formattedCad = formatMoneyWithFx(quotePriceUsd, "CAD", rate);
    const expectedCadAmount = quotePriceUsd * rate;

    expect(convertCurrency(quotePriceUsd, "USD", "CAD")).toBe(expectedCadAmount);
    expect(formattedCad).toContain("1,360");
  });

  it("formats company quotes in USD by default", () => {
    const quotePriceUsd = 1000;
    const formattedUsd = formatMoneyWithFx(quotePriceUsd, "USD");

    expect(formattedUsd).toBe("$1,000");
    expect(convertCurrency(quotePriceUsd, "USD", "USD")).toBe(quotePriceUsd);
  });
});
