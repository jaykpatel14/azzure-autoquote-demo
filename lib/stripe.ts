import { loadEnvConfig } from "@next/env";
import type { Plan } from "@prisma/client";
import Stripe from "stripe";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
}

export function getStripeWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  }

  return secret;
}

export function getAppUrl() {
  return process.env.APP_URL || "http://localhost:3000";
}

export function buildAppUrl(path: string) {
  return new URL(path, getAppUrl()).toString();
}

export async function resolveCheckoutPriceId(
  plan: Pick<Plan, "code" | "stripePriceId" | "stripeProductId">
) {
  const candidate = plan.stripePriceId || plan.stripeProductId;
  if (!candidate) {
    return null;
  }

  if (candidate.startsWith("price_")) {
    return candidate;
  }

  if (candidate.startsWith("prod_")) {
    const stripe = getStripeClient();
    const product = await stripe.products.retrieve(candidate);
    const defaultPrice = product.default_price;

    if (typeof defaultPrice === "string") {
      return defaultPrice;
    }

    if (defaultPrice && typeof defaultPrice === "object") {
      return defaultPrice.id;
    }
  }

  return null;
}

type CheckoutCustomerResolverInput = {
  stripe: Pick<Stripe, "customers">;
  stripeCustomerId: string | null;
  email: string;
  companyName: string;
  companyId: string;
  planCode: string;
  persistStripeCustomerId: (customerId: string) => Promise<void>;
};

function isMissingStripeCustomerError(error: unknown) {
  return error instanceof Error && /no such customer/i.test(error.message);
}

export async function resolveCheckoutCustomerId({
  stripe,
  stripeCustomerId,
  email,
  companyName,
  companyId,
  planCode,
  persistStripeCustomerId
}: CheckoutCustomerResolverInput) {
  const candidateCustomerId = stripeCustomerId?.trim() || null;

  if (candidateCustomerId) {
    try {
      const existingCustomer = await stripe.customers.retrieve(candidateCustomerId);

      if (!("deleted" in existingCustomer) || !existingCustomer.deleted) {
        return candidateCustomerId;
      }
    } catch (error) {
      if (!isMissingStripeCustomerError(error)) {
        throw error;
      }
    }
  }

  const customer = await stripe.customers.create({
    email,
    name: companyName,
    metadata: {
      companyId,
      planCode
    }
  });

  await persistStripeCustomerId(customer.id);

  return customer.id;
}
