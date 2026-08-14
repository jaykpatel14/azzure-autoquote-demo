import { sendAuthMail } from "@/lib/mailer";

function buildAppUrl(path: string) {
  return new URL(path, process.env.APP_URL || "http://localhost:3000").toString();
}

function getCkWebsiteUrl() {
  return process.env.CK_WEBSITE_URL?.trim() || "https://customking.com";
}

function getProductionTeamEmail() {
  return process.env.PRODUCTION_TEAM_EMAIL?.trim() || null;
}

function buildEmailBody(lines: string[]) {
  const text = lines.join("\n");
  return {
    text,
    html: `<p>${text.replaceAll("\n", "<br />")}</p>`
  };
}

export async function sendOrderSubmittedEmail(input: {
  companyName: string;
  orderNumber: string;
  quoteNumber: string;
  itemName: string;
  orderUrl?: string;
}) {
  const to = getProductionTeamEmail();
  if (!to) return;

  const subject = `New manufacturing order submitted - ${input.orderNumber}`;
  const body = buildEmailBody([
    "A new manufacturing order has been submitted.",
    "",
    `Company: ${input.companyName}`,
    `Order:   ${input.orderNumber}`,
    `Quote:   ${input.quoteNumber}`,
    `Item:    ${input.itemName}`,
    `Order URL: ${input.orderUrl ?? buildAppUrl(`/orders`)}`,
    "",
    `Custom King portal: ${getCkWebsiteUrl()}`
  ]);

  await sendAuthMail({ to, subject, ...body });
}

export async function sendOrderPlacedEmail(input: {
  companyName: string;
  orderNumber: string;
  ckOrderId: string;
  ckOrderUrl?: string | null;
  orderUrl?: string;
}) {
  const to = getProductionTeamEmail();
  if (!to) return;

  const subject = `Custom King order placed - ${input.orderNumber}`;
  const body = buildEmailBody([
    "A manufacturing order has been placed with Custom King.",
    "",
    `Company: ${input.companyName}`,
    `Order:   ${input.orderNumber}`,
    `CK ID:   ${input.ckOrderId}`,
    `CK URL:   ${input.ckOrderUrl ?? getCkWebsiteUrl()}`,
    `Order URL: ${input.orderUrl ?? buildAppUrl(`/orders`)}`,
    "",
    `Custom King portal: ${getCkWebsiteUrl()}`
  ]);

  await sendAuthMail({ to, subject, ...body });
}

export async function sendOrderCompletedEmail(input: {
  companyName: string;
  orderNumber: string;
  orderUrl?: string;
}) {
  const to = getProductionTeamEmail();
  if (!to) return;

  const subject = `Manufacturing order completed - ${input.orderNumber}`;
  const body = buildEmailBody([
    "A manufacturing order has been marked complete.",
    "",
    `Company: ${input.companyName}`,
    `Order:   ${input.orderNumber}`,
    `Order URL: ${input.orderUrl ?? buildAppUrl(`/orders`)}`,
    "",
    `Custom King portal: ${getCkWebsiteUrl()}`
  ]);

  await sendAuthMail({ to, subject, ...body });
}
