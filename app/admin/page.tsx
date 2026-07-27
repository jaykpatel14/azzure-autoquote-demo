import Link from "next/link";
import { redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { prisma } from "@/lib/prisma";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav } from "@/lib/internal-admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  const [companies, failedWebhookEvents, companyCount, subscriptionCount, pastDueCount, quoteCount] =
    await Promise.all([
    prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        subscription: {
          include: { plan: true }
        },
        quotes: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { quoteNumber: true, estimatedPrice: true, createdAt: true }
        },
        _count: {
          select: {
            quotes: true,
            memberships: true
          }
        }
      }
    }),
    prisma.stripeWebhookEvent.findMany({
      where: { errorMessage: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 5
    }),
    prisma.company.count(),
    prisma.subscription.count(),
    prisma.subscription.count({ where: { status: "PAST_DUE" } }),
    prisma.quote.count()
  ]);

  return (
    <InternalAdminShell
      title="Operations dashboard"
      description="Support the Azzure platform, inspect customer billing health, and rotate shared API keys."
      navItems={getInternalAdminNav("/admin")}
      actions={
        <Link className="button primary" href="/admin/settings">
          Manage API keys
        </Link>
      }
    >
      <section className="statGrid">
        <article className="statCard">
          <span className="eyebrow">Companies</span>
          <strong>{companyCount}</strong>
          <p className="muted small">Customer tenants currently on the platform.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Active subscriptions</span>
          <strong>{subscriptionCount}</strong>
          <p className="muted small">Companies with billing records on file.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Past due</span>
          <strong>{pastDueCount}</strong>
          <p className="muted small">Accounts that need billing follow-up.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Quotes saved</span>
          <strong>{quoteCount}</strong>
          <p className="muted small">Aggregate quote volume across all companies.</p>
        </article>
      </section>

      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Recent companies</h2>
              <p className="muted">Use this list to jump into a customer account quickly.</p>
            </div>
            <Link className="textLink" href="/admin/companies">
              Full company list
            </Link>
          </div>
          <div className="compactList">
            {companies.slice(0, 8).map((company) => (
              <Link className="compactRow" href={`/admin/companies/${company.id}`} key={company.id}>
                <div>
                  <strong>{company.name}</strong>
                  <p className="muted small">{company.slug}</p>
                </div>
                <div className="muted small" style={{ textAlign: "right" }}>
                  <div>{company.subscription?.status.toLowerCase() ?? "no subscription"}</div>
                  <div>{company._count.quotes} quotes</div>
                </div>
              </Link>
            ))}
          </div>
        </article>

        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Webhook issues</h2>
              <p className="muted">Recent Stripe event failures that need review.</p>
            </div>
          </div>
          {failedWebhookEvents.length === 0 ? (
            <div className="emptyState">
              <strong>No failed webhooks</strong>
              <p className="muted">Stripe events are processing cleanly right now.</p>
            </div>
          ) : (
            <div className="stack">
              {failedWebhookEvents.map((event) => (
                <div className="detailCard" key={event.id}>
                  <span>{event.eventType}</span>
                  <strong>{event.eventId}</strong>
                  <p className="muted small">{event.errorMessage}</p>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </InternalAdminShell>
  );
}
