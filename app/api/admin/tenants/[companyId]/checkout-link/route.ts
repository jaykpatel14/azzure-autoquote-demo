import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternalAdminContext, InternalAdminAccessError } from "@/lib/internal-admin";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession } from "@/src/services/subscriptions";
import { getRequestBaseUrl } from "@/lib/security";
import { sendAuthMail } from "@/lib/mailer";

export const runtime = "nodejs";

const paramsSchema = z.object({
  companyId: z.string().min(1)
});

const bodySchema = z.object({
  sendEmail: z.boolean().optional().default(false),
  planCode: z.string().optional()
});

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    await requireInternalAdminContext();
    const { companyId } = paramsSchema.parse(await context.params);

    const contentType = request.headers.get("content-type") || "";
    const body = contentType.includes("application/json")
      ? bodySchema.parse(await request.json().catch(() => ({})))
      : bodySchema.parse({});

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        subscription: { include: { plan: true } },
        memberships: {
          include: { user: true }
        }
      }
    });

    if (!company) {
      return NextResponse.json({ error: "Tenant company not found." }, { status: 404 });
    }

    const ownerMembership =
      company.memberships.find((m) => m.role === "OWNER") || company.memberships[0];

    const ownerEmail = ownerMembership?.user?.email;
    if (!ownerEmail) {
      return NextResponse.json(
        { error: "No user or owner found for this tenant to associate with Stripe." },
        { status: 400 }
      );
    }

    const planCode = body.planCode || company.subscription?.plan?.code || "professional";
    const baseUrl = getRequestBaseUrl(request);

    const checkoutResult = await createCheckoutSession({
      companyId: company.id,
      companyName: company.name,
      email: ownerEmail,
      planCode,
      baseUrl
    });

    if ("error" in checkoutResult) {
      return NextResponse.json(
        { error: checkoutResult.error.userMessage },
        { status: checkoutResult.error.statusCode }
      );
    }

    const checkoutUrl = checkoutResult.data.url;
    let emailSent = false;

    if (body.sendEmail) {
      await sendAuthMail({
        to: ownerEmail,
        subject: `Complete your billing setup for ${company.name} - Azzure AI Quote`,
        text: `Hello,\n\nPlease use the link below to complete your Stripe billing setup and payment method for ${company.name}:\n\n${checkoutUrl}\n\nThank you,\nAzzure AI Quote Team`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; background: #080e22; color: #f8fafc; border-radius: 16px;">
            <h2 style="color: #38bdf8; margin-top: 0;">Complete your billing setup</h2>
            <p style="color: #94a3b8; font-size: 15px;">
              Please add your payment method to activate uninterrupted access for <strong>${company.name}</strong> on Azzure AI Quote:
            </p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${checkoutUrl}" style="background: linear-gradient(135deg, #38bdf8, #2563eb); color: #ffffff; padding: 14px 32px; border-radius: 9999px; text-decoration: none; font-weight: bold; display: inline-block;">
                Complete Stripe Billing Setup →
              </a>
            </div>
            <p style="color: #64748b; font-size: 13px;">Or copy and paste this link into your browser:</p>
            <p style="color: #38bdf8; font-size: 12px; word-break: break-all;">${checkoutUrl}</p>
          </div>
        `
      });
      emailSent = true;
    }

    return NextResponse.json({
      ok: true,
      checkoutUrl,
      emailSent,
      ownerEmail
    });
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate checkout link." },
      { status: 400 }
    );
  }
}
