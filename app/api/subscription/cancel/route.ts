import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageBilling, requireCompanyContext } from "@/lib/company";
import { prisma } from "@/lib/prisma";
import { getStripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

const cancelSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  returnTo: z.string().trim().optional()
});

async function parseInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return cancelSchema.parse(await request.json());
  }

  const formData = await request.formData();
  return cancelSchema.parse({
    reason: String(formData.get("reason") || ""),
    returnTo: String(formData.get("returnTo") || "")
  });
}

export async function POST(request: Request) {
  try {
    const context = await requireCompanyContext();
    if (!canManageBilling(context.membership?.role ?? "CUSTOMER")) {
      return NextResponse.json({ error: "You do not have permission to manage billing." }, { status: 403 });
    }

    const subscription = context.company.subscription;
    if (!subscription) {
      return NextResponse.json({ error: "No subscription record was found." }, { status: 404 });
    }

    const input = await parseInput(request);
    if (subscription.stripeSubscriptionId) {
      const stripe = await getStripeClient();
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true
      });
    }

    await prisma.subscription.update({
      where: { companyId: context.company.id },
      data: {
        cancelAtPeriodEnd: true
      }
    });

    await prisma.auditLog.create({
      data: {
        action: "BILLING_CANCELLATION_REQUESTED",
        companyId: context.company.id,
        actorUserId: context.user.id,
        targetType: "Subscription",
        targetId: subscription.id,
        metadata: {
          reason: input.reason || null
        }
      }
    });

    const redirectTo = input.returnTo && input.returnTo.startsWith("/") ? input.returnTo : "/settings/billing?billing=canceled";
    return NextResponse.redirect(new URL(redirectTo, request.url), 303);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid cancellation request." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to cancel the subscription." },
      { status: 400 }
    );
  }
}
