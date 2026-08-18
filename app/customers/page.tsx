import Link from "next/link";
import { redirect } from "next/navigation";
import WorkspaceShell from "@/components/workspace-shell";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import { getCustomerDirectory } from "@/src/services/customers";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  if (diffMinutes < 60) return `${Math.max(1, diffMinutes)}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default async function CustomersPage() {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  if (context.company.subscription && !context.company.subscription.onboardingComplete) {
    redirect("/onboarding");
  }

  const directory = await getCustomerDirectory(context.company.id);

  return (
    <WorkspaceShell
      title="Customers"
      description="See who you have quoted, how often they return, and where each relationship stands."
      navItems={getWorkspaceNav("/customers")}
      actions={
        <>
          <Link className="button secondary" href="/quotes">
            Quote history
          </Link>
          <Link className="button primary" href="/quotes/new">
            New estimate
          </Link>
        </>
      }
    >
      <section className="statGrid">
        <article className="statCard">
          <span className="eyebrow">Named customers</span>
          <strong>{directory.totalCustomers}</strong>
          <p className="muted small">Customers with at least one named quote.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Named quotes</span>
          <strong>{directory.namedQuotes}</strong>
          <p className="muted small">Quotes tied to a specific customer name.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Unassigned quotes</span>
          <strong>{directory.totalQuotes - directory.namedQuotes}</strong>
          <p className="muted small">Quotes still waiting for a customer name.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Total quoted value</span>
          <strong>{formatCurrency(directory.totalValue)}</strong>
          <p className="muted small">All customer quote totals combined.</p>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Customer directory</h2>
            <p className="muted">
              This view groups by the customer name saved on a quote. There is no separate CRM contact record yet.
            </p>
          </div>
        </div>

        {directory.customers.length === 0 && !directory.unnamed ? (
          <div className="emptyState">
            <strong>No customers yet</strong>
            <p className="muted">Create a quote and assign a customer name to start building this directory.</p>
            <Link className="button primary" href="/quotes/new">
              New estimate
            </Link>
          </div>
        ) : (
          <div className="tableShell">
            <table className="dataTable">
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col">Quotes</th>
                  <th scope="col">Total value</th>
                  <th scope="col">Latest quote</th>
                  <th scope="col">Latest activity</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {directory.customers.map((customer) => (
                  <tr key={customer.name}>
                    <td>
                      <strong>{customer.name}</strong>
                    </td>
                    <td>{customer.quoteCount}</td>
                    <td className="quoteValue">{formatCurrency(customer.totalQuotedValue)}</td>
                    <td className="monoCell">{customer.latestQuoteNumber}</td>
                    <td title={customer.latestQuoteAt.toLocaleString()}>{formatRelativeTime(customer.latestQuoteAt)}</td>
                    <td>
                      <StatusBadge status={customer.latestStatus as "draft" | "sent" | "ordered" | "expired"} />
                    </td>
                  </tr>
                ))}
                {directory.unnamed ? (
                  <tr>
                    <td>
                      <strong>{directory.unnamed.name}</strong>
                    </td>
                    <td>{directory.unnamed.quoteCount}</td>
                    <td className="quoteValue">{formatCurrency(directory.unnamed.totalQuotedValue)}</td>
                    <td className="monoCell">{directory.unnamed.latestQuoteNumber}</td>
                    <td title={directory.unnamed.latestQuoteAt.toLocaleString()}>
                      {formatRelativeTime(directory.unnamed.latestQuoteAt)}
                    </td>
                    <td>
                      <StatusBadge status={directory.unnamed.latestStatus as "draft" | "sent" | "ordered" | "expired"} />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </WorkspaceShell>
  );
}
