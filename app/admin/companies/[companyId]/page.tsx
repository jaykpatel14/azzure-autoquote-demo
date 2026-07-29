import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav } from "@/lib/internal-admin-nav";
import { prisma } from "@/lib/prisma";

type AdminCompanyPageProps = {
  params: Promise<{
    companyId: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function AdminCompanyPage({ params }: AdminCompanyPageProps) {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  const { companyId } = await params;
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      subscription: {
        include: { plan: true }
      },
      pricingProfile: true,
      memberships: {
        include: { user: { select: { email: true, name: true } } },
        orderBy: { id: "desc" }
      },
      quotes: {
        orderBy: { createdAt: "desc" },
        take: 10
      },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 10
      },
      usagePeriods: {
        orderBy: { periodStart: "desc" },
        take: 3
      }
    }
  });

  if (!company) {
    notFound();
  }

  return (
    <InternalAdminShell
      title={company.name}
      description="Review billing, quote history, team access, and support evidence for this company."
      navItems={getInternalAdminNav("/admin/companies")}
      actions={
        <Link className="button secondary" href="/admin/companies">
          Back to companies
        </Link>
      }
    >
      <section className="statGrid">
        <article className="statCard">
          <span className="eyebrow">Subscription</span>
          <strong>{company.subscription?.status.toLowerCase() ?? "inactive"}</strong>
          <p className="muted small">{company.subscription?.plan.name ?? "No subscription record"}</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Quotes</span>
          <strong>{company.quotes.length}</strong>
          <p className="muted small">Most recent quotes for this tenant.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Members</span>
          <strong>{company.memberships.length}</strong>
          <p className="muted small">Users attached to this company.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Usage periods</span>
          <strong>{company.usagePeriods.length}</strong>
          <p className="muted small">Billing periods on record.</p>
        </article>
      </section>

      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Billing details</h2>
              <p className="muted">Use these identifiers while diagnosing payment support issues.</p>
            </div>
          </div>
          <div className="stack">
            <div className="detailCard">
              <span>Stripe customer</span>
              <strong>{company.subscription?.stripeCustomerId ?? "Not set"}</strong>
            </div>
            <div className="detailCard">
              <span>Stripe subscription</span>
              <strong>{company.subscription?.stripeSubscriptionId ?? "Not set"}</strong>
            </div>
            <div className="detailCard">
              <span>Current period</span>
              <strong>
                {company.subscription
                  ? `${company.subscription.currentPeriodStart.toLocaleDateString()} to ${company.subscription.currentPeriodEnd.toLocaleDateString()}`
                  : "No billing period"}
              </strong>
            </div>
            <div className="detailCard">
              <span>Plan</span>
              <strong>{company.subscription?.plan.name ?? "None"}</strong>
            </div>
          </div>
        </article>

        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Pricing profile</h2>
              <p className="muted">Company-level pricing values used in quote calculations.</p>
            </div>
          </div>
          {company.pricingProfile ? (
            <div className="pricingGrid">
              <div className="detailCard">
                <span>Gold spot / oz</span>
                <strong>{Number(company.pricingProfile.goldSpotPerOz).toFixed(2)}</strong>
              </div>
              <div className="detailCard">
                <span>Platinum spot / oz</span>
                <strong>{Number(company.pricingProfile.platinumSpotPerOz).toFixed(2)}</strong>
              </div>
              <div className="detailCard">
                <span>Silver spot / oz</span>
                <strong>{Number(company.pricingProfile.silverSpotPerOz).toFixed(2)}</strong>
              </div>
              <div className="detailCard">
                <span>CAD charge</span>
                <strong>{Number(company.pricingProfile.cadCharge).toFixed(2)}</strong>
              </div>
            </div>
          ) : (
            <div className="emptyState">
              <strong>No company pricing profile</strong>
              <p className="muted">This tenant is using default pricing values.</p>
            </div>
          )}
        </article>
      </section>

      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Team members</h2>
              <p className="muted">Internal users who can access this company.</p>
            </div>
          </div>
          <div className="stack">
            {company.memberships.map((membership) => (
              <div className="detailCard" key={membership.id}>
                <span>Customer</span>
                <strong>{membership.user.name || membership.user.email}</strong>
                <p className="muted small">{membership.user.email}</p>
              </div>
            ))}
          </div>
          <hr style={{ margin: "1.25rem 0", borderColor: "rgba(15, 23, 42, 0.08)" }} />
          <div className="sectionHeader">
            <div>
              <h3>Add team member</h3>
              <p className="muted">Attach an existing user or create a brand new one for this tenant.</p>
            </div>
          </div>
          <form className="stack" action={`/api/admin/companies/${company.id}/members`} method="post">
            <input type="hidden" name="redirectTo" value={`/admin/companies/${company.id}`} />
            <div className="grid twoUp">
              <label className="field">
                <span>Name</span>
                <input name="name" placeholder="New team member" />
              </label>
              <label className="field">
                <span>Email</span>
                <input name="email" type="email" placeholder="user@acme.com" required />
              </label>
            </div>
            <label className="field">
              <span>Password</span>
              <input
                name="password"
                type="password"
                placeholder="Required for brand new users"
                minLength={8}
              />
            </label>
            <p className="disclaimer">
              Existing users are reused automatically. If the email does not exist yet, a password is
              required so the admin team can hand off access securely.
            </p>
            <button className="button primary" type="submit" style={{ width: "fit-content" }}>
              Add member
            </button>
          </form>
        </article>

        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Support history</h2>
              <p className="muted">Recent audit log entries for this tenant.</p>
            </div>
          </div>
          <div className="stack">
            {company.auditLogs.length === 0 ? (
              <div className="emptyState">
                <strong>No support activity yet</strong>
              </div>
            ) : (
              company.auditLogs.map((entry) => (
                <div className="detailCard" key={entry.id}>
                  <span>{entry.action}</span>
                  <strong>{entry.targetType || "System"}</strong>
                  <p className="muted small">{entry.createdAt.toLocaleString()}</p>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Quote sample</h2>
            <p className="muted">Quick access to recent pricing history when support needs context.</p>
          </div>
        </div>
        {company.quotes.length === 0 ? (
          <div className="emptyState">
            <strong>No quotes yet</strong>
          </div>
        ) : (
          <div className="tableShell">
            <table className="dataTable">
              <thead>
                <tr>
                  <th scope="col">Quote</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Metal</th>
                  <th scope="col">Price</th>
                </tr>
              </thead>
              <tbody>
                {company.quotes.map((quote) => (
                  <tr key={quote.id}>
                    <td>{quote.quoteNumber}</td>
                    <td>{quote.customerName || "Unassigned"}</td>
                    <td>{quote.metalType}</td>
                    <td>
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD"
                      }).format(Number(quote.estimatedPrice))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </InternalAdminShell>
  );
}
