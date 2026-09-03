import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendSignupApprovalAlert } from "@/lib/account-workflow";
import * as mailer from "@/lib/mailer";

describe("account-workflow approval alerts", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sends signup approval alert to approvals@azzuresolutions.com by default", async () => {
    const sendAuthMailSpy = vi.spyOn(mailer, "sendAuthMail").mockResolvedValue(undefined);

    await sendSignupApprovalAlert({
      companyName: "Montreal Fine Jewels",
      ownerName: "Jean Tremblay",
      ownerEmail: "jean@montrealjewels.ca",
      websiteUrl: "https://montrealjewels.ca",
      signedUpAt: new Date("2026-09-03T10:00:00Z")
    });

    expect(sendAuthMailSpy).toHaveBeenCalledTimes(1);
    const mailPayload = sendAuthMailSpy.mock.calls[0][0];
    expect(mailPayload.to).toBe("approvals@azzuresolutions.com");
    expect(mailPayload.subject).toContain("Montreal Fine Jewels");
    expect(mailPayload.text).toContain("jean@montrealjewels.ca");
  });
});
