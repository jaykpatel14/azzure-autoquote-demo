import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageTeam, requireCompanyContext } from "@/lib/company";
import { logAuditEvent } from "@/lib/audit";
import { sendAuthMail } from "@/lib/mailer";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().max(120).optional(),
  password: z.string().trim().min(8).max(200).optional()
});

async function parseInput(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return schema.parse(await request.json());
  }

  const formData = await request.formData();
  return schema.parse({
    email: String(formData.get("email") || ""),
    name: String(formData.get("name") || ""),
    password: String(formData.get("password") || "")
  });
}

export async function POST(request: Request) {
  try {
    const context = await requireCompanyContext();
    if (!canManageTeam(context.membership?.role ?? "CUSTOMER")) {
      return NextResponse.json({ error: "You do not have permission to manage team members." }, { status: 403 });
    }

    const input = await parseInput(request);
    const email = input.email.toLowerCase();
    let user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true }
    });

    if (!user) {
      if (!input.password) {
        return NextResponse.json(
          { error: "A password is required to create a new team account." },
          { status: 400 }
        );
      }

      user = await prisma.user.create({
        data: {
          email,
          name: input.name || null,
          passwordHash: hashPassword(input.password),
          emailVerifiedAt: new Date()
        },
        select: { id: true, name: true, email: true }
      });
    }

    const existingMembership = await prisma.membership.findUnique({
      where: {
        companyId_userId: {
          companyId: context.company.id,
          userId: user.id
        }
      }
    });

    if (existingMembership) {
      return NextResponse.json({ error: "That user is already part of this company." }, { status: 409 });
    }

    await prisma.membership.create({
      data: {
        companyId: context.company.id,
        userId: user.id,
        role: "ESTIMATOR"
      }
    });

    await logAuditEvent({
      action: "MEMBERSHIP_CREATED",
      companyId: context.company.id,
      actorUserId: context.user.id,
      targetType: "Membership",
      targetId: user.id,
      metadata: {
        email,
        role: "ESTIMATOR"
      }
    }).catch(() => undefined);

    await sendAuthMail({
      to: email,
      subject: `You now have access to ${context.company.name}`,
      text: `You've been added to ${context.company.name}. Sign in at ${new URL("/signin", request.url).toString()}`,
      html: `<p>You've been added to <strong>${context.company.name}</strong>.</p><p><a href="${new URL("/signin", request.url).toString()}">Sign in</a></p>`
    });

    return NextResponse.redirect(new URL("/settings/team?updated=1", request.url), 303);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid team payload." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update team." },
      { status: 400 }
    );
  }
}
