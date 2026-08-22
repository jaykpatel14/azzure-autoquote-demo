import { NextResponse } from "next/server";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { logAuditEvent } from "@/lib/audit";
import { sendEmail } from "@/lib/mailer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { error, digest, path, url } = body;

    let userEmail = "anonymous";
    let companyId = "system";
    let isImpersonating = false;

    try {
      const context = await getAuthenticatedCompanyContext();
      if (context) {
        userEmail = context.user.email;
        companyId = context.company.id;
        isImpersonating = context.isImpersonating;
      }
    } catch {
      // Ignore
    }

    const errorMessage = typeof error === "string" ? error : JSON.stringify(error, null, 2);
    
    await logAuditEvent({
      action: "CLIENT_ERROR_REPORTED" as any,
      companyId: companyId,
      actorUserId: "system",
      targetType: "System",
      targetId: "error-boundary",
      metadata: { error: errorMessage, digest, path, url, userEmail, isImpersonating }
    }).catch(() => undefined);

    const adminEmails = process.env.AZZURE_ADMIN_EMAILS;
    if (adminEmails) {
      const emailAddresses = adminEmails.split(",").map(e => e.trim());
      const htmlBody = `
        <h2>?? System Error Reported</h2>
        <p>A client-side error was caught by the global error boundary.</p>
        <table border="1" cellpadding="8" style="border-collapse: collapse;">
          <tr><td><strong>Path</strong></td><td>${path || "Unknown"}</td></tr>
          <tr><td><strong>URL</strong></td><td>${url || "Unknown"}</td></tr>
          <tr><td><strong>User</strong></td><td>${userEmail}</td></tr>
          <tr><td><strong>Company ID</strong></td><td>${companyId}</td></tr>
          <tr><td><strong>Impersonating</strong></td><td>${isImpersonating ? "Yes" : "No"}</td></tr>
        </table>
        <br />
        <h3>Error Details</h3>
        <pre>${errorMessage}</pre>
      `;

      await sendEmail({
        to: emailAddresses,
        subject: `[Azzure Error] Exception caught at ${path || "Unknown Path"}`,
        text: `Error reported by ${userEmail} at ${path}:\n${errorMessage}`,
        html: htmlBody
      }).catch(console.error);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to process error report:", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
