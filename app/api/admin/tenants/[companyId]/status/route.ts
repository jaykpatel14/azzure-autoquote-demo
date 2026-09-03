import { NextResponse } from "next/server";
import { z } from "zod";
import { logAuditEvent } from "@/lib/audit";
import { sendAccountApprovedMail, sendAccountSuspendedMail, sendTierChangeMail } from "@/lib/account-workflow";
import { requireInternalAdminContext, InternalAdminAccessError } from "@/lib/internal-admin";
import { prisma } from "@/lib/prisma";
import { buildPublicUrl } from "@/lib/security";

export const runtime = "nodejs";

const paramsSchema = z.object({
  companyId: z.string().min(1)
});

const bodySchema = z.object({
  accountStatus: z.enum(["APPROVED", "SUSPENDED"]),
  pricingTier: z.enum(["TIER_1", "TIER_2", "TIER_3"]).optional(),
  currency: z.enum(["USD", "CAD"]).optional(),
  ckCustomerVerified: z.enum(["true", "false"]).optional(),
  ckCustomerNotes: z.string().trim().max(500).optional(),
  adminNotes: z.string().trim().max(1000).optional(),
  tierChangeReason: z.string().trim().max(500).optional(),
  suspendedReason: z.string().trim().max(500).optional(),
  next: z.string().optional()
});

