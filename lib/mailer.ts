import { Resend } from "resend";
import { resolveRuntimeSetting } from "@/lib/app-settings";

export type MailAttachment = {
  content?: string | Buffer;
  filename?: string;
  path?: string;
  contentType?: string;
};

export type EmailMessage = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: MailAttachment[];
};

export type AuthMail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

let resendClient: Resend | null = null;
let lastApiKey: string | null = null;

async function getResendClient(apiKey: string) {
  if (!resendClient || lastApiKey !== apiKey) {
    resendClient = new Resend(apiKey);
    lastApiKey = apiKey;
  }
  return resendClient;
}

async function resolveMailCredentials() {
  const apiKey = (await resolveRuntimeSetting("RESEND_API_KEY")) || process.env.RESEND_API_KEY?.trim() || null;
  const from =
    (await resolveRuntimeSetting("RESEND_FROM_EMAIL")) ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    null;

  return { apiKey, from };
}

/**
 * General purpose transactional email sender via Resend.
 */
export async function sendEmail(message: EmailMessage): Promise<{ success: boolean; id?: string }> {
  const { apiKey, from: defaultFrom } = await resolveMailCredentials();
  const from = message.from || defaultFrom;

  if (process.env.NODE_ENV !== "production" && (!apiKey || !from)) {
    const toStr = Array.isArray(message.to) ? message.to.join(", ") : message.to;
    console.info(`[mail:mock] to=${toStr} subject=${message.subject}`);
    if (message.text) console.info(message.text);
    return { success: true, id: "mock-email-id" };
  }

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  if (!from) {
    throw new Error("RESEND_FROM_EMAIL or EMAIL_FROM is not configured.");
  }

  const client = await getResendClient(apiKey);
  const { data, error } = await client.emails.send({
    from,
    to: message.to,
    subject: message.subject,
    text: message.text || "",
    html: message.html || "",
    replyTo: message.replyTo,
    cc: message.cc,
    bcc: message.bcc,
    attachments: message.attachments as any
  });

  if (error) {
    throw new Error(error.message);
  }

  if (process.env.NODE_ENV !== "production") {
    const toStr = Array.isArray(message.to) ? message.to.join(", ") : message.to;
    console.info(`[mail:resend] sent id=${data?.id ?? "unknown"} to=${toStr} subject=${message.subject}`);
  }

  return { success: true, id: data?.id };
}

/**
 * Backwards-compatible authentication and account transactional mailer.
 */
export async function sendAuthMail(message: AuthMail): Promise<void> {
  await sendEmail({
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html
  });
}
