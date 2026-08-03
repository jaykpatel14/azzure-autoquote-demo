import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import WorkspaceShell from "@/components/workspace-shell";
import QuoteHistoryActions from "@/components/quote-history-actions";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getWorkspaceNav } from "@/lib/workspace-nav";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  const quotes = await prisma.quote.findMany({
    where: { companyId: context.company.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      quoteNumber: true,
      customerName: true,
      metalType: true,
      estimatedPrice: true,
      createdAt: true,
      pdfStorageKey: true,
      pdfStoredAt: true
    }
  });

  return (
    <WorkspaceShell
      title="Quote history"
      description="Review saved quotes for this company. Internal cost inputs remain inside the workspace."
      navItems={getWorkspaceNav("/quotes")}
      actions={
        <Link className="button primary" href="/quotes/new">
          New estimate
        </Link>
      }
    >
      <section className="statGrid">
        <article className="statCard">
          <span className="eyebrow">Saved quotes</span>
          <strong>{quotes.length}</strong>
          <p className="muted small">Only the active company can see these records.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Latest quote</span>
          <strong>{quotes[0]?.quoteNumber ?? "No quotes yet"}</strong>
          <p className="muted small">{quotes[0]?.customerName || "No customer attached"}</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">View mode</span>
          <strong>Customer-safe</strong>
          <p className="muted small">Recipients only see the approved final price.</p>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Saved quotes</h2>
            <p className="muted">Newest quotes first. No internal margin or cost fields are shown here.</p>
          </div>
        </div>
        {quotes.length === 0 ? (
          <div className="emptyState">
            <strong>No quotes have been saved yet.</strong>
            <p className="muted">Create your first estimate from the dashboard to populate this list.</p>
          </div>
        ) : (
          <div className="tableShell">
            <table className="dataTable">
              <thead>
                <tr>
                  <th scope="col">Quote</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Metal</th>
                  <th scope="col">Approved price</th>
                  <th scope="col">Created</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((quote) => (
                  <tr key={quote.id}>
                    <td>
                      <strong>{quote.quoteNumber}</strong>
                    </td>
                    <td>{quote.customerName || "Unassigned"}</td>
                    <td>{quote.metalType}</td>
                    <td>
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                        Number(quote.estimatedPrice)
                      )}
                    </td>
                    <td>{quote.createdAt.toLocaleDateString()}</td>
                    <td>
                      <QuoteHistoryActions
                        quoteId={quote.id}
                        quoteNumber={quote.quoteNumber}
                        hasStoredPdf={Boolean(quote.pdfStoredAt || quote.pdfStorageKey)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </WorkspaceShell>
  );
}
