import { NextResponse } from "next/server";
import { z } from "zod";
import { requireInternalAdminContext, InternalAdminAccessError } from "@/lib/internal-admin";
import { sendEmail } from "@/lib/mailer";

export const runtime = "nodejs";

const schema = z.object({
  to: z.string().trim().email("Valid recipient email is required.")
});

export async function POST(request: Request) {
  try {
    const admin = await requireInternalAdminContext();
    const body = await request.json();
    const parsed = schema.parse(body);

    const result = await sendEmail({
      to: parsed.to,
      subject: "Azzure AutoQuote — Test Email (Resend Integration)",
      text: `Hello,\n\nThis is a test email sent from the Azzure AutoQuote Admin Panel via Resend by ${admin.user.name || admin.user.email}.\n\nIf you received this message, your Resend configuration is working correctly!\n\nBest regards,\nAzzure AutoQuote Team`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 8px;">
          <h2 style="color: #005AB7; margin-bottom: 12px;">Azzure AutoQuote</h2>
          <p style="color: #1E293B; font-size: 16px;">Test Email — Resend Integration</p>
          <p style="color: #475569; line-height: 1.6;">
            This is a test email sent from the <strong>Azzure AutoQuote Admin Panel</strong> via <strong>Resend</strong> by <em>${admin.user.name || admin.user.email}</em>.
          </p>
          <div style="background: #F8FAFC; padding: 16px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #005AB7;">
            <p style="margin: 0; color: #0F172A; font-weight: 600;">✓ Resend API Integration Status: Connected</p>
            <p style="margin: 4px 0 0; color: #64748B; font-size: 13px;">Timestamp: ${new Date().toISOString()}</p>
          </div>
          <p style="color: #64748B; font-size: 13px; margin-top: 24px;">
            Azzure AutoQuote · London, Ontario, Canada
          </p>
        </div>
      `
    });

    return NextResponse.json({
      success: true,
      messageId: result.id,
      recipient: parsed.to
    });
  } catch (error) {
    if (error instanceof InternalAdminAccessError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid recipient email." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send test email via Resend." },
      { status: 500 }
    );
  }
}
