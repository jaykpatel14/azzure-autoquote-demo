import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient, Subscription as PrismaSubscription } from "@prisma/client";
import type Stripe from "stripe";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { mapStripeSubscriptionStatus } from "@/lib/billing";
import { DEFAULT_TRIAL_QUOTE_CAP } from "@/lib/subscription-plans";
import { buildAppUrl, getStripeClient } from "@/lib/stripe";
import { onboardCompanyOwner } from "@/lib/onboarding";
import { createEmailVerificationToken } from "@/lib/auth-tokens";
import { sendAuthMail } from "@/lib/mailer";

type Db = PrismaClient;
type Tx = Prisma.TransactionClient;

type WebhookProcessorOptions = {
  prisma?: Db;
  stripe?: Stripe;
};

function toDateFromUnix(seconds: number) {
  return new Date(seconds * 1000);
}

function toStripeId(value: string | Stripe.Product | Stripe.DeletedProduct | null | undefined) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.id;
}

function getSubscriptionPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  const legacySubscription = subscription as Stripe.Subscription & {
    current_period_start?: number;
    current_period_end?: number;
  };

  const currentPeriodStart = item?.current_period_start ?? legacySubscription.current_period_start;
  const currentPeriodEnd = item?.current_period_end ?? legacySubscription.current_period_end;

  if (typeof currentPeriodStart !== "number" || typeof currentPeriodEnd !== "number") {
    throw new Error("Stripe subscription is missing billing period information.");
  }

  return { currentPeriodStart, currentPeriodEnd };
}

function getPriceSnapshot(subscription: Stripe.Subscription) {
  const price = subscription.items.data[0]?.price;
  return {
    stripePriceId: price?.id ?? null,
    stripeProductId: toStripeId(price?.product)
  };
}

