import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/prisma";

const stripeMock = vi.hoisted(() => ({
  checkout: {
    sessions: {
      retrieve: vi.fn()
    }
  },
  webhooks: {
    constructEvent: vi.fn()
  },
  subscriptions: {
    retrieve: vi.fn()
  }
}));

vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => stripeMock,
  getStripeWebhookSecret: () => "whsec_test",
  buildAppUrl: (path: string) => `http://localhost:3000${path}`
}));

import { POST as billingWebhook } from "@/app/api/billing/webhook/route";
import { syncStripeCheckoutSession } from "@/lib/billing-webhooks";

const createdCompanies: string[] = [];
const createdWebhookEventIds: string[] = [];

function currentMonthRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

async function createCompanyFixture() {
  const companyId = `company_${randomUUID().slice(0, 8)}`;
  const slug = `billing-${randomUUID().slice(0, 8)}`;

  await prisma.company.create({
    data: {
      id: companyId,
      name: `Billing Company ${slug}`,
      slug,
      quoteSequence: 0,
      pricingProfile: { create: {} }
    }
  });

  createdCompanies.push(companyId);
  return { companyId };
}

function buildSubscriptionEvent(companyId: string, eventId: string) {
  const { start, end } = currentMonthRange();

  return {
    id: eventId,
    type: "customer.subscription.updated",
    livemode: false,
    data: {
      object: {
        id: `sub_${companyId}`,
        customer: `cus_${companyId}`,
        status: "active",
        cancel_at_period_end: false,
        current_period_start: Math.floor(start.getTime() / 1000),
        current_period_end: Math.floor(end.getTime() / 1000),
        metadata: {
          companyId,
          planCode: "professional"
        },
        items: {
          data: [
            {
              current_period_start: Math.floor(start.getTime() / 1000),
              current_period_end: Math.floor(end.getTime() / 1000),
              price: {
                id: "price_professional",
                product: "prod_professional"
              }
            }
          ]
        }
      }
    }
  } as const;
}

function buildTrialSubscriptionEvent(companyId: string, eventId: string) {
  const { start, end } = currentMonthRange();

  return {
    id: eventId,
    type: "customer.subscription.updated",
    livemode: false,
    data: {
      object: {
        id: `sub_${companyId}`,
        customer: `cus_${companyId}`,
        status: "trialing",
        cancel_at_period_end: false,
        current_period_start: Math.floor(start.getTime() / 1000),
        current_period_end: Math.floor(end.getTime() / 1000),
        metadata: {
          companyId,
          planCode: "starter",
          trialQuoteCap: "40"
        },
        items: {
          data: [
            {
              current_period_start: Math.floor(start.getTime() / 1000),
              current_period_end: Math.floor(end.getTime() / 1000),
              price: {
                id: "price_starter",
                product: "prod_starter"
              }
            }
          ]
        }
      }
    }
  } as const;
}

beforeAll(async () => {
  expect(process.env.DATABASE_URL).toBeTruthy();
});

beforeEach(() => {
  stripeMock.checkout.sessions.retrieve.mockReset();
  stripeMock.webhooks.constructEvent.mockReset();
  stripeMock.subscriptions.retrieve.mockReset();
});

afterAll(async () => {
  await prisma.company.deleteMany({
    where: { id: { in: createdCompanies } }
  });

  await prisma.stripeWebhookEvent.deleteMany({
    where: { eventId: { in: createdWebhookEventIds } }
  });

  await prisma.$disconnect();
});

