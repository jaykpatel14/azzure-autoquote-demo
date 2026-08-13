import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QuoteRowActions from "@/components/quote-row-actions";
import WorkspaceShell from "@/components/workspace-shell";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { PlanGate } from "@/src/components/ui/PlanGate";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import { deriveQuoteStatus, getQuotePublicUrl, getQuote } from "@/src/services/quotes";

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

type QuoteDetailPageProps = {
  params: Promise<{
    quoteId: string;
  }>;
};

export default async function QuoteDetailPage({ params }: QuoteDetailPageProps) {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  if (context.company.subscription && !context.company.subscription.onboardingComplete) {
    redirect("/onboarding");
  }

  const { quoteId } = await params;
  const result = await getQuote({
    quoteId,
    companyId: context.company.id
  });

  if ("error" in result) {
    notFound();
  }

  const quote = result.data;
  const status = deriveQuoteStatus(quote);

  return (
    <WorkspaceShell
      title={`Quote ${quote.quoteNumber}`}
      description="Review the approved quote details, download the PDF, or open the public customer view."
      navItems={getWorkspaceNav("/quotes")}
      actions={
        <Link className="button secondary" href="/quotes">
          Back to quotes
        </Link>
      }
    >
      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Quote summary</p>
              <h2>{quote.customerName || "Unassigned"}</h2>
            </div>
            <StatusBadge status={status} />
          </div>
          <div className="detailStack">
            <div className="detailRow">
              <span>Quote number</span>
              <strong className="monoCell">{quote.quoteNumber}</strong>
            </div>
            <div className="detailRow">
              <span>Metal</span>
              <strong>{quote.metalType}</strong>
            </div>
            <div className="detailRow">
              <span>Estimated price</span>
              <strong>{formatCurrency(Number(quote.estimatedPrice))}</strong>
            </div>
            <div className="detailRow">
              <span>Created</span>
              <strong title={quote.createdAt.toLocaleString()}>{formatRelativeTime(quote.createdAt)}</strong>
            </div>
          </div>

          <div className="quoteDetailActions">
            {status === "draft" ? (
              <Link className="button secondary" href={`/quotes/new?sourceQuoteId=${quote.id}`}>
                Edit in builder
              </Link>
            ) : null}
            {status === "expired" ? (
              <form action={`/api/quotes/${quote.id}/duplicate`} method="post">
                <button className="button primary" type="submit">
                  Regenerate
                </button>
              </form>
            ) : null}
            <QuoteRowActions
              quoteId={quote.id}
              viewHref={`/quotes/${quote.id}`}
              pdfHref={`/api/quotes/${quote.id}/pdf`}
              publicHref={getQuotePublicUrl(quote.id)}
              canCopyLink={status === "sent" && context.company.subscription?.plan.code === "enterprise"}
              copyLinkTitle={
                context.company.subscription?.plan.code === "enterprise"
                  ? "Generate a PDF before sharing"
                  : "Upgrade to share quotes"
              }
              deleteRedirectTo="/quotes"
              showView={false}
              showPdf={status !== "expired"}
              showCopy={status === "sent"}
              showDelete={status === "draft"}
            />
          </div>
        </article>

        <article className="card">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Pricing details</p>
              <h2>Quote inputs</h2>
            </div>
          </div>
          <div className="pricingGrid">
            <div className="detailCard">
              <span>Metal weight</span>
              <strong>{Number(quote.metalWeightGrams).toFixed(2)} g</strong>
            </div>
            <div className="detailCard">
              <span>Center stone</span>
              <strong>{Number(quote.centerDiamondCarats).toFixed(2)} ct</strong>
            </div>
            <div className="detailCard">
              <span>Side stones</span>
              <strong>
                {Number(quote.sideDiamondCarats).toFixed(2)} ct · {quote.sideDiamondQuantity} stones
              </strong>
            </div>
            <div className="detailCard">
              <span>Public link</span>
              <Link className="textLink" href={getQuotePublicUrl(quote.id)} target="_blank">
                Open customer view
              </Link>
            </div>
          </div>

          {quote.analysis?.notes ? (
            <div className="detailCard detailCard--stacked">
              <span>Analysis notes</span>
              <p className="muted">{quote.analysis.notes}</p>
            </div>
          ) : null}

          {quote.analysis?.imageDataUrl ? (
            <img className="quoteDetailImage" src={quote.analysis.imageDataUrl} alt="Quote source image" />
          ) : null}

          {status === "sent" && !quote.order ? (
            <div style={{ marginTop: "1rem" }}>
              <PlanGate minimumPlan="enterprise" fallbackHref="/settings/billing?upgrade=1">
                <form className="stack" action="/api/orders" method="post">
                  <input type="hidden" name="quoteId" value={quote.id} />
                  <label className="field">
                    <span>Item name</span>
                    <input name="itemName" defaultValue={`${quote.quoteNumber} manufacturing order`} />
                  </label>
                  <label className="field">
                    <span>Production notes</span>
                    <textarea name="notes" rows={3} placeholder="Optional notes for the production team." />
                  </label>
                  <button className="button primary" type="submit" style={{ width: "fit-content" }}>
                    Place order
                  </button>
                </form>
              </PlanGate>
            </div>
          ) : null}

          {status === "ordered" && quote.order ? (
            <div className="detailCard detailCard--stacked" style={{ marginTop: "1rem" }}>
              <span>Manufacturing order</span>
              <strong>{quote.order.orderNumber}</strong>
              <p className="muted small">Status: {quote.order.status}</p>
              <Link className="textLink" href={`/orders/${quote.order.id}`}>
                Open order
              </Link>
            </div>
          ) : null}
        </article>
      </section>
    </WorkspaceShell>
  );
}
