import { describe, expect, test } from "vitest";
import { canReserveUsage } from "@/lib/usage-policy";

describe("usage policy", () => {
  test("canReserveUsage blocks exhausted usage", () => {
    expect(canReserveUsage({ limit: 10, used: 4, reserved: 5 })).toBe(true);
    expect(canReserveUsage({ limit: 10, used: 5, reserved: 5 })).toBe(false);
    expect(canReserveUsage({ limit: 10, used: 10, reserved: 0 })).toBe(false);
  });
});
