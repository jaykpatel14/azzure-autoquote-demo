import { describe, expect, test } from "vitest";
import { median, mergeConfidence } from "@/lib/statistics";

describe("statistics", () => {
  test("median handles odd, even, and empty arrays", () => {
    expect(median([])).toBe(0);
    expect(median([5])).toBe(5);
    expect(median([1, 3, 2])).toBe(2);
    expect(median([1, 10, 2, 4])).toBe(3);
  });

  test("mergeConfidence averages review scores", () => {
    expect(mergeConfidence(["high", "high", "medium"])).toBe("high");
    expect(mergeConfidence(["medium", "low", "medium"])).toBe("medium");
    expect(mergeConfidence(["low", "low", "medium"])).toBe("low");
  });
});
