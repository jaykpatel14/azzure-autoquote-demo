import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/internal-admin", () => ({
  requireInternalAdminContext: vi.fn().mockResolvedValue({
    user: { id: "admin_1", email: "admin@azzure.com" }
  }),
  InternalAdminAccessError: class InternalAdminAccessError extends Error {}
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: {
      findUnique: vi.fn()
    },
    subscription: {
      update: vi.fn()
    }
  }
}));

vi.mock("@/src/services/subscriptions", () => ({
  createCheckoutSession: vi.fn()
}));

vi.mock("@/lib/mailer", () => ({
  sendAuthMail: vi.fn().mockResolvedValue({ id: "mock_mail_id" })
}));

import { POST } from "@/app/api/admin/tenants/[companyId]/checkout-link/route";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession } from "@/src/services/subscriptions";
import { sendAuthMail } from "@/lib/mailer";

describe("Admin Stripe Checkout Link Generation (/api/admin/tenants/[companyId]/checkout-link)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates a Stripe Checkout URL for a tenant missing payment details", async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce({
      id: "comp_123",
      name: "Premier Trading Corp",
      subscription: {
        plan: { code: "starter", id: "plan_starter" }
      },
      memberships: [
        {
          role: "OWNER",
          user: { email: "owner@premiertrading.test" }
        }
      ]
    } as any);

    vi.mocked(createCheckoutSession).mockResolvedValueOnce({
      data: { url: "https://checkout.stripe.com/c/pay/cs_test_abc123" }
    });

    const request = new Request("http://localhost:3000/api/admin/tenants/comp_123/checkout-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sendEmail: false })
    });

    const response = await POST(request, { params: Promise.resolve({ companyId: "comp_123" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.checkoutUrl).toBe("https://checkout.stripe.com/c/pay/cs_test_abc123");
    expect(data.emailSent).toBe(false);
    expect(data.ownerEmail).toBe("owner@premiertrading.test");
    expect(sendAuthMail).not.toHaveBeenCalled();
  });

  it("sends an email to the owner when sendEmail is true", async () => {
    vi.mocked(prisma.company.findUnique).mockResolvedValueOnce({
      id: "comp_456",
      name: "Diamond Tradex corporation",
      subscription: {
        plan: { code: "professional", id: "plan_pro" }
      },
      memberships: [
        {
          role: "OWNER",
          user: { email: "owner@diamondtradex.test" }
        }
      ]
    } as any);

    vi.mocked(createCheckoutSession).mockResolvedValueOnce({
      data: { url: "https://checkout.stripe.com/c/pay/cs_test_xyz789" }
    });

    const request = new Request("http://localhost:3000/api/admin/tenants/comp_456/checkout-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sendEmail: true })
    });

    const response = await POST(request, { params: Promise.resolve({ companyId: "comp_456" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.emailSent).toBe(true);
    expect(sendAuthMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "owner@diamondtradex.test",
        subject: expect.stringContaining("Diamond Tradex corporation")
      })
    );
  });
});
