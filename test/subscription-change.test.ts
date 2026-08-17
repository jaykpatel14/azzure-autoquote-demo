import { afterEach, describe, expect, test, vi, beforeEach } from "vitest";

const prismaMock = vi.hoisted(() => ({
  plan: {
    findUnique: vi.fn()
  },
  subscription: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn()
  },
  usagePeriod: {
    upsert: vi.fn()
  }
}));

const companyContextMock = vi.hoisted(() => vi.fn());
const getStripeClientMock = vi.hoisted(() => vi.fn());
const resolveCheckoutPriceIdMock = vi.hoisted(() => vi.fn());
const createCheckoutSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock
}));

vi.mock("@/lib/company", () => ({
  requireCompanyContext: companyContextMock,
  canManageBilling: vi.fn(() => true)
}));

vi.mock("@/lib/stripe", () => ({
  getStripeClient: getStripeClientMock,
  resolveCheckoutPriceId: resolveCheckoutPriceIdMock
}));

vi.mock("@/src/services/subscriptions", () => ({
  createCheckoutSession: createCheckoutSessionMock
}));

vi.mock("@/lib/security", () => ({
  buildPublicUrl: (path: string) => `https://autoquote.everyfacets.com${path}`,
  getRequestBaseUrl: () => "https://autoquote.everyfacets.com"
}));

import { POST as changeSubscription, GET as getSubscriptionChange } from "@/app/api/subscription/change/route";

describe("subscription change route", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    companyContextMock.mockReset();
    getStripeClientMock.mockReset();
    resolveCheckoutPriceIdMock.mockReset();
    createCheckoutSessionMock.mockReset();
    prismaMock.plan.findUnique.mockReset();
    prismaMock.subscription.findUnique.mockReset();
    prismaMock.subscription.update.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("GET redirects to /settings/billing", async () => {
    const response = await getSubscriptionChange();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://autoquote.everyfacets.com/settings/billing");
  });

  test("creates a checkout session when company has subscription without stripeSubscriptionId", async () => {
    companyContextMock.mockResolvedValue({
      user: { email: "owner@everyfacets.com" },
      membership: { role: "OWNER" },
      company: {
        id: "comp_123",
        name: "Every Facets",
        subscription: {
          id: "sub_local_1",
          status: "ACTIVE",
          stripeSubscriptionId: null,
          stripeCustomerId: null,
          plan: { id: "plan_starter", code: "starter" }
        }
      }
    });

    prismaMock.plan.findUnique.mockResolvedValue({
      id: "plan_professional",
      code: "professional",
      name: "Professional"
    });

    createCheckoutSessionMock.mockResolvedValue({
      data: { url: "https://checkout.stripe.com/pay/cs_test_xyz" }
    });

    const formData = new FormData();
    formData.append("planCode", "professional");

    const response = await changeSubscription(
      new Request("https://autoquote.everyfacets.com/api/subscription/change", {
        method: "POST",
        body: formData
      })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://checkout.stripe.com/pay/cs_test_xyz");
    expect(createCheckoutSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "comp_123",
        companyName: "Every Facets",
        email: "owner@everyfacets.com",
        planCode: "professional"
      })
    );
  });

  test("updates existing Stripe subscription when stripeSubscriptionId exists", async () => {
    companyContextMock.mockResolvedValue({
      user: { email: "owner@everyfacets.com" },
      membership: { role: "OWNER" },
      company: {
        id: "comp_123",
        name: "Every Facets",
        subscription: {
          id: "sub_local_1",
          status: "ACTIVE",
          stripeSubscriptionId: "sub_stripe_real_123",
          stripeCustomerId: "cus_123",
          plan: { id: "plan_starter", code: "starter" }
        }
      }
    });

    prismaMock.plan.findUnique.mockResolvedValue({
      id: "plan_professional",
      code: "professional",
      name: "Professional",
      stripePriceId: "price_prof_123"
    });

    resolveCheckoutPriceIdMock.mockResolvedValue("price_prof_123");

    const stripeMock = {
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          id: "sub_stripe_real_123",
          items: {
            data: [{ id: "si_item_123" }]
          }
        }),
        update: vi.fn().mockResolvedValue({})
      }
    };
    getStripeClientMock.mockResolvedValue(stripeMock);

    const formData = new FormData();
    formData.append("planCode", "professional");

    const response = await changeSubscription(
      new Request("https://autoquote.everyfacets.com/api/subscription/change", {
        method: "POST",
        body: formData
      })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://autoquote.everyfacets.com/settings/billing?billing=updated");
    expect(stripeMock.subscriptions.update).toHaveBeenCalledWith(
      "sub_stripe_real_123",
      expect.objectContaining({
        items: [{ id: "si_item_123", price: "price_prof_123" }],
        proration_behavior: "create_prorations"
      })
    );
    expect(prismaMock.subscription.update).toHaveBeenCalledWith({
      where: { companyId: "comp_123" },
      data: {
        planId: "plan_professional",
        pendingPlanId: null,
        pendingPlanActiveAt: null,
        stripePriceId: "price_prof_123"
      }
    });
  });
});
