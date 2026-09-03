import { describe, it, expect } from "vitest";
import { convertCurrency, formatCurrency, formatMoneyWithFx, getUsdToCadRate, DEFAULT_USD_TO_CAD_RATE } from "@/lib/currency";

describe("currency utilities", () => {
  it("defaults USD to CAD rate to 1.36", () => {
    expect(getUsdToCadRate()).toBe(DEFAULT_USD_TO_CAD_RATE);
  });

  it("converts USD to CAD and back accurately", () => {
    const usd = 1000;
    const cad = convertCurrency(usd, "USD", "CAD", 1.36);
    expect(cad).toBe(1360);

    const backToUsd = convertCurrency(cad, "CAD", "USD", 1.36);
    expect(backToUsd).toBe(1000);
  });

  it("returns 0 for zero or NaN amounts", () => {
    expect(convertCurrency(0, "USD", "CAD")).toBe(0);
    expect(convertCurrency(NaN, "USD", "CAD")).toBe(0);
  });

  it("formats USD currency strings correctly", () => {
    const formatted = formatCurrency(1250.5, "USD");
    expect(formatted).toBe("$1,250.50");
  });

  it("formats CAD currency strings correctly", () => {
    const formatted = formatCurrency(1700.5, "CAD");
    expect(formatted).toContain("1,700.50");
  });

  it("converts and formats with formatMoneyWithFx", () => {
    const formattedCad = formatMoneyWithFx(1000, "CAD", 1.36);
    expect(formattedCad).toContain("1,360");
  });
});
