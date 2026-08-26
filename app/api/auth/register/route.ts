import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { onboardCompanyOwner } from "@/lib/onboarding";
import { createEmailVerificationToken } from "@/lib/auth-tokens";
import { sendSignupApprovalAlert } from "@/lib/account-workflow";
import { sendAuthMail } from "@/lib/mailer";
import { validateEmail } from "@/lib/email-validation";

const registerSchema = z.object({
  email: z.string().trim().superRefine((val, ctx) => {
    const check = validateEmail(val);
    if (!check.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: check.error || "Please enter a valid business email address."
      });
    }
  }),
  password: z.string().min(8).max(200),
  companyName: z.string().trim().min(2).max(120)
});

function buildAppUrl(path: string) {
  return new URL(path, process.env.APP_URL || "http://localhost:3000").toString();
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
    let createdUser: { id: string, email: string, name: string | null } | null = null;
    let createdCompany: { id: string, name: string, createdAt: Date } | null = null;

    try {
      const { user, company } = await prisma.$transaction(async (tx) => {
        return onboardCompanyOwner(tx, {
          email,
          passwordHash,
          companyName: input.companyName
        });
      });
      
      createdUser = user;
      createdCompany = company;

      const { token, otp } = await createEmailVerificationToken(user.id, company.id);
      const verificationUrl = buildAppUrl(`/verify-email?token=${token}&email=${encodeURIComponent(user.email)}`);

      await sendAuthMail({
        to: user.email,
        subject: `${otp} is your Azzure AI Quote verification code`,
        text: `Your Azzure AI Quote verification code is: ${otp}\n\nEnter this 6-digit code on the verification screen, or click the link below to verify your email:\n${verificationUrl}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; background: #080e22; color: #f8fafc; border-radius: 16px;">
            <h2 style="color: #38bdf8; margin-top: 0;">Verify your Azzure AI Quote account</h2>
            <p style="color: #94a3b8; font-size: 15px;">Thank you for registering. Please enter the following 6-digit verification code to activate your luxury jewelry workspace:</p>
            <div style="margin: 24px 0; padding: 18px; background: #040711; border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 12px; text-align: center;">
              <span style="font-family: monospace; font-size: 36px; font-weight: bold; letter-spacing: 0.25em; color: #f5d061;">${otp}</span>
            </div>
            <p style="color: #94a3b8; font-size: 14px;">Or verify automatically with one click:</p>
            <div style="text-align: center; margin: 20px 0;">
              <a href="${verificationUrl}" style="background: linear-gradient(135deg, #38bdf8, #2563eb); color: #ffffff; padding: 12px 28px; border-radius: 9999px; text-decoration: none; font-weight: bold; display: inline-block;">Verify Email Address →</a>
            </div>
            <p style="color: #64748b; font-size: 12px; margin-top: 24px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px;">This code is valid for 24 hours. If you did not sign up for Azzure AI Quote, you can safely ignore this email.</p>
          </div>
        `
      });

      await sendSignupApprovalAlert({
        companyName: company.name,
        ownerName: user.email,
        ownerEmail: user.email,
        signedUpAt: company.createdAt
      });

      return NextResponse.json({ ok: true, email: user.email });
    } catch (innerError) {
      if (createdCompany) {
        await prisma.company.delete({ where: { id: createdCompany.id } }).catch(() => {});
      } else if (createdUser) {
        await prisma.user.delete({ where: { id: createdUser.id } }).catch(() => {});
      }
      throw innerError;
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create account." },
      { status: 400 }
    );
  }
}
