import Link from "next/link";
import { redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav } from "@/lib/internal-admin-nav";
import { prisma } from "@/lib/prisma";

import { AdminDeleteCompanyButton } from "@/components/admin-delete-company-button";

export const dynamic = "force-dynamic";

export default async function AdminCompaniesPage() {
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
      quotes: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { quoteNumber: true, estimatedPrice: true, createdAt: true }
      },
      _count: {
        select: { quotes: true, memberships: true, auditLogs: true }
      }
    }
  });

  return (
    <InternalAdminShell
      title="Customer companies"
      description="Inspect every tenant, their billing health, and the latest quote activity."
      navItems={getInternalAdminNav("/admin/companies")}
      adminName={context.user.name || context.user.email}
      actions={
        <>
          <Link className="button secondary" href="/admin/billing">
            Billing
          </Link>
          <Link className="button secondary" href="/admin/settings">
            Settings
          </Link>
          <Link className="button primary" href="/admin/companies/new">
            Create company
          </Link>
        </>
      }
    >
      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Company roster</h2>
            <p className="muted">Open a company to review billing, activity, and support details.</p>
          </div>
        </div>
        <div className="tableShell">
          <table className="dataTable">
            <thead>
              <tr>
                <th scope="col">Company</th>
                <th scope="col">Billing</th>
                <th scope="col">Quotes</th>
                <th scope="col">Members</th>
                <th scope="col">Last quote</th>
                <th scope="col" style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company) => (
                <tr key={company.id}>
                  <td>
                    <strong>
                      <Link href={`/admin/companies/${company.id}`}>{company.name}</Link>
                    </strong>
                    <p className="muted small">{company.slug}</p>
                  </td>
                  <td>
                    <span className="badge">
                      {company.subscription?.status.toLowerCase() ?? "no subscription"}
                    </span>
                  </td>
                  <td>{company._count.quotes}</td>
                  <td>{company._count.memberships}</td>
                  <td>
                    {company.quotes[0] ? (
                      <>
                        <strong>{company.quotes[0].quoteNumber}</strong>
                        <p className="muted small">
                          {new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: "USD"
                          }).format(Number(company.quotes[0].estimatedPrice))}
                        </p>
                      </>
                    ) : (
                      <span className="muted small">No quotes yet</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
                      <Link className="button secondary" style={{ padding: "6px 12px", fontSize: "12px" }} href={`/admin/companies/${company.id}`}>
                        View
                      </Link>
                      <AdminDeleteCompanyButton companyId={company.id} companyName={company.name} />
                    </div>
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