describe("billing webhook integration", () => {
  test("processes duplicate Stripe webhooks only once", { timeout: 15000 }, async () => {
    const company = await createCompanyFixture();
    const eventId = `evt_${randomUUID().slice(0, 8)}`;
    const event = buildSubscriptionEvent(company.companyId, eventId);
    createdWebhookEventIds.push(eventId);

    stripeMock.webhooks.constructEvent.mockReturnValue(event);

    const makeRequest = () =>
      new Request("http://localhost/api/billing/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_test"
        },
        body: "raw-body"
      });

    const firstResponse = await billingWebhook(makeRequest());
    const secondResponse = await billingWebhook(makeRequest());

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);

    const eventCount = await prisma.stripeWebhookEvent.count({
      where: { eventId }
    });
    const subscription = await prisma.subscription.findFirstOrThrow({
      where: { companyId: company.companyId }
    });
    const usagePeriod = await prisma.usagePeriod.findFirstOrThrow({
      where: { companyId: company.companyId }
    });

    expect(eventCount).toBe(1);
    expect(subscription.status).toBe("ACTIVE");
    expect(subscription.stripeSubscriptionId).toBe(`sub_${company.companyId}`);
    expect(subscription.stripeCustomerId).toBe(`cus_${company.companyId}`);
    expect(subscription.stripePriceId).toBe("price_professional");
    expect(subscription.stripeProductId).toBe("prod_professional");
    expect(usagePeriod.limit).toBe(1200);
  });

  test("caps trialing subscriptions at 40 requests", { timeout: 15000 }, async () => {
    const company = await createCompanyFixture();
    const eventId = `evt_${randomUUID().slice(0, 8)}`;
    const event = buildTrialSubscriptionEvent(company.companyId, eventId);
    createdWebhookEventIds.push(eventId);

    stripeMock.webhooks.constructEvent.mockReturnValue(event);

    const response = await billingWebhook(
      new Request("http://localhost/api/billing/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_test"
        },
        body: "raw-body"
      })
    );

    expect(response.status).toBe(200);

    const usagePeriod = await prisma.usagePeriod.findFirstOrThrow({
      where: { companyId: company.companyId }
    });

    expect(usagePeriod.limit).toBe(40);
  });

  test("syncs an upgraded checkout session back into the database immediately", { timeout: 15000 }, async () => {
    const company = await createCompanyFixture();
    const enterprisePlan = await prisma.plan.findUniqueOrThrow({
      where: { code: "enterprise" }
    });
    const { start, end } = currentMonthRange();
    const sessionId = `cs_${randomUUID().slice(0, 8)}`;
    const subscriptionId = `sub_${randomUUID().slice(0, 8)}`;

    stripeMock.checkout.sessions.retrieve.mockResolvedValue({
      id: sessionId,
      mode: "subscription",
      subscription: subscriptionId,
      metadata: {
        companyId: company.companyId,
        planCode: "enterprise"
      }
    });

    stripeMock.subscriptions.retrieve.mockResolvedValue({
      id: subscriptionId,
      customer: `cus_${company.companyId}`,
      status: "active",
      cancel_at_period_end: false,
      current_period_start: Math.floor(start.getTime() / 1000),
      current_period_end: Math.floor(end.getTime() / 1000),
      metadata: {
        companyId: company.companyId,
        planCode: "enterprise"
      },
      items: {
        data: [
          {
            current_period_start: Math.floor(start.getTime() / 1000),
            current_period_end: Math.floor(end.getTime() / 1000),
            price: {
              id: enterprisePlan.stripePriceId,
              product: enterprisePlan.stripeProductId
            }
          }
        ]
      }
    } as never);

    await syncStripeCheckoutSession(sessionId, {
      prisma,
      stripe: stripeMock as never,
      expectedCompanyId: company.companyId
    });

    const subscription = await prisma.subscription.findFirstOrThrow({
      where: { companyId: company.companyId }
    });
    const usagePeriod = await prisma.usagePeriod.findFirstOrThrow({
      where: { companyId: company.companyId }
    });

    expect(subscription.planId).toBe(enterprisePlan.id);
    expect(subscription.stripeSubscriptionId).toBe(subscriptionId);
    expect(subscription.stripeCustomerId).toBe(`cus_${company.companyId}`);
    expect(usagePeriod.limit).toBe(enterprisePlan.monthlyLimit);
  });
});
