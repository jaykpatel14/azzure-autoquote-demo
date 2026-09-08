import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn()
    },
    plan: {
      findUnique: vi.fn()
    },
    pendingRegistration: {
      upsert: vi.fn(),
      update: vi.fn()
    }
  }
}));

vi.mock("@/lib/stripe", () => ({
  buildAppUrl: vi.fn((path: string) => `http://localhost:3000${path}`),
  getStripeClient: vi.fn(),
  resolveCheckoutPriceId: vi.fn().mockResolvedValue("price_test_123")
}));

vi.mock("@/lib/email-mx-validation", () => ({
  validateEmailDomainMx: vi.fn().mockResolvedValue({ valid: true })
}));

import { POST as checkoutPost } from "@/app/api/checkout/route";
import { POST as registerPost } from "@/app/api/auth/register/route";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";

describe("Upfront Stripe Checkout Gating (/api/checkout & /api/auth/register)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks direct API registration at /api/auth/register to prevent unbacked accounts", async () => {
    const response = await registerPost();
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Direct registration is disabled");
  });

  it("creates a PendingRegistration record and returns Stripe checkout URL without provisioning database user/company upfront", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);
    vi.mocked(prisma.plan.findUnique).mockResolvedValueOnce({
      id: "plan_pro",
      code: "professional"
    } as any);

    vi.mocked(prisma.pendingRegistration.upsert).mockResolvedValueOnce({
      id: "pending_123",
      email: "newstore@jewelryboutique.com",
      companyName: "Royal Gems Atelier",
      planCode: "professional"
    } as any);

    const mockCreateSession = vi.fn().mockResolvedValueOnce({
      id: "cs_test_session999",
      url: "https://checkout.stripe.com/c/pay/cs_test_session999"
    });

    vi.mocked(getStripeClient).mockResolvedValueOnce({
      checkout: {
        sessions: {
          create: mockCreateSession
        }
      }
    } as any);

    const request = new Request("http://localhost:3000/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "newstore@jewelryboutique.com",
        password: "SuperSecretPassword123!",
        companyName: "Royal Gems Atelier",
        planCode: "professional"
      })
    });


    const response = await checkoutPost(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.url).toBe("https://checkout.stripe.com/c/pay/cs_test_session999");

    // Pending registration was saved
    expect(prisma.pendingRegistration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "newstore@jewelryboutique.com" }
      })
    );

    // Stripe checkout session received metadata
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        customer_email: "newstore@jewelryboutique.com",
        metadata: expect.objectContaining({
          pendingRegistrationId: "pending_123"
        })
      })
    );


    // Recorded Stripe session id on pending registration
    expect(prisma.pendingRegistration.update).toHaveBeenCalledWith({
      where: { id: "pending_123" },
      data: { stripeSessionId: "cs_test_session999" }
    });
  });
});
