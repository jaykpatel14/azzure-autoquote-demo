import { describe, expect, test } from "vitest";
import {
  getUsageRemaining,
  getUsageWarningMessage,
  isBillableSubscription,
  mapStripeSubscriptionStatus
} from "@/lib/billing";

describe("billing helpers", () => {
  test("maps Stripe subscription statuses into app statuses", () => {
    expect(mapStripeSubscriptionStatus("trialing")).toBe("TRIALING");
    expect(mapStripeSubscriptionStatus("active")).toBe("ACTIVE");
    expect(mapStripeSubscriptionStatus("past_due")).toBe("PAST_DUE");
    expect(mapStripeSubscriptionStatus("canceled")).toBe("CANCELED");
  });

  test("identifies billable subscriptions", () => {
    expect(isBillableSubscription({ status: "TRIALING" })).toBe(true);
    expect(isBillableSubscription({ status: "ACTIVE" })).toBe(true);
    expect(isBillableSubscription({ status: "PAST_DUE" })).toBe(false);
  });

  test("surfaces a warning as quota approaches the limit", () => {
    expect(getUsageRemaining({ limit: 500, used: 480, reserved: 0 })).toBe(20);
    expect(getUsageWarningMessage({ limit: 500, used: 480, reserved: 0 })).toContain("20 estimates left");
    expect(getUsageWarningMessage({ limit: 500, used: 300, reserved: 0 })).toBeNull();
  });
});
