import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { buildAppUrl, getStripeClient, resolveCheckoutPriceId } from "@/lib/stripe";
import { isPlanCode } from "@/lib/subscription-plans";
import { validateEmailDomainMx } from "@/lib/email-mx-validation";
import { validateEmail } from "@/lib/email-validation";

const checkoutSchema = z.object({
  email: z.string().trim().superRefine((val, ctx) => {
    const check = validateEmail(val);
    if (!check.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: check.error || "Please enter a valid business email address."
      });
    }
  }),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200),
  companyName: z.string().trim().min(2, "Company name must be at least 2 characters.").max(120),
  planCode: z.string().trim().default("professional")
});

async function createRegistrationCheckoutSession(input: {
  pendingRegistrationId: string;
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
        pendingRegistrationId: input.pendingRegistrationId,
        planId: plan.id,
        planCode: input.planCode,
        trialQuoteCap: "25",
        onboardingComplete: "false"
      }
    },
    metadata: {
      pendingRegistrationId: input.pendingRegistrationId,
      planId: plan.id,
      planCode: input.planCode
    },
    success_url: buildAppUrl("/onboarding?session_id={CHECKOUT_SESSION_ID}"),
    cancel_url: buildAppUrl("/signup?cancelled=1"),
    allow_promotion_codes: true
  });

  if (!session.url) {
    return { error: "Stripe did not return a checkout URL." as const };
  }

  return { url: session.url, sessionId: session.id };
}

export async function POST(request: Request) {
  try {
    const input = checkoutSchema.parse(await request.json());
    const email = input.email.toLowerCase();
    const planCode = isPlanCode(input.planCode) ? input.planCode : "professional";

    // 1. Verify email domain has active MX servers (not fake or disposable)
    const mxCheck = await validateEmailDomainMx(email);
    if (!mxCheck.valid) {
      return NextResponse.json(
        { error: mxCheck.error || "Please enter a valid, active email address." },
        { status: 400 }
      );
    }

    // 2. Check if an account already exists for that email
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerifiedAt: true }
    });

    if (existing) {
      return NextResponse.json(
        { error: "An account already exists for that email." },
        { status: 409 }
      );
    }

    const passwordHash = hashPassword(input.password);

    // 3. Create or update pending registration (valid for 2 hours)
    // No User or Company is created in PostgreSQL until Stripe checkout completes.
    const pending = await prisma.pendingRegistration.upsert({
      where: { email },
      create: {
        email,
        companyName: input.companyName,
        passwordHash,
        planCode,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
      },
      update: {
        companyName: input.companyName,
        passwordHash,
        planCode,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
      }
    });

    // 4. Create Stripe Checkout Session
    const checkout = await createRegistrationCheckoutSession({
      pendingRegistrationId: pending.id,
      planCode,
      email
    });

    if ("error" in checkout) {
      return NextResponse.json({ error: checkout.error }, { status: 400 });
    }

    // Record the Stripe session ID on pending registration
    await prisma.pendingRegistration.update({
      where: { id: pending.id },
      data: { stripeSessionId: checkout.sessionId }
    });

    return NextResponse.json({
      ok: true,
      email,
      url: checkout.url
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid registration information." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to initiate checkout." },
      { status: 400 }
    );
  }
}
