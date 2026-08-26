import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createEmailVerificationToken } from "@/lib/auth-tokens";
import { sendAuthMail } from "@/lib/mailer";

const resendOtpSchema = z.object({
  email: z.string().trim().email()
});

function buildAppUrl(path: string) {
  return new URL(path, process.env.APP_URL || "http://localhost:3000").toString();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = resendOtpSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { memberships: { select: { companyId: true } } }
    });

    if (!user) {
      // Return ok to prevent user enumeration attacks
      return NextResponse.json({ ok: true, message: "If an account exists, a new code has been sent." });
    }

    if (user.emailVerifiedAt) {
      return NextResponse.json({ ok: true, alreadyVerified: true, message: "Email is already verified." });
    }

    const companyId = user.memberships[0]?.companyId || "global";
    const { token, otp } = await createEmailVerificationToken(user.id, companyId);
    const verificationUrl = buildAppUrl(`/verify-email?token=${token}&email=${encodeURIComponent(user.email)}`);

    await sendAuthMail({
      to: user.email,
      subject: `${otp} is your new Azzure AI Quote verification code`,
      text: `Your new Azzure AI Quote verification code is: ${otp}\n\nEnter this 6-digit code on the verification screen, or click the link below to verify your email:\n${verificationUrl}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; background: #080e22; color: #f8fafc; border-radius: 16px;">
          <h2 style="color: #38bdf8; margin-top: 0;">Your New Verification Code</h2>
          <p style="color: #94a3b8; font-size: 15px;">Here is your requested 6-digit verification code to activate your account:</p>
          <div style="margin: 24px 0; padding: 18px; background: #040711; border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 12px; text-align: center;">
            <span style="font-family: monospace; font-size: 36px; font-weight: bold; letter-spacing: 0.25em; color: #f5d061;">${otp}</span>
          </div>
          <p style="color: #94a3b8; font-size: 14px;">Or verify automatically with one click:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${verificationUrl}" style="background: linear-gradient(135deg, #38bdf8, #2563eb); color: #ffffff; padding: 12px 28px; border-radius: 9999px; text-decoration: none; font-weight: bold; display: inline-block;">Verify Email Address →</a>
          </div>
          <p style="color: #64748b; font-size: 12px; margin-top: 24px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px;">This code is valid for 24 hours.</p>
        </div>
      `
    });

    return NextResponse.json({ ok: true, message: "Verification code sent." });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send verification code." },
      { status: 400 }
    );
  }
}
