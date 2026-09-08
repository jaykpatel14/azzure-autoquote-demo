import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock internal admin context to simulate an authenticated platform admin
vi.mock("@/lib/internal-admin", () => ({
  requireInternalAdminContext: vi.fn().mockResolvedValue({
    user: { id: "admin_123", email: "admin@azzure.com", adminRole: "SUPER_ADMIN" }
  }),
  InternalAdminAccessError: class InternalAdminAccessError extends Error {}
}));

// Mock deleteAdminCompany
const mockDeleteAdminCompany = vi.fn().mockResolvedValue({
  deleted: true,
  companyId: "company_pending_1",
  companyName: "Fake Jewelry Store",
  companySlug: "fake-jewelry-store",
  deletedUserCount: 1
});

vi.mock("@/lib/admin-companies", () => ({
  deleteAdminCompany: (...args: any[]) => mockDeleteAdminCompany(...args)
}));

// Mock prisma
const mockFindUniqueCompany = vi.fn();
const mockCompanyUpdate = vi.fn();
const mockAuditLogCreate = vi.fn().mockResolvedValue({});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    company: {
      findUnique: (...args: any[]) => mockFindUniqueCompany(...args),
      update: (...args: any[]) => mockCompanyUpdate(...args)
    },
    auditLog: {
      create: (...args: any[]) => mockAuditLogCreate(...args)
    }
  }
}));

// Mock account-workflow mails
const mockSendAccountSuspendedMail = vi.fn().mockResolvedValue({});
vi.mock("@/lib/account-workflow", () => ({
  sendAccountApprovedMail: vi.fn().mockResolvedValue({}),
  sendAccountSuspendedMail: (...args: any[]) => mockSendAccountSuspendedMail(...args),
  sendTierChangeMail: vi.fn().mockResolvedValue({})
}));

import { POST } from "@/app/api/admin/tenants/[companyId]/status/route";

describe("Admin Tenant Decline Workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("permanently deletes company and orphan user when accountStatus is DECLINED", async () => {
    mockFindUniqueCompany.mockResolvedValue({
      id: "company_pending_1",
      name: "Fake Jewelry Store",
      accountStatus: "PENDING_APPROVAL",
      memberships: [
        {
          role: "OWNER",
          user: { id: "user_fake_1", email: "bot@fake-spam.com", name: "Spam Bot" }
        }
      ]
    });

    const request = new Request("http://localhost/api/admin/tenants/company_pending_1/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountStatus: "DECLINED",
        suspendedReason: "Fake domain application"
      })
    });

    const response = await POST(request, {
      params: Promise.resolve({ companyId: "company_pending_1" })
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.deleted).toBe(true);
    expect(body.companyId).toBe("company_pending_1");

    // Verify notification was sent
    expect(mockSendAccountSuspendedMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "bot@fake-spam.com",
        reason: "Fake domain application"
      })
    );

    // Verify deleteAdminCompany was called to purge the database
    expect(mockDeleteAdminCompany).toHaveBeenCalledWith(
      expect.anything(),
      "admin_123",
      "company_pending_1"
    );
  });

  it("deletes company when declined from pending status via HTML form submission", async () => {
    mockFindUniqueCompany.mockResolvedValue({
      id: "company_pending_2",
      name: "Another Fake Jeweler",
      accountStatus: "PENDING_APPROVAL",
      memberships: [
        {
          role: "OWNER",
          user: { id: "user_fake_2", email: "bot2@fake-spam.com", name: null }
        }
      ]
    });

    const formData = new FormData();
    formData.append("accountStatus", "DECLINED");
    formData.append("next", "/admin/tenants/pending");

    const request = new Request("http://localhost/api/admin/tenants/company_pending_2/status", {
      method: "POST",
      body: formData
    });

    const response = await POST(request, {
      params: Promise.resolve({ companyId: "company_pending_2" })
    });

    expect(response.status).toBe(303);
    const location = response.headers.get("Location");
    expect(location).toContain("/admin/tenants/pending");
    expect(location).toContain("declined=1");

    expect(mockDeleteAdminCompany).toHaveBeenCalledWith(
      expect.anything(),
      "admin_123",
      "company_pending_2"
    );
  });

  it("also purges company if legacy SUSPENDED is submitted on a PENDING_APPROVAL account", async () => {
    mockFindUniqueCompany.mockResolvedValue({
      id: "company_pending_3",
      name: "Legacy Suspended Form",
      accountStatus: "PENDING_APPROVAL",
      memberships: [
        {
          role: "OWNER",
          user: { id: "user_fake_3", email: "bot3@fake-spam.com", name: null }
        }
      ]
    });

    const request = new Request("http://localhost/api/admin/tenants/company_pending_3/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountStatus: "SUSPENDED"
      })
    });

    const response = await POST(request, {
      params: Promise.resolve({ companyId: "company_pending_3" })
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.deleted).toBe(true);

    expect(mockDeleteAdminCompany).toHaveBeenCalledWith(
      expect.anything(),
      "admin_123",
      "company_pending_3"
    );
  });
});
