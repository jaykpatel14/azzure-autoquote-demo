import Link from "next/link";
import { redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav } from "@/lib/internal-admin-nav";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminBillingPage() {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  const companies = await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subscription: {
        include: { plan: true }
      },
      pricingProfile: true,
      _count: {
        select: { quotes: true, memberships: true, usagePeriods: true }
      }
    }
  });

  return (
    <InternalAdminShell
      title="Billing"
      description="Edit every company billing record, pricing profile, and support identifier from one place."
      navItems={getInternalAdminNav("/admin/billing")}
      adminName={context.user.name || context.user.email}
      actions={
        <Link className="button secondary" href="/admin/settings">
          System settings
        </Link>
      }
    >
      <section className="statGrid">
        <article className="statCard">
          <span className="eyebrow">Companies</span>
          <strong>{companies.length}</strong>
          <p className="muted small">Tenants available for billing and support updates.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Active plans</span>
          <strong>
            {
              new Set(
                companies
                  .map((company) => company.subscription?.plan.code)
                  .filter(Boolean)
              ).size
            }
          </strong>
          <p className="muted small">Distinct plans currently assigned across tenants.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Usage windows</span>
          <strong>{companies.reduce((count, company) => count + company._count.usagePeriods, 0)}</strong>
          <p className="muted small">Billing periods available for support review.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Quote volume</span>
          <strong>{companies.reduce((count, company) => count + company._count.quotes, 0)}</strong>
          <p className="muted small">Total quotes tied to company billing records.</p>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Billing roster</h2>
            <p className="muted">Open a company to edit billing, pricing, and subscription values.</p>
          </div>
          <Link className="button primary" href="/admin/companies">
            Companies
          </Link>
        </div>
        <div className="tableShell">
          <table className="dataTable">
            <thead>
              <tr>
                <th scope="col">Company</th>
                <th scope="col">Plan</th>
                <th scope="col">Status</th>
                <th scope="col">Price feed</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id}>
                  <td>
                    <strong>{company.name}</strong>
                    <p className="muted small">{company.slug}</p>
                  </td>
                  <td>{company.subscription?.plan.name ?? "No plan"}</td>
                  <td>
                    <span className="badge">
                      {company.subscription?.status.toLowerCase() ?? "inactive"}
                    </span>
                  </td>
                  <td>{company.pricingProfile ? "Custom profile" : "Default profile"}</td>
                  <td>
                    <Link className="textLink" href={`/admin/billing/${company.id}`}>
                      Edit billing
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </InternalAdminShell>
  );
}
