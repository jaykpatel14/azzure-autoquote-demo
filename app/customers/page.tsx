import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/components/workspace-shell";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getWorkspaceNav } from "@/lib/workspace-nav";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  const quotes = await prisma.quote.findMany({
    where: { companyId: context.company.id },
    orderBy: { createdAt: "desc" },
    take: 200
  });

  type CustomerSummary = {
    name: string;
    quoteCount: number;
    latestQuote: string;
    latestPrice: number;
    lastSeen: Date;
  };

  const customers = Array.from(
    quotes.reduce((map, quote) => {
      const key = quote.customerName?.trim() || "Unassigned";
      const summary = map.get(key) ?? {
        name: key,
        quoteCount: 0,
        latestQuote: quote.quoteNumber,
        latestPrice: Number(quote.estimatedPrice),
        lastSeen: quote.createdAt
      };

      summary.quoteCount += 1;
      if (quote.createdAt > summary.lastSeen) {
        summary.latestQuote = quote.quoteNumber;
        summary.latestPrice = Number(quote.estimatedPrice);
        summary.lastSeen = quote.createdAt;
      }

      map.set(key, summary);
      return map;
    }, new Map<string, CustomerSummary>())
  ).sort((a, b) => b[1].quoteCount - a[1].quoteCount);

  return (
    <WorkspaceShell
      title="Customers"
      description="Keep track of who has received quotes. Only company members can see this directory."
      navItems={getWorkspaceNav("/customers")}
      actions={
        <Link className="button primary" href="/quotes/new">
          New estimate
        </Link>
      }
    >
      <section className="statGrid">
        <article className="statCard">
          <span className="eyebrow">Customer records</span>
          <strong>{customers.length}</strong>
          <p className="muted small">Derived from saved quote history in the active company.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Latest activity</span>
          <strong>{customers[0]?.[1].latestQuote ?? "No activity yet"}</strong>
          <p className="muted small">{customers[0]?.[1].name ?? "No customer data yet"}</p>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Customer directory</h2>
            <p className="muted">
              Customer-facing quote recipients only see the approved final price, not internal costs.
            </p>
          </div>
        </div>
        {customers.length === 0 ? (
          <div className="emptyState">
            <strong>No customer records yet.</strong>
            <p className="muted">Save a quote with a customer name to build this directory.</p>
          </div>
        ) : (
          <div className="cardsGrid">
            {customers.map(([name, customer]) => (
              <article className="detailCard" key={name}>
                <span>{name}</span>
                <strong>{customer.quoteCount} quote{customer.quoteCount === 1 ? "" : "s"}</strong>
                <p className="muted small">
                  Latest: {customer.latestQuote} |{" "}
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                    customer.latestPrice
                  )}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </WorkspaceShell>
  );
}
