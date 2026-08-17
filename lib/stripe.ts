import { loadEnvConfig } from "@next/env";
import type { Plan } from "@prisma/client";
import Stripe from "stripe";
import { resolveRuntimeSetting } from "@/lib/app-settings";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");

const stripeClients = new Map<string, Stripe>();

export async function getStripeClient() {
  const secretKey =
    (await resolveRuntimeSetting("STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY)) || null;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  const cached = stripeClients.get(secretKey);
  if (cached) {
    return cached;
  }

  const stripeClient = new Stripe(secretKey);
  stripeClients.set(secretKey, stripeClient);
  return stripeClient;
}

export async function getStripeWebhookSecret() {
  const secret =
    (await resolveRuntimeSetting("STRIPE_WEBHOOK_SECRET", process.env.STRIPE_WEBHOOK_SECRET)) || null;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured.");
  }

  return secret;
}

export function getAppUrl() {
  return process.env.APP_URL || "http://localhost:3000";
}

export function buildAppUrl(path: string, baseUrl = getAppUrl()) {
  return new URL(path, baseUrl).toString();
}

export async function resolveCheckoutPriceId(
  plan: Pick<Plan, "code" | "stripePriceId" | "stripeProductId">
) {
  let candidate = plan.stripePriceId || plan.stripeProductId;
  if (!candidate) {
    const envPriceKey = `STRIPE_${plan.code.toUpperCase()}_PRICE_ID`;
    const envProductKey = `STRIPE_${plan.code.toUpperCase()}_PRODUCT_ID`;
    candidate =
      (await resolveRuntimeSetting(envPriceKey, process.env[envPriceKey])) ||
      (await resolveRuntimeSetting(envProductKey, process.env[envProductKey])) ||
      null;
  }

  if (!candidate) {
    return null;
  }

  if (candidate.startsWith("price_")) {
    return candidate;
  }

  if (candidate.startsWith("prod_")) {
    const stripe = await getStripeClient();
    const product = await stripe.products.retrieve(candidate);
    const defaultPrice = product.default_price;

    if (typeof defaultPrice === "string") {
      return defaultPrice;
    }

    if (defaultPrice && typeof defaultPrice === "object") {
      return defaultPrice.id;
    }
  }

  return candidate;
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
