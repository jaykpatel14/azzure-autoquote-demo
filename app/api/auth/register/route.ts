import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { onboardCompanyOwner } from "@/lib/onboarding";
import { createEmailVerificationToken } from "@/lib/auth-tokens";
import { sendAuthMail } from "@/lib/mailer";
import { getRequestBaseUrl } from "@/lib/security";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(120).optional(),
  companyName: z.string().trim().min(2).max(120)
});

function buildAppUrl(path: string, baseUrl: string) {
  return new URL(path, baseUrl).toString();
}

export async function POST(request: Request) {
  try {
    const input = registerSchema.parse(await request.json());
    const email = input.email.toLowerCase();

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });

    if (existing) {
      return NextResponse.json({ error: "An account already exists for that email." }, { status: 409 });
    }

    const passwordHash = hashPassword(input.password);

    const { user, company } = await prisma.$transaction(async (tx) => {
      return onboardCompanyOwner(tx, {
        email,
        name: input.name,
        passwordHash,
        companyName: input.companyName
      });
    });

    const token = await createEmailVerificationToken(user.id, company.id);
    const verificationUrl = buildAppUrl(`/verify-email?token=${token}`, getRequestBaseUrl(request));

    let emailSent = true;
    try {
      await sendAuthMail({
        to: user.email,
        subject: "Verify your Azzure AutoQuote account",
        text: `Verify your email address: ${verificationUrl}`,
        html: `<p>Verify your email address: <a href="${verificationUrl}">${verificationUrl}</a></p>`
      });
    } catch (mailError) {
      emailSent = false;
      console.warn(
        `[auth] verification email delivery failed for ${user.email}: ${
          mailError instanceof Error ? mailError.message : "unknown error"
        }`
      );
    }

    return NextResponse.json({
      ok: true,
      email: user.email,
      emailSent,
      verificationToken: emailSent ? undefined : token
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create account." },
      { status: 400 }
    );
  }
}
