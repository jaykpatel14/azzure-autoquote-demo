import { describe, expect, test, vi } from "vitest";
import { resolveCheckoutCustomerId } from "@/lib/stripe";

describe("stripe checkout customer resolution", () => {
  test("reuses an existing customer when Stripe can still find it", async () => {
    const retrieve = vi.fn().mockResolvedValue({ id: "cus_123" });
    const create = vi.fn();
    const persistStripeCustomerId = vi.fn();

    const customerId = await resolveCheckoutCustomerId({
      stripe: {
        customers: {
          retrieve,
          create
        }
      } as never,
      stripeCustomerId: "cus_123",
      email: "owner@example.test",
      companyName: "Demo Jewelry",
      companyId: "company_demo",
      planCode: "professional",
      persistStripeCustomerId
    });

    expect(customerId).toBe("cus_123");
    expect(retrieve).toHaveBeenCalledWith("cus_123");
    expect(create).not.toHaveBeenCalled();
    expect(persistStripeCustomerId).not.toHaveBeenCalled();
  });

  test("creates a replacement customer when the stored id is stale", async () => {
    const retrieve = vi.fn().mockRejectedValue(new Error("No such customer: 'cus_stale'"));
    const create = vi.fn().mockResolvedValue({ id: "cus_fresh" });
    const persistStripeCustomerId = vi.fn().mockResolvedValue(undefined);

    const customerId = await resolveCheckoutCustomerId({
      stripe: {
        customers: {
          retrieve,
          create
        }
      } as never,
      stripeCustomerId: "cus_stale",
      email: "owner@example.test",
      companyName: "Demo Jewelry",
      companyId: "company_demo",
      planCode: "professional",
      persistStripeCustomerId
    });

    expect(customerId).toBe("cus_fresh");
    expect(retrieve).toHaveBeenCalledWith("cus_stale");
    expect(create).toHaveBeenCalledWith({
      email: "owner@example.test",
      name: "Demo Jewelry",
      metadata: {
        companyId: "company_demo",
        planCode: "professional"
      }
    });
    expect(persistStripeCustomerId).toHaveBeenCalledWith("cus_fresh");
  });
});