function toNumber(value: string | null | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function resolvePlan(
  tx: Tx,
  subscription: Stripe.Subscription,
  existingSubscription: PrismaSubscription | null
) {
  const metadataPlanId = subscription.metadata?.planId;
  const metadataPlanCode = subscription.metadata?.planCode;
  const { stripePriceId, stripeProductId } = getPriceSnapshot(subscription);

  if (metadataPlanId) {
    const plan = await tx.plan.findUnique({ where: { id: metadataPlanId } });
    if (!plan) throw new Error(`Unknown planId in Stripe subscription: ${metadataPlanId}`);
    return plan;
  }

  if (metadataPlanCode) {
    const plan = await tx.plan.findUnique({ where: { code: metadataPlanCode } });
    if (plan) return plan;
  }

  if (stripePriceId) {
    const plan = await tx.plan.findFirst({ where: { stripePriceId } });
    if (plan) return plan;
  }

  if (stripeProductId) {
    const plan = await tx.plan.findFirst({ where: { stripeProductId } });
    if (plan) return plan;
  }

  if (existingSubscription) {
    return tx.plan.findUnique({ where: { id: existingSubscription.planId } });
  }

  return null;
}

async function syncUsagePeriod(
  tx: Tx,
  companyId: string,
  planLimit: number,
  subscription: Stripe.Subscription
) {
  const { currentPeriodStart, currentPeriodEnd } = getSubscriptionPeriod(subscription);
  const periodStart = toDateFromUnix(currentPeriodStart);
  const periodEnd = toDateFromUnix(currentPeriodEnd);

  await tx.usagePeriod.upsert({
    where: {
      companyId_periodStart_periodEnd: {
        companyId,
        periodStart,
        periodEnd
      }
    },
    create: {
      companyId,
      periodStart,
      periodEnd,
      limit: planLimit
    },
    update: {
      limit: planLimit
    }
  });
}

async function syncSubscriptionRecord(
  tx: Tx,
  subscription: Stripe.Subscription,
  eventType: string
) {
  const { stripePriceId, stripeProductId } = getPriceSnapshot(subscription);
  const period = getSubscriptionPeriod(subscription);
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const metadataCompanyId = subscription.metadata?.companyId;
  const existingSubscription = metadataCompanyId
    ? await tx.subscription.findFirst({
        where: {
          companyId: metadataCompanyId,
          OR: [{ stripeSubscriptionId: subscription.id }, { stripeCustomerId: customerId }]
        }
      })
    : await tx.subscription.findFirst({
        where: {
          OR: [{ stripeSubscriptionId: subscription.id }, { stripeCustomerId: customerId }]
        }
      });

  const companyId = metadataCompanyId || existingSubscription?.companyId;
  if (!companyId) {
    throw new Error("Stripe subscription is missing company metadata.");
  }

  const plan = await resolvePlan(tx, subscription, existingSubscription);
  if (!plan) {
    throw new Error("Stripe subscription could not be mapped to a plan.");
  }

  const status = mapStripeSubscriptionStatus(subscription.status);
  const trialQuoteCap = toNumber(subscription.metadata?.trialQuoteCap, DEFAULT_TRIAL_QUOTE_CAP);
  const trialStartedAt = toDate(subscription.metadata?.trialStartedAt);
  const trialEndsAt = toDate(subscription.metadata?.trialEndsAt);
  const pendingPlanId = subscription.metadata?.pendingPlanId ?? plan.id;
  const onboardingComplete = subscription.metadata?.onboardingComplete === "true";

  const savedSubscription = await tx.subscription.upsert({
    where: { companyId },
    create: {
      companyId,
      planId: plan.id,
      status,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripeProductId,
      stripePriceId,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialStartedAt,
      trialEndsAt,
      trialQuoteCap,
      trialQuotesUsed: 0,
      pendingPlanId,
      onboardingComplete,
      currentPeriodStart: toDateFromUnix(period.currentPeriodStart),
      currentPeriodEnd: toDateFromUnix(period.currentPeriodEnd)
    },
    update: {
      planId: plan.id,
      status,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripeProductId,
      stripePriceId,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialStartedAt,
      trialEndsAt,
      trialQuoteCap,
      pendingPlanId,
      onboardingComplete,
      currentPeriodStart: toDateFromUnix(period.currentPeriodStart),
      currentPeriodEnd: toDateFromUnix(period.currentPeriodEnd)
    }
  });

  await syncUsagePeriod(
    tx,
    companyId,
    status === "TRIALING" ? trialQuoteCap : plan.monthlyLimit,
    subscription
  );

  await tx.auditLog.create({
    data: {
      action: "BILLING_SUBSCRIPTION_SYNCED",
      companyId,
      actorUserId: null,
      targetType: "Subscription",
      targetId: savedSubscription.id,
      metadata: {
        eventType,
        status,
        planCode: plan.code,
        stripeSubscriptionId: subscription.id
      }
    }
  });

  return savedSubscription;
}

async function handlePendingRegistrationProvisioning(
  db: Db,
  pendingRegistrationId: string,
  session: Stripe.Checkout.Session,
  subscription: Stripe.Subscription
) {
  const pending = await db.pendingRegistration.findUnique({
    where: { id: pendingRegistrationId }
  });

  if (!pending) {
    return null;
  }

  const existingUser = await db.user.findUnique({
    where: { email: pending.email }
  });

  if (existingUser) {
    await db.pendingRegistration.delete({ where: { id: pending.id } }).catch(() => {});
    return { email: pending.email };
  }

  const period = getSubscriptionPeriod(subscription);
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const { stripePriceId, stripeProductId } = getPriceSnapshot(subscription);
  const status = mapStripeSubscriptionStatus(subscription.status);

  const { user, company } = await db.$transaction(async (tx) => {
    const { user, company } = await onboardCompanyOwner(tx, {
      email: pending.email,
      passwordHash: pending.passwordHash,
      companyName: pending.companyName,
      planCode: pending.planCode
    });

    const plan = await resolvePlan(tx, subscription, null);
    if (plan) {
      await tx.subscription.update({
        where: { companyId: company.id },
        data: {
          planId: plan.id,
          status,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          stripeProductId,
          stripePriceId,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodStart: toDateFromUnix(period.currentPeriodStart),
          currentPeriodEnd: toDateFromUnix(period.currentPeriodEnd)
        }
      });

      await syncUsagePeriod(
        tx,
        company.id,
        status === "TRIALING" ? DEFAULT_TRIAL_QUOTE_CAP : plan.monthlyLimit,
        subscription
      );
    }

    await tx.pendingRegistration.delete({ where: { id: pending.id } }).catch(() => {});

    return { user, company };
  });

  // Create email verification tokens and dispatch OTP verification email
  const { token, otp } = await createEmailVerificationToken(user.id, company.id);
  const verificationUrl = buildAppUrl(`/verify-email?token=${token}&email=${encodeURIComponent(user.email)}`);

  await sendAuthMail({
    to: user.email,
    subject: `${otp} is your Azzure AI Quote verification code`,
    text: `Your Azzure AI Quote verification code is: ${otp}\n\nEnter this 6-digit code on the verification screen, or click the link below to verify your email:\n${verificationUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; background: #080e22; color: #f8fafc; border-radius: 16px;">
        <h2 style="color: #38bdf8; margin-top: 0;">Verify your Azzure AI Quote account</h2>
        <p style="color: #94a3b8; font-size: 15px;">Thank you for starting your trial. Please enter the following 6-digit verification code to activate your luxury jewelry workspace:</p>
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
  }).catch(() => {});

  return { email: user.email };
}

type SyncCheckoutSessionOptions = WebhookProcessorOptions & {
  expectedCompanyId?: string;
};

export async function syncStripeCheckoutSession(
  sessionId: string,
  options: SyncCheckoutSessionOptions = {}
) {
  const db = options.prisma ?? defaultPrisma;
  const stripe = options.stripe ?? (await getStripeClient());

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.mode !== "subscription" || typeof session.subscription !== "string") {
    throw new Error("Stripe checkout session is missing subscription information.");
  }

  const subscription = await stripe.subscriptions.retrieve(session.subscription);

  const pendingRegistrationId =
    session.metadata?.pendingRegistrationId || subscription.metadata?.pendingRegistrationId;

  let provisionedEmail: string | null = null;
  if (pendingRegistrationId) {
    const res = await handlePendingRegistrationProvisioning(
      db,
      pendingRegistrationId,
      session,
      subscription
    );
    if (res?.email) {
      provisionedEmail = res.email;
    }
  }

  const sessionCompanyId = session.metadata?.companyId;
  if (options.expectedCompanyId && sessionCompanyId && sessionCompanyId !== options.expectedCompanyId) {
    throw new Error("Stripe checkout session does not belong to the active company.");
  }

  const subscriptionCompanyId = subscription.metadata?.companyId;
  if (
    options.expectedCompanyId &&
    subscriptionCompanyId &&
    subscriptionCompanyId !== options.expectedCompanyId
  ) {
    throw new Error("Stripe checkout session does not belong to the active company.");
  }

  await db.$transaction(async (tx) => {
    await syncSubscriptionRecord(tx, subscription, "checkout.session.completed");
  });

  return { session, subscription, provisionedEmail };
}

async function processWebhookEvent(event: Stripe.Event, stripe: Stripe, db: Db) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription" || typeof session.subscription !== "string") {
        return;
      }

      const subscription = await stripe.subscriptions.retrieve(session.subscription);
      const pendingRegistrationId =
        session.metadata?.pendingRegistrationId || subscription.metadata?.pendingRegistrationId;

      if (pendingRegistrationId) {
        await handlePendingRegistrationProvisioning(
          db,
          pendingRegistrationId,
          session,
          subscription
        );
      }

      await db.$transaction(async (tx) => {
        await syncSubscriptionRecord(tx, subscription, event.type);
      });
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await db.$transaction(async (tx) => {
        await syncSubscriptionRecord(tx, subscription, event.type);
      });
      return;
    }
    case "invoice.payment_failed":
    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription | null;
      };
      const subscriptionId =
        typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
      if (!subscriptionId) return;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await db.$transaction(async (tx) => {
        await syncSubscriptionRecord(tx, subscription, event.type);
      });
      return;
    }
    default:
      return;
  }
}

export async function processStripeWebhookEvent(
  event: Stripe.Event,
  options: WebhookProcessorOptions = {}
) {
  const db = options.prisma ?? defaultPrisma;
  const stripe = options.stripe ?? (await getStripeClient());

  const insertedCount = await db.$executeRaw`
    INSERT INTO "StripeWebhookEvent" ("id", "eventId", "eventType", "livemode", "payload", "createdAt")
    VALUES (
      ${randomUUID()},
      ${event.id},
      ${event.type},
      ${event.livemode},
      ${event as unknown as Prisma.InputJsonValue},
      ${new Date()}
    )
    ON CONFLICT ("eventId") DO NOTHING
  `;

  if (insertedCount === 0) {
    return { duplicate: true as const };
  }

  try {
    await processWebhookEvent(event, stripe, db);
    await db.stripeWebhookEvent.update({
      where: { eventId: event.id },
      data: {
        processedAt: new Date(),
        errorMessage: null
      }
    });
    return { duplicate: false as const };
  } catch (error) {
    await db.stripeWebhookEvent.update({
      where: { eventId: event.id },
      data: {
        errorMessage: error instanceof Error ? error.message : "Webhook processing failed."
      }
    }).catch(() => undefined);
    throw error;
  }
}
