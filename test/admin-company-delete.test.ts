import { describe, it, expect, vi, beforeEach } from "vitest";
import { deleteAdminCompany, deleteAdminCompanyMember } from "@/lib/admin-companies";
import { sendEmail, sendAuthMail } from "@/lib/mailer";

describe("Admin Company and Member Deletion", () => {
  it("deletes a company and its orphan users when user has no other company", async () => {
    const mockCompany = {
      id: "comp_123",
      name: "Acme Diamonds",
      slug: "acme-diamonds"
    };

    const mockMemberships = [
      { userId: "user_1" },
      { userId: "user_2" }
    ];

    const mockClient = {
      company: {
        findUnique: vi.fn().mockResolvedValue(mockCompany),
        delete: vi.fn().mockResolvedValue(mockCompany)
      },
      membership: {
        findMany: vi.fn().mockImplementation(({ where }) => {
          // If checking for member users of the company
          if (where.companyId === "comp_123") {
            return Promise.resolve(mockMemberships);
          }
          // If checking other memberships for user_1 (none)
          if (where.userId === "user_1") {
            return Promise.resolve([]);
          }
          // If checking other memberships for user_2 (belongs to another company)
          if (where.userId === "user_2") {
            return Promise.resolve([{ id: "mem_other" }]);
          }
          return Promise.resolve([]);
        })
      },
      user: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 })
      }
    };

    const result = await deleteAdminCompany(mockClient as any, "admin_user", "comp_123");

    expect(result.deleted).toBe(true);
    expect(result.companyId).toBe("comp_123");
    expect(result.companyName).toBe("Acme Diamonds");
    expect(result.deletedUserCount).toBe(1); // Only user_1 was an orphan

    expect(mockClient.company.delete).toHaveBeenCalledWith({
      where: { id: "comp_123" }
    });
    expect(mockClient.user.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["user_1"] } }
    });
  });

  it("deletes a company member and deletes the user if orphan", async () => {
    const mockMembership = {
      id: "mem_1",
      companyId: "comp_123",
      userId: "user_orphan",
      role: "CUSTOMER",
      user: { id: "user_orphan", email: "client@example.com", name: "Client Name" },
      company: { id: "comp_123", name: "Acme Diamonds" }
    };

    const mockClient = {
      membership: {
        findUnique: vi.fn().mockResolvedValue(mockMembership),
        findMany: vi.fn().mockResolvedValue([]), // No other memberships
        delete: vi.fn().mockResolvedValue(mockMembership)
      },
      user: {
        delete: vi.fn().mockResolvedValue({ id: "user_orphan" })
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: "log_1" })
      }
    };

    const result = await deleteAdminCompanyMember(
      mockClient as any,
      "admin_user",
      "comp_123",
      "user_orphan",
      true
    );

    expect(result.success).toBe(true);
    expect(result.userDeleted).toBe(true);
    expect(result.userEmail).toBe("client@example.com");
    expect(mockClient.membership.delete).toHaveBeenCalledWith({
      where: { id: "mem_1" }
    });
    expect(mockClient.user.delete).toHaveBeenCalledWith({
      where: { id: "user_orphan" }
    });
  });
});

describe("Resend Email Integration (lib/mailer)", () => {
  it("gracefully sends mock email in test/dev environment without crashing", async () => {
    const res = await sendEmail({
      to: "customer@luxuryjeweler.com",
      subject: "Your Custom Ring Quote",
      text: "Quote total: $2,400",
      html: "<p>Quote total: $2,400</p>"
    });

    expect(res.success).toBe(true);
  });

  it("sendAuthMail executes successfully with recipient and subject", async () => {
    await expect(
      sendAuthMail({
        to: "jeweler@example.com",
        subject: "Verify your email",
        text: "Please verify your email",
        html: "<p>Please verify your email</p>"
      })
    ).resolves.not.toThrow();
  });
});
