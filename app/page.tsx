import Link from "next/link";
import { redirect } from "next/navigation";
import WorkspaceShell from "@/components/workspace-shell";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { prisma } from "@/lib/prisma";
import { getCurrentUsagePeriod, getUsageRemaining, getUsageWarningMessage } from "@/lib/billing";
import { hasMinimumRole } from "@/lib/tenant";
import { getWorkspaceNav } from "@/lib/workspace-nav";

export default async function HomePage() {
  const adminContext = await getInternalAdminContext();
  if (adminContext) {
    redirect("/admin");
  }

  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  const canEdit = hasMinimumRole(context.membership.role, "ESTIMATOR");

  const [usagePeriod, recentQuotes, quoteCount] = await Promise.all([
    getCurrentUsagePeriod(context.company.id),
    prisma.quote.findMany({
      where: { companyId: context.company.id },
      orderBy: { createdAt: "desc" },
      take: 3
    }),
    prisma.quote.count({ where: { companyId: context.company.id } })
  ]);
  const remaining = usagePeriod ? getUsageRemaining(usagePeriod) : null;
  const warning = usagePeriod ? getUsageWarningMessage(usagePeriod) : null;
  const subscription = context.company.subscription;

  return (
    <WorkspaceShell
      title="Workspace overview"
      description="Start a quote, review recent approvals, and keep account details within reach."
      navItems={getWorkspaceNav("/", context.membership.role)}
      actions={
        <div className="heroActions">
          <Link className="button primary" href="/quotes/new">
            New estimate
          </Link>
          <Link className="button secondary" href="/quotes">
            View history
          </Link>
        </div>
      }
    >
      <section className="statGrid" aria-label="Workspace overview">
        <article className="statCard">
          <span className="eyebrow">Current plan</span>
          <strong>{subscription?.plan.name ?? "No plan"}</strong>
          <p className="muted small">
            {subscription ? subscription.status.toLowerCase() : "Connect billing to unlock quoting"}
          </p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Quotes saved</span>
          <strong>{quoteCount}</strong>
          <p className="muted small">Saved quotes you can reopen, print, or share.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Usage remaining</span>
          <strong>{remaining ?? "No usage period"}</strong>
          <p className="muted small">
            {usagePeriod ? `${usagePeriod.used} used, ${usagePeriod.reserved} reserved` : "No active usage period"}
          </p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Your role</span>
          <strong>{context.membership.role}</strong>
          <p className="muted small">
            {canEdit ? "You can create and refine estimates." : "You can view quote history and account details."}
          </p>
        </article>
      </section>

      <section className="grid twoUp">
        <article className="card accentCard">
          <div className="sectionHeader">
            <div>
              <h2>Get started</h2>
              <p className="muted">Use the main routes instead of keeping every workflow on the dashboard.</p>
            </div>
          </div>
          <div className="stack">
            {canEdit ? (
              <Link className="detailCard" href="/quotes/new">
                <span>New estimate</span>
                <strong>Open the quote builder</strong>
                <p className="muted small">Upload a piece, review the draft, and save the approved price.</p>
              </Link>
            ) : null}
            <Link className="detailCard" href="/quotes">
              <span>Quote history</span>
              <strong>Review recent quotes</strong>
              <p className="muted small">Reopen older quotes, check prices, and download PDFs.</p>
            </Link>
            <Link className="detailCard" href="/settings">
              <span>Billing & settings</span>
              <strong>Manage plan and pricing</strong>
              <p className="muted small">Update account details, billing, and pricing inputs when needed.</p>
            </Link>
          </div>
        </article>

        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Recent quotes</h2>
              <p className="muted">A quick list of your latest quotes, without the clutter.</p>
            </div>
            <Link href="/quotes" className="textLink">
              Open quote history
            </Link>
          </div>
          {recentQuotes.length === 0 ? (
            <div className="emptyState">
              <strong>No quotes yet</strong>
              <p className="muted">Create a new estimate to populate this list.</p>
            </div>
          ) : (
            <div className="compactList">
              {recentQuotes.map((quote) => (
                <div key={quote.id} className="compactRow">
                  <div>
                    <strong>{quote.quoteNumber}</strong>
                    <p className="muted small">
                      {quote.customerName || "No customer"} · {quote.metalType}
                    </p>
                  </div>
                  <strong>
                    {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                      Number(quote.estimatedPrice)
                    )}
                  </strong>
                </div>
              ))}
            </div>
          )}
          {warning ? <p className="warningBanner">{warning}</p> : null}
        </article>
      </section>

    </WorkspaceShell>
  );
}
