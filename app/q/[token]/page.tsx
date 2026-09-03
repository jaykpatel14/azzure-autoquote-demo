import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { loadQuoteRenderingDataUrlFromS3 } from "@/lib/quote-pdf-s3";
import { PublicQuotePriceCard } from "@/components/public-quote-price-card";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function formatMetalDisplay(metal: string, metalColor?: string | null) {
  if (metal === "Platinum" || metal === "Silver") return metal;
  if (!metalColor) return metal;
  const suffix = metalColor === "rose" ? "rose gold" : `${metalColor} gold`;
  return `${metal} ${suffix}`;
}

export default async function PublicQuotePage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const quote = await prisma.quote.findUnique({
    where: { publicShareToken: token },
    select: {
      id: true,
      quoteNumber: true,
      customerName: true,
      metalType: true,
      metalWeightGrams: true,
      centerDiamondCarats: true,
      sideDiamondCarats: true,
      sideDiamondQuantity: true,
      estimatedPrice: true,
      estimatedSellingPrice: true,
      sharedAt: true,
      createdAt: true,
      renderingStorageKey: true,
      renderingDataUrl: true,
      company: {
        select: {
          name: true,
          logoUrl: true,
          websiteUrl: true,
          currency: true,
          slug: true
        }
      },
      analysis: {
        select: {
          imageDataUrl: true,
          sourceImageStorageKey: true,
          output: true
        }
      }
    }
  });

  if (!quote) {
    notFound();
  }

  const headerList = await headers();
  const analysisOutput = quote.analysis?.output as Record<string, unknown> | null;
  const displayMetal = formatMetalDisplay(
    quote.metalType,
    typeof analysisOutput?.metalColor === "string" ? analysisOutput.metalColor : null
  );
  const displayCenterColor =
    typeof analysisOutput?.centerStone === "object" && analysisOutput.centerStone !== null && typeof (analysisOutput.centerStone as Record<string, unknown>).color === "string"
      ? String((analysisOutput.centerStone as Record<string, unknown>).color)
      : null;
  const renderingDataUrl = quote.renderingStorageKey
    ? await loadQuoteRenderingDataUrlFromS3(quote.renderingStorageKey)
    : quote.renderingDataUrl;
  const isBranded = headerList.get("x-tenant-slug") === quote.company.slug;

  const expiresAt = quote.sharedAt ? new Date(quote.sharedAt.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
  if (!expiresAt || expiresAt <= new Date()) {
    return <main className="publicQuoteShell"><article className="publicQuoteCard card publicQuoteExpired">
      <p className="eyebrow">Quote link expired</p>
      <h1 className="publicQuoteTitle">Request an updated quote</h1>
      <p className="publicQuoteBlurb">This quote link is no longer active. Contact {quote.company.name} for a current estimate.</p>
      {quote.company.websiteUrl ? <a className="publicQuoteCta" href={quote.company.websiteUrl}>Visit {quote.company.name}</a> : null}
    </article></main>;
  }

  return (
    <main className="publicQuoteShell">
      <article className="publicQuoteCard card">
        <header className="publicQuoteHeader">
          {quote.company.logoUrl ? (
            <img
              className="publicQuoteLogo"
              src={quote.company.logoUrl}
              alt={`${quote.company.name} logo`}
              width={240}
              height={64}
            />
          ) : (
            <p className="publicQuoteTitle">{quote.company.name}</p>
          )}
          <p className="publicQuoteBlurb">
            This is the approved estimate for quote {quote.quoteNumber}. The final price is based on the
            selected metal, stone layout, and the current pricing profile at the time of approval.
          </p>
        </header>

        <section className="publicQuoteBody">
          {renderingDataUrl ? (
            <div>
              <img
                className="publicQuoteImage"
                src={renderingDataUrl}
                alt={`AI design visualization for quote ${quote.quoteNumber}`}
              />
              <p className="muted small">AI-generated design visualization. Appearance is illustrative and may differ from the finished product.</p>
            </div>
          ) : null}
          {quote.analysis?.sourceImageStorageKey || quote.analysis?.imageDataUrl ? (
            <img
              className="publicQuoteImage"
              src={quote.analysis.sourceImageStorageKey ? `/q/${token}/image` : (quote.analysis.imageDataUrl ?? "")}
              alt={`${displayMetal} jewelry for quote ${quote.quoteNumber}`}
            />
          ) : null}

          <PublicQuotePriceCard
            price={Number(quote.estimatedSellingPrice ?? quote.estimatedPrice)}
            customerName={quote.customerName || "Unassigned"}
            displayMetal={displayMetal}
            displayCenterColor={displayCenterColor}
            centerDiamondCarats={Number(quote.centerDiamondCarats)}
            sideDiamondQuantity={quote.sideDiamondQuantity}
            quoteCreatedAt={quote.createdAt.toLocaleDateString()}
            validUntil={expiresAt.toLocaleDateString()}
            defaultCurrency={(quote.company.currency as "USD" | "CAD") ?? "USD"}
          />

          {quote.company.websiteUrl ? <a className="publicQuoteCta" href={quote.company.websiteUrl}>Visit {quote.company.name}</a> : null}

          <p className="disclaimer">
            Final pricing is an approved estimate, not a manufacturing invoice. Production review may
            change the quote after CAD, stone verification, or metal confirmation.
          </p>
        </section>

        <footer className="publicQuoteFooter">
          <span>{quote.company.name}</span>
          {isBranded ? null : <span>Public quote preview powered by Azzure AI Quote · Built by azzuresolutions.com</span>}
        </footer>
      </article>
    </main>
  );
}
