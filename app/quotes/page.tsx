import Link from "next/link";
import { redirect } from "next/navigation";
import TrialBanner from "@/components/trial-banner";
import TrialSidebarStatus from "@/components/trial-sidebar-status";
import QuoteRowActions from "@/components/quote-row-actions";
import WorkspaceShell from "@/components/workspace-shell";
import { UsageBar } from "@/src/components/ui/UsageBar";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { getTrialDaysRemaining, getTrialQuotesRemaining } from "@/lib/billing";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import { getQuoteHistoryPage, type QuoteHistoryFilter } from "@/src/services/quotes";
import { getUsageSummary } from "@/src/services/usage";

export const dynamic = "force-dynamic";

const FILTERS: Array<{ key: QuoteHistoryFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "ordered", label: "Ordered" },
  { key: "expired", label: "Expired" }
];

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

function buildHref(params: {
  query?: string;
  status?: QuoteHistoryFilter;
  page?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.query) searchParams.set("query", params.query);
  if (params.status && params.status !== "all") searchParams.set("status", params.status);
  if (params.page && params.page > 1) searchParams.set("page", String(params.page));
  const suffix = searchParams.toString();
  return suffix ? `/quotes?${suffix}` : "/quotes";
}

function EmptyIllustration() {
  return (
    <svg className="emptyStateIllustration" viewBox="0 0 240 120" role="img" aria-label="Jewelry outline illustration">
      <path
        d="M64 56c12-16 30-24 56-24s44 8 56 24c-12 16-30 24-56 24s-44-8-56-24Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M103 58l17-20 17 20-17 26-17-26Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M52 76h136" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

type QuotesPageProps = {
  searchParams?: Promise<{
    query?: string;
    status?: string;
    page?: string;
  }>;
};

export default async function QuotesPage({ searchParams }: QuotesPageProps) {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  if (context.company.subscription && !context.company.subscription.onboardingComplete) {
    redirect("/onboarding");
  }

  const params = searchParams ? await searchParams : undefined;
  const query = params?.query?.trim() ?? "";
  const status = (FILTERS.find((item) => item.key === params?.status)?.key ?? "all") as QuoteHistoryFilter;
  const page = Math.max(1, Number.parseInt(params?.page ?? "1", 10) || 1);

  const [history, usageResult] = await Promise.all([
    getQuoteHistoryPage({
      companyId: context.company.id,
      query,
      status,
      page,
      pageSize: 20
    }),
    getUsageSummary(context.company.id)
  ]);

  const usage = "data" in usageResult ? usageResult.data : null;
  const subscription = context.company.subscription;
  const trialDaysRemaining = getTrialDaysRemaining(subscription);
  const trialQuotesRemaining = getTrialQuotesRemaining(subscription);
  const canShare = subscription?.plan.code === "enterprise";
  const emptyFilterState = history.totalQuotes === 0;
  const isFilteredEmpty = history.totalQuotes === 0 && (query.length > 0 || status !== "all");
  const currentListHref = buildHref({ query, status, page: history.currentPage });

  return (
    <WorkspaceShell
      title="Quote history"
      description="Find every estimate, filter by status, and stay on top of the current billing window."
      navItems={getWorkspaceNav("/quotes")}
      banner={
        subscription?.status === "TRIALING" &&
        trialDaysRemaining !== null &&
        trialQuotesRemaining !== null ? (
          <TrialBanner
            companyId={context.company.id}
            daysRemaining={trialDaysRemaining}
            quoteCap={subscription.trialQuoteCap}
            quotesRemaining={trialQuotesRemaining}
          />
        ) : null
      }
      sidebarExtra={
        subscription?.status === "TRIALING" &&
        trialDaysRemaining !== null &&
        trialQuotesRemaining !== null ? (
          <TrialSidebarStatus
            daysRemaining={trialDaysRemaining}
            quoteCap={subscription.trialQuoteCap}
            quotesRemaining={trialQuotesRemaining}
            urgent={trialDaysRemaining <= 3}
          />
        ) : null
      }
      actions={
        <Link className="button primary" href="/quotes/new">
          New Quote
        </Link>
      }
    >
      <section className="quotesHeader">
        <div>
          <p className="eyebrow">Quotes</p>
          <h2 className="quotesTitle">{history.totalQuotes} quotes</h2>
          <p className="muted small">
            {usage ? `${usage.used} of ${usage.limit} used this period` : "No active usage period"}
          </p>
        </div>
        <div className="quotesUsageBlock">
          <strong>
            {usage ? usage.used : 0} of {usage ? usage.limit : 0} quotes used this period
          </strong>
          <UsageBar
            used={(usage?.used ?? 0) + (usage?.reserved ?? 0)}
            total={usage?.limit ?? 1}
            label={`${Math.round(((usage?.used ?? 0) + (usage?.reserved ?? 0)) / Math.max(usage?.limit ?? 1, 1) * 100)}% used`}
          />
        </div>
      </section>

      <section className="quotesToolbar">
        <nav className="quoteTabs" aria-label="Quote filters">
          {FILTERS.map((filter) => (
            <Link
              key={filter.key}
              href={buildHref({ query, status: filter.key, page: 1 })}
              className={`quoteTab${status === filter.key ? " isActive" : ""}`}
            >
              {filter.label} ({filter.key === "all" ? history.totalQuotes : history.counts[filter.key] ?? 0})
            </Link>
          ))}
        </nav>

        <form className="quoteSearchForm" method="get" action="/quotes">
          <input type="hidden" name="status" value={status === "all" ? "" : status} />
          <input
            className="quoteSearchInput"
            type="search"
            name="query"
            defaultValue={query}
            placeholder="Search by customer name..."
          />
          <button className="button secondary button--sm" type="submit">
            Search
          </button>
        </form>
      </section>

      <section className="tableShell">
        {history.quotes.length === 0 ? (
          <div className="emptyState emptyStateIllustrated">
            <EmptyIllustration />
            <strong>
              {emptyFilterState
                ? "No quotes yet. Create your first quote."
                : `No ${status === "all" ? "matching" : status} quotes found.`}
            </strong>
            <p className="muted">
              {isFilteredEmpty
                ? "Clear your filter or search to see all quotes again."
                : "Create your first quote to populate your history."}
            </p>
            <div className="buttonRow">
              {isFilteredEmpty ? (
                <Link className="button secondary" href="/quotes">
                  Clear filter
                </Link>
              ) : null}
              <Link className="button primary" href="/quotes/new">
                New Quote
              </Link>
            </div>
          </div>
        ) : (
          <>
            <table className="dataTable quotesTable">
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Photo</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Metal</th>
                  <th scope="col" className="alignRight">
                    Est. Value
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col">Created</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {history.quotes.map((quote) => (
                  <tr key={quote.id}>
                    <td className="monoCell">
                      <Link className="rowLink" href={`/quotes/${quote.id}`}>
                        {quote.quoteNumber}
                      </Link>
                    </td>
                    <td>
                      <Link className="quoteThumbLink" href={`/quotes/${quote.id}`}>
                        {quote.thumbnailUrl ? (
                          <img className="quoteThumbnail quoteThumbnail--small" src={quote.thumbnailUrl} alt="" />
                        ) : (
                          <div className="quoteThumbnail quoteThumbnail--small quoteThumbnail--fallback">
                            <span>{quote.quoteNumber.slice(-2)}</span>
                          </div>
                        )}
                      </Link>
                    </td>
                    <td>
                      <Link className="rowLink" href={`/quotes/${quote.id}`}>
                        <strong>{quote.customerName || "Unassigned"}</strong>
                      </Link>
                    </td>
                    <td>{quote.metalType}</td>
                    <td className="alignRight quoteValue">{formatCurrency(quote.estimatedPrice)}</td>
                    <td>
                      <StatusBadge status={quote.status} />
                    </td>
                    <td title={quote.createdAt.toLocaleString()}>{formatRelativeTime(quote.createdAt)}</td>
                    <td>
                      <QuoteRowActions
                        quoteId={quote.id}
                        viewHref={`/quotes/${quote.id}`}
                        pdfHref={`/api/quotes/${quote.id}/pdf`}
                        publicHref={`/q/${quote.id}`}
                        canCopyLink={canShare && quote.status === "sent"}
                        copyLinkTitle={canShare ? "Generate a PDF before sharing" : "Upgrade to share quotes"}
                        deleteRedirectTo={currentListHref}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="paginationBar">
              <span className="muted small">
                Page {history.currentPage} of {history.totalPages}
              </span>
              <div className="buttonRow">
                <Link
                  className="button secondary button--sm"
                  href={buildHref({ query, status, page: Math.max(1, history.currentPage - 1) })}
                  aria-disabled={history.currentPage <= 1}
                >
                  Prev
                </Link>
                <Link
                  className="button secondary button--sm"
                  href={buildHref({ query, status, page: Math.min(history.totalPages, history.currentPage + 1) })}
                  aria-disabled={history.currentPage >= history.totalPages}
                >
                  Next
                </Link>
              </div>
            </div>
          </>
        )}
      </section>
    </WorkspaceShell>
  );
}
