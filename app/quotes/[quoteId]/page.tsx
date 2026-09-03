import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import QuoteRowActions from "@/components/quote-row-actions";
import WorkspaceShell from "@/components/workspace-shell";
import ManufacturingOrderModal from "@/components/manufacturing-order-modal";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { PlanGate } from "@/src/components/ui/PlanGate";
import { getAuthenticatedCompanyContext, canSeeFullPricing } from "@/lib/company";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import { deriveQuoteStatus, getBrandedQuotePublicUrl, getQuotePublicUrl, getQuote } from "@/src/services/quotes";
import { getFeaturesForPlan, resolvePlanId } from "@/src/stripe/plans";
import { loadAnalysisImageDataUrlFromS3, loadQuoteRenderingDataUrlFromS3 } from "@/lib/quote-pdf-s3";
import { QuoteCostBreakdown, RestrictedQuoteCostBreakdown } from "@/components/quote-cost-breakdown";
import { QuoteDetailPriceView } from "@/components/quote-detail-price-view";
import type { MakingPriceBreakdown } from "@/src/services/pricing";

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

function money(value: unknown) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value ?? 0)); }

export default async function QuoteDetailPage({ params }: QuoteDetailPageProps) {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  if (context.company.subscription && !context.company.subscription.onboardingComplete) {
    redirect("/onboarding");
  }
  if (context.company.accountStatus !== "APPROVED") redirect("/pending-approval");
  if (!context.company.pricingTier) redirect("/configuration");

  const { quoteId } = await params;
  const result = await getQuote({
    quoteId,
    companyId: context.company.id
  });

  if ("error" in result) {
    notFound();
  }

  const quote = result.data;
  const costBreakdown = quote.makingPriceBreakdown && typeof quote.makingPriceBreakdown === "object"
    ? quote.makingPriceBreakdown as unknown as MakingPriceBreakdown
    : null;
  const renderingDataUrl = quote.renderingStorageKey
    ? await loadQuoteRenderingDataUrlFromS3(quote.renderingStorageKey)
    : quote.renderingDataUrl;
  const sourceImageDataUrl = quote.analysis?.sourceImageStorageKey
    ? await loadAnalysisImageDataUrlFromS3({
        key: quote.analysis.sourceImageStorageKey,
        mimeType: quote.analysis.sourceImageMimeType || "image/jpeg"
      })
    : quote.analysis?.imageDataUrl ?? null;
  const status = deriveQuoteStatus(quote);
  const subscription = context.company.subscription;
  const canShare = Boolean(subscription && getFeaturesForPlan(resolvePlanId(subscription.plan, subscription.status)).canShareQuoteLink);
  const publicUrl = (token: string) =>
    canShare ? getBrandedQuotePublicUrl(context.company.slug, token) : getQuotePublicUrl(token);

  return (
    <WorkspaceShell
      title={`Quote ${quote.quoteNumber}`}
      description="Review the approved quote details, download the PDF, or open the public customer view."
      navItems={getWorkspaceNav("/quotes")}
      actions={
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link className="button secondary" href="/quotes">
            Back to quotes
          </Link>
          <Link
            className="button secondary"
            href={publicUrl(quote.publicShareToken ?? quote.id)}
            target="_blank"
            rel="noopener noreferrer"
            title="Open customer-facing quotation presentation"
          >
            Customer View ↗
          </Link>
          {status !== "ordered" && status !== "expired" ? (
            <PlanGate feature="canPlaceManufacturingOrder" fallbackHref="/settings/billing?upgrade=1">
              <ManufacturingOrderModal quote={{
                ...quote,
                metalWeightGrams: Number(quote.metalWeightGrams),
                centerDiamondCarats: Number(quote.centerDiamondCarats),
                sideDiamondCarats: Number(quote.sideDiamondCarats),
                estimatedSellingPrice: quote.estimatedSellingPrice ? Number(quote.estimatedSellingPrice) : null,
                estimatedPrice: quote.estimatedPrice ? Number(quote.estimatedPrice) : null
              }} />
            </PlanGate>
          ) : null}
        </div>
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
          <div className="quoteVisualGallery">
            <section className="quoteVisualPanel quoteVisualPanel--featured" aria-label="AI design visualization">
              <div className="quoteVisualPanelHeader">
                <div>
                  <p className="eyebrow">Presentation render</p>
                  <h3>Photorealistic concept</h3>
                </div>
                <span className={`statusPill ${renderingDataUrl ? "statusPill--done" : quote.renderingStatus === "PROCESSING" ? "statusPill--processing" : ""}`}>
                  {renderingDataUrl ? "Ready" : quote.renderingStatus === "PROCESSING" ? "Processing" : quote.renderingStatus === "FAILED" ? "Failed" : "Pending"}
                </span>
              </div>
              {renderingDataUrl ? (
                <img className="quoteMediaImage" src={renderingDataUrl} alt={`AI design visualization for quote ${quote.quoteNumber}`} />
              ) : (
                <div className="quoteMediaPlaceholder">
                  <strong>{quote.renderingStatus === "FAILED" ? "Render unavailable" : "Render pending"}</strong>
                  <p>
                    {quote.renderingStatus === "FAILED"
                      ? "The presentation render could not be generated yet."
                      : "The render will appear here once the AI job completes."}
                  </p>
                </div>
              )}
              <p className="muted small">
                AI-generated design visualization. Appearance is illustrative and may differ from the finished product.
              </p>
            </section>

            <section className="quoteVisualPanel" aria-label="Customer reference photo">
              <div className="quoteVisualPanelHeader">
                <div>
                  <p className="eyebrow">Source photo</p>
                  <h3>Uploaded reference</h3>
                </div>
                <span className="statusPill">
                  {sourceImageDataUrl ? "Uploaded" : "Not uploaded"}
                </span>
              </div>
              {sourceImageDataUrl ? (
                <img className="quoteMediaImage" src={sourceImageDataUrl} alt={`Customer reference image for quote ${quote.quoteNumber}`} />
              ) : (
                <div className="quoteMediaPlaceholder">
                  <strong>No upload on file</strong>
                  <p>This quote was likely created from text input or a preset product, so there is no source image to show.</p>
                </div>
              )}
              <p className="muted small">
                Uploaded customer reference photograph analyzed for this estimate.
              </p>
            </section>
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
              <span>Created</span>
              <strong title={quote.createdAt.toLocaleString()}>{formatRelativeTime(quote.createdAt)}</strong>
            </div>
          </div>

          <QuoteDetailPriceView
            price={Number(quote.estimatedSellingPrice ?? quote.estimatedPrice)}
            costBreakdown={costBreakdown}
            canSeeFullPricing={canSeeFullPricing(context.membership?.role)}
          />

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
              publicHref={publicUrl(quote.publicShareToken ?? quote.id)}
              canCopyLink={status === "sent" && canShare}
              copyLinkTitle={
                canShare
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
              {quote.publicShareToken ? <div className="detailCard">
                <span>Public link</span>
                <Link className="textLink" href={publicUrl(quote.publicShareToken)} target="_blank">Open customer view</Link>
              </div> : null}
            </div>

          {quote.analysis?.notes ? (
            <div className="detailCard detailCard--stacked">
              <span>Photo description &amp; notes</span>
              <p className="muted">{quote.analysis.notes}</p>
            </div>
          ) : null}

          {quote.notes ? (
            <div className="detailCard detailCard--stacked">
              <span>Customer / Jeweler Notes</span>
              <p className="muted">{quote.notes}</p>
            </div>
          ) : null}

          {status === "ordered" && quote.order ? (
            <div className="detailCard detailCard--stacked quoteOrderCard">
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
