import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken } from "@/lib/auth-tokens";
import { sendAuthMail } from "@/lib/mailer";
import { getRequestBaseUrl } from "@/lib/security";

const schema = z.object({
  email: z.string().email()
});

function buildAppUrl(path: string, baseUrl: string) {
  return new URL(path, baseUrl).toString();
}

export async function POST(request: Request) {
  try {
    const { email: rawEmail } = schema.parse(await request.json());
    const email = rawEmail.toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        memberships: {
          select: {
            companyId: true
          },
          orderBy: {
            company: { createdAt: "asc" }
          }
        }
      }
    });

    if (user?.memberships[0]) {
      const token = await createPasswordResetToken(user.id, user.memberships[0].companyId);
      const resetUrl = buildAppUrl(`/reset-password?token=${token}`, getRequestBaseUrl(request));

      await sendAuthMail({
        to: user.email,
        subject: "Reset your Azzure AutoQuote password",
        text: `Reset your password: ${resetUrl}`,
        html: `<p>Reset your password: <a href="${resetUrl}">${resetUrl}</a></p>`
      });
    }

    return NextResponse.json({
      ok: true,
      message: "If that email exists, we sent reset instructions."
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send reset instructions." },
      { status: 400 }
    );
  }
}
