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
const resolveCheckoutCustomerIdMock = vi.hoisted(() => vi.fn());
const resolveCheckoutPriceIdMock = vi.hoisted(() => vi.fn());
const buildAppUrlMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock
}));

vi.mock("@/lib/company", () => ({
  requireCompanyContext: companyContextMock,
  AuthRequiredError: class AuthRequiredError extends Error {},
  CompanyAccessError: class CompanyAccessError extends Error {},
  canManageBilling: vi.fn(() => true)
}));

vi.mock("@/lib/stripe", () => ({
  buildAppUrl: buildAppUrlMock,
  getStripeClient: getStripeClientMock,
  resolveCheckoutCustomerId: resolveCheckoutCustomerIdMock,
  resolveCheckoutPriceId: resolveCheckoutPriceIdMock
}));

vi.mock("@/lib/security", () => ({
  getRequestBaseUrl: vi.fn()
}));

import { POST as checkoutBilling } from "@/app/api/billing/checkout/route";

describe("billing checkout route", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    companyContextMock.mockReset();
    getStripeClientMock.mockReset();
    resolveCheckoutCustomerIdMock.mockReset();
    resolveCheckoutPriceIdMock.mockReset();
    buildAppUrlMock.mockReset();
    prismaMock.plan.findUnique.mockReset();
    prismaMock.subscription.findUnique.mockReset();
    prismaMock.subscription.upsert.mockReset();
    prismaMock.subscription.update.mockReset();
    prismaMock.usagePeriod.upsert.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("boots a missing subscription record and starts checkout for customers", async () => {
    const now = new Date("2026-08-04T12:00:00.000Z");
    vi.setSystemTime(now);

    companyContextMock.mockResolvedValue({
      user: {
        email: "customer@example.test"
      },
      company: {
        id: "company_123",
        name: "Every Facets",
        subscription: null
      }
    });

    prismaMock.plan.findUnique.mockImplementation(async ({ where }) => {
      if (where.code === "starter") {
        return {
          id: "plan_starter",
          code: "starter",
          name: "Starter",
          monthlyPriceCents: 4900,
          monthlyLimit: 100,
          stripePriceId: null,
          stripeProductId: null
        };
      }

      return {
        id: "plan_professional",
        code: "professional",
        name: "Professional",
        monthlyPriceCents: 9900,
        monthlyLimit: 500,
        stripePriceId: "price_professional",
        stripeProductId: null
      };
    });
    prismaMock.subscription.findUnique.mockResolvedValue(null);

    prismaMock.subscription.upsert.mockResolvedValue({
      companyId: "company_123",
      stripeCustomerId: null
    });

    prismaMock.usagePeriod.upsert.mockResolvedValue({
      id: "usage_period_123"
    });

    resolveCheckoutPriceIdMock.mockResolvedValue("price_professional");
    resolveCheckoutCustomerIdMock.mockImplementation(async ({ persistStripeCustomerId }) => {
      await persistStripeCustomerId("cus_new");
      return "cus_new";
    });

    const stripeMock = {
      checkout: {
        sessions: {
          create: vi.fn().mockResolvedValue({
            url: "https://checkout.stripe.test/session"
          })
        }
      }
    };
    getStripeClientMock.mockResolvedValue(stripeMock);
    buildAppUrlMock.mockImplementation((path: string) => new URL(path, "https://everyfacets.test").toString());

    const response = await checkoutBilling(
      new Request("https://everyfacets.test/api/billing/checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          planCode: "professional"
        })
      })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://checkout.stripe.test/session");
    expect(prismaMock.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: "company_123" },
        create: expect.objectContaining({
          companyId: "company_123",
          planId: "plan_professional",
          status: "TRIALING"
        })
      })
    );
    expect(prismaMock.usagePeriod.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId_periodStart_periodEnd: {
            companyId: "company_123",
            periodStart: new Date("2026-08-04T12:00:00.000Z"),
            periodEnd: new Date("2026-08-18T12:00:00.000Z")
          }
        }
      })
    );
    expect(prismaMock.subscription.update).toHaveBeenCalledWith({
      where: { companyId: "company_123" },
      data: { stripeCustomerId: "cus_new" }
    });
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        customer: "cus_new",
        metadata: {
          companyId: "company_123",
          planCode: "professional",
          planId: "plan_professional"
        }
      })
    );
  });
});
