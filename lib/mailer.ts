import { Resend } from "resend";
import { requireEnv } from "@/lib/env";

type AuthMail = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

let resendClient: Resend | null = null;

function getResendClient() {
  if (!resendClient) {
    resendClient = new Resend(requireEnv("RESEND_API_KEY"));
  }

  return resendClient;
}

function getMailFrom() {
  return process.env.RESEND_FROM_EMAIL?.trim() || process.env.EMAIL_FROM?.trim() || null;
}

export async function sendAuthMail(message: AuthMail) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = getMailFrom();

  if (process.env.NODE_ENV !== "production" && (!apiKey || !from)) {
    console.info(`[mail] to=${message.to} subject=${message.subject}`);
    console.info(message.text);
    return;
  }

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  if (!from) {
    throw new Error("RESEND_FROM_EMAIL or EMAIL_FROM is not configured.");
  }

  const { data, error } = await getResendClient().emails.send({
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html
  });

  if (error) {
    throw new Error(error.message);
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(`[mail] sent via Resend id=${data?.id ?? "unknown"} to=${message.to} subject=${message.subject}`);
  }
}
