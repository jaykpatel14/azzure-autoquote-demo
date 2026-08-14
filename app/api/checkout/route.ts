import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { onboardCompanyOwner } from "@/lib/onboarding";
import { createEmailVerificationToken } from "@/lib/auth-tokens";
import { sendSignupApprovalAlert } from "@/lib/account-workflow";
import { sendAuthMail } from "@/lib/mailer";
import { buildAppUrl, getStripeClient, resolveCheckoutPriceId } from "@/lib/stripe";
import { isPlanCode } from "@/lib/subscription-plans";

const checkoutSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(120).optional(),
  companyName: z.string().trim().min(2).max(120),
  planCode: z.string().trim().default("professional")
});

async function createStripeCheckoutSession(input: {
  companyId: string;
  planCode: string;
  email: string;
}) {
  const plan = await prisma.plan.findUnique({
    where: { code: input.planCode }
  });

  if (!plan) {
    return { error: "Billing plan not found." as const };
  }

  const checkoutPriceId = await resolveCheckoutPriceId(plan);
  if (!checkoutPriceId) {
    return {
      error:
        "This billing plan is not configured with a Stripe price. Use a price_ id, or attach a default recurring price to the product." as const
    };
  }

  const stripe = await getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: input.email,
    line_items: [
      {
        price: checkoutPriceId,
        quantity: 1
      }
    ],
    subscription_data: {
      trial_period_days: 14,
      metadata: {
        companyId: input.companyId,
        planId: plan.id,
        planCode: input.planCode,
        trialQuoteCap: "25",
        onboardingComplete: "false"
      }
    },
    metadata: {
      companyId: input.companyId,
      planId: plan.id,
      planCode: input.planCode
    },
    success_url: buildAppUrl("/onboarding?session_id={CHECKOUT_SESSION_ID}"),
    cancel_url: buildAppUrl("/pricing"),
    allow_promotion_codes: true
  });

  if (!session.url) {
    return { error: "Stripe did not return a checkout URL." as const };
  }

  return { url: session.url };
}

export async function POST(request: Request) {
  try {
    const input = checkoutSchema.parse(await request.json());
    const email = input.email.toLowerCase();
    const planCode = isPlanCode(input.planCode) ? input.planCode : "professional";

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true }
    });

    if (existing) {
      return NextResponse.json({ error: "An account already exists for that email." }, { status: 409 });
    }

    const passwordHash = hashPassword(input.password);
    const { user, company } = await prisma.$transaction(async (tx) =>
      onboardCompanyOwner(tx, {
        email,
        name: input.name,
        passwordHash,
        companyName: input.companyName,
        planCode
      })
    );

    const token = await createEmailVerificationToken(user.id, company.id);
    const verificationUrl = buildAppUrl(`/verify-email?token=${token}`);

    await sendAuthMail({
      to: user.email,
      subject: "Verify your AI AutoQuote account",
      text: `Verify your email address: ${verificationUrl}`,
      html: `<p>Verify your email address: <a href="${verificationUrl}">${verificationUrl}</a></p>`
    });

    const checkout = await createStripeCheckoutSession({
      companyId: company.id,
      email: user.email,
      planCode
    });

    if ("error" in checkout) {
      return NextResponse.json({ error: checkout.error }, { status: 409 });
    }

    await sendSignupApprovalAlert({
      companyName: company.name,
      ownerName: input.name?.trim() || user.name || user.email,
      ownerEmail: user.email,
      signedUpAt: company.createdAt
    });

    return NextResponse.json({
      ok: true,
      email: user.email,
      url: checkout.url
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create account." },
      { status: 400 }
    );
  }
}
