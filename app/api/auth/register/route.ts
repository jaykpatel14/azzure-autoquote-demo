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

      const token = await createEmailVerificationToken(user.id, company.id);
      const verificationUrl = buildAppUrl(`/verify-email?token=${token}`);

      await sendAuthMail({
        to: user.email,
        subject: "Verify your Azzure AI Quote account",
        text: `Verify your email address: ${verificationUrl}`,
        html: `<p>Verify your email address: <a href="${verificationUrl}">${verificationUrl}</a></p>`
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
