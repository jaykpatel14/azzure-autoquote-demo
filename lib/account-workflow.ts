import { sendAuthMail } from "@/lib/mailer";

function buildAppUrl(path: string) {
  return new URL(path, process.env.APP_URL || "http://localhost:3000").toString();
}

function tierLabel(tier: "TIER_1" | "TIER_2" | "TIER_3") {
  switch (tier) {
    case "TIER_1":
      return "Tier 1 - Premium";
    case "TIER_2":
      return "Tier 2 - Standard";
    case "TIER_3":
      return "Tier 3 - Basic";
  }
}

export async function sendSignupApprovalAlert(input: {
  companyName: string;
  ownerName: string;
  ownerEmail: string;
  websiteUrl?: string | null;
  signedUpAt: Date;
}) {
  const to = process.env.PRODUCTION_TEAM_EMAIL?.trim();
  if (!to) return;

  const websiteLine = input.websiteUrl?.trim() || "Not provided";
  const text = [
    "A new jewelry business has signed up for AI AutoQuote and is awaiting approval.",
    "",
    `Business:  ${input.companyName}`,
    `Owner:     ${input.ownerName}`,
    `Email:     ${input.ownerEmail}`,
    `Website:   ${websiteLine}`,
    `Signed up: ${input.signedUpAt.toISOString()}`,
    "",
    `Open in admin dashboard: ${buildAppUrl("/admin/tenants/pending")}`
  ].join("\n");

  await sendAuthMail({
    to,
    subject: `New AI AutoQuote signup awaiting approval - ${input.companyName}`,
    text,
    html: `<p>${text.replaceAll("\n", "<br />")}</p>`
  });
}

export async function sendAccountApprovedMail(input: {
  to: string;
  ownerName: string;
  companyName: string;
  tier: "TIER_1" | "TIER_2" | "TIER_3";
}) {
  const loginUrl = buildAppUrl("/signin");
  const subject = "Your AI AutoQuote account is approved";
  const body = [
    `Hi ${input.ownerName},`,
    "",
    `Your AI AutoQuote account for ${input.companyName} has been approved.`,
    "",
    `You've been set up on our ${tierLabel(input.tier)} pricing program.`,
    "",
    "Log in to start generating quotes:",
    loginUrl,
    "",
    "If you have any questions, reply to this email or contact",
    "support@azzuresolutions.com",
    "",
    "- The AI AutoQuote Team"
  ].join("\n");

  await sendAuthMail({
    to: input.to,
    subject,
    text: body,
    html: `<p>${body.replaceAll("\n", "<br />")}</p>`
  });
}

export async function sendTierChangeMail(input: {
  to: string;
  ownerName: string;
  companyName: string;
  previousTier: "TIER_1" | "TIER_2" | "TIER_3" | null;
  newTier: "TIER_1" | "TIER_2" | "TIER_3";
}) {
  const subject = "Your AI AutoQuote pricing tier has changed";
  const body = [
    `Hi ${input.ownerName},`,
    "",
    `Your AI AutoQuote account for ${input.companyName} has been updated.`,
    "",
    `Previous tier: ${input.previousTier ? tierLabel(input.previousTier) : "Not set"}`,
    `Current tier:   ${tierLabel(input.newTier)}`,
    "",
    "If you have any questions, contact",
    "support@azzuresolutions.com",
    "",
    "- The AI AutoQuote Team"
  ].join("\n");

  await sendAuthMail({
    to: input.to,
    subject,
    text: body,
    html: `<p>${body.replaceAll("\n", "<br />")}</p>`
  });
}

export async function sendAccountSuspendedMail(input: {
  to: string;
  ownerName: string;
  companyName: string;
  reason?: string | null;
}) {
  const subject = "Your AI AutoQuote account is suspended";
  const body = [
    `Hi ${input.ownerName},`,
    "",
    `Your AI AutoQuote account for ${input.companyName} has been suspended.`,
    input.reason ? `Reason: ${input.reason}` : "Reason: Not provided",
    "",
    "Please contact support@azzuresolutions.com if you believe this is a mistake.",
    "",
    "- The AI AutoQuote Team"
  ].join("\n");

  await sendAuthMail({
    to: input.to,
    subject,
    text: body,
    html: `<p>${body.replaceAll("\n", "<br />")}</p>`
  });
}