type RouteContext = {
  params: Promise<{
    companyId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await requireInternalAdminContext();
    const parsedParams = paramsSchema.safeParse(await context.params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: "Invalid company id." }, { status: 400 });
    }

    const formData = await request.formData();
    const parsedBody = bodySchema.safeParse({
      accountStatus: String(formData.get("accountStatus") || ""),
      pricingTier: String(formData.get("pricingTier") || "") || undefined,
      currency: String(formData.get("currency") || "") || undefined,
      ckCustomerVerified: String(formData.get("ckCustomerVerified") || "") || undefined,
      ckCustomerNotes: String(formData.get("ckCustomerNotes") || "") || undefined,
      adminNotes: String(formData.get("adminNotes") || "") || undefined,
      tierChangeReason: String(formData.get("tierChangeReason") || "") || undefined,
      suspendedReason: String(formData.get("suspendedReason") || "") || undefined,
      next: String(formData.get("next") || "") || undefined
    });

    if (!parsedBody.success) {
      return NextResponse.json({ error: "Invalid account status payload." }, { status: 400 });
    }
    if (parsedBody.data.accountStatus === "APPROVED" && !parsedBody.data.pricingTier) {
      return NextResponse.json({ error: "Select a pricing tier before approving the account." }, { status: 400 });
    }
    if (parsedBody.data.accountStatus === "SUSPENDED" && !parsedBody.data.suspendedReason) {
      return NextResponse.json({ error: "A decline reason is required." }, { status: 400 });
    }

    const company = await prisma.company.findUnique({
      where: { id: parsedParams.data.companyId },
      include: {
        memberships: {
          orderBy: { role: "desc" },
          take: 1,
          include: {
            user: {
              select: { id: true, email: true, name: true }
            }
          }
        }
      }
    });

    if (!company) {
      return NextResponse.json({ error: "Company not found." }, { status: 404 });
    }

    const owner = company.memberships[0]?.user;
    if (!owner) {
      return NextResponse.json({ error: "Company owner not found." }, { status: 404 });
    }

    const previousTier = company.pricingTier;
    const nextTier =
      parsedBody.data.accountStatus === "APPROVED"
        ? parsedBody.data.pricingTier ?? previousTier ?? "TIER_3"
        : previousTier;
    const approvedTier = nextTier ?? "TIER_3";
    const now = new Date();
    if (previousTier && previousTier !== nextTier && !parsedBody.data.tierChangeReason) {
      return NextResponse.json({ error: "A reason is required when changing pricing tier." }, { status: 400 });
    }

    const updated = await prisma.company.update({
      where: { id: company.id },
      data: {
        accountStatus: parsedBody.data.accountStatus,
        pricingTier: nextTier,
        currency: parsedBody.data.currency ?? company.currency,
        approvedAt: parsedBody.data.accountStatus === "APPROVED" ? now : company.approvedAt,
        approvedBy: parsedBody.data.accountStatus === "APPROVED" ? admin.user.id : company.approvedBy,
        tierChangedAt: previousTier !== nextTier ? now : company.tierChangedAt,
        tierChangedBy: previousTier !== nextTier ? admin.user.id : company.tierChangedBy,
        suspendedAt: parsedBody.data.accountStatus === "SUSPENDED" ? now : null,
        suspendedReason:
          parsedBody.data.accountStatus === "SUSPENDED"
            ? parsedBody.data.suspendedReason || "Manually suspended by the admin team."
            : null,
        ckCustomerVerified:
          parsedBody.data.accountStatus === "APPROVED"
            ? parsedBody.data.ckCustomerVerified === "true"
            : company.ckCustomerVerified,
        ckCustomerVerifiedAt:
          parsedBody.data.accountStatus === "APPROVED" && parsedBody.data.ckCustomerVerified === "true"
            ? now
            : company.ckCustomerVerifiedAt,
        ckCustomerVerifiedBy:
          parsedBody.data.accountStatus === "APPROVED" && parsedBody.data.ckCustomerVerified === "true"
            ? admin.user.id
            : company.ckCustomerVerifiedBy,
        ckCustomerNotes: parsedBody.data.ckCustomerNotes ?? company.ckCustomerNotes,
        adminNotes: parsedBody.data.adminNotes ?? company.adminNotes
      }
    });

    if (parsedBody.data.accountStatus === "APPROVED") {
      await logAuditEvent({
        action: "ACCOUNT_APPROVED",
        companyId: company.id,
        actorUserId: admin.user.id,
        targetType: "Company",
        targetId: company.id,
        metadata: {
          companyName: company.name,
          pricingTier: approvedTier,
          currency: updated.currency
        }
      });

      if (previousTier && previousTier !== nextTier) {
        await logAuditEvent({
          action: "PRICING_TIER_UPDATED",
          companyId: company.id,
          actorUserId: admin.user.id,
          targetType: "Company",
          targetId: company.id,
          metadata: {
            previousTier,
            newTier: nextTier,
            reason: parsedBody.data.tierChangeReason
          }
        });
      }

      await sendAccountApprovedMail({
        to: owner.email,
        ownerName: owner.name || owner.email,
        companyName: company.name,
        tier: approvedTier
      });

      if (previousTier && previousTier !== nextTier) {
      await sendTierChangeMail({
        to: owner.email,
        ownerName: owner.name || owner.email,
        companyName: company.name,
        previousTier,
        newTier: approvedTier
      });
      }
    } else {
      await logAuditEvent({
        action: "ACCOUNT_SUSPENDED",
        companyId: company.id,
        actorUserId: admin.user.id,
        targetType: "Company",
        targetId: company.id,
        metadata: {
          companyName: company.name,
          reason: parsedBody.data.suspendedReason || null
        }
      });

      await sendAccountSuspendedMail({
        to: owner.email,
        ownerName: owner.name || owner.email,
        companyName: company.name,
        reason: parsedBody.data.suspendedReason || null
      });
    }

    const redirectTarget = parsedBody.data.next?.trim() || `/admin/tenants/${company.id}`;
    if (request.headers.get("content-type")?.includes("application/json")) {
      return NextResponse.json({
        ok: true,
        companyId: updated.id,
        accountStatus: updated.accountStatus,
        pricingTier: updated.pricingTier
      });
    }

    return NextResponse.redirect(buildPublicUrl(redirectTarget), 303);
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update company status." },
      { status: 400 }
    );
  }
}
