import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
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
      company: {
        select: {
          name: true,
          logoUrl: true,
          websiteUrl: true,
          slug: true
        }
      },
      analysis: {
        select: {
          imageDataUrl: true
        }
      }
    }
  });

  if (!quote) {
    notFound();
  }

  const headerList = await headers();
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
          {quote.analysis?.imageDataUrl ? (
            <img
              className="publicQuoteImage"
              src={quote.analysis.imageDataUrl}
              alt={`${quote.metalType} jewelry for quote ${quote.quoteNumber}`}
            />
          ) : null}

          <div className="quotePreview publicQuotePreview">
            <p className="eyebrow">Estimated price</p>
            <p className="publicQuotePrice">{formatCurrency(Number(quote.estimatedSellingPrice ?? quote.estimatedPrice))}</p>
            <div className="quoteMeta publicQuoteMeta">
              <div>
                <span>Customer</span>
                <strong>{quote.customerName || "Unassigned"}</strong>
              </div>
              <div>
                <span>Metal</span>
                <strong>{quote.metalType}</strong>
              </div>
              <div>
                <span>Stone layout</span>
                <strong>
                  {Number(quote.centerDiamondCarats).toFixed(2)} ct center, {quote.sideDiamondQuantity} side stones
                </strong>
              </div>
              <div>
                <span>Quote date</span>
                <strong>{quote.createdAt.toLocaleDateString()}</strong>
              </div>
              <div><span>Valid until</span><strong>{expiresAt.toLocaleDateString()}</strong></div>
            </div>
          </div>

          {quote.company.websiteUrl ? <a className="publicQuoteCta" href={quote.company.websiteUrl}>Visit {quote.company.name}</a> : null}

          <p className="disclaimer">
            Final pricing is an approved estimate, not a manufacturing invoice. Production review may
            change the quote after CAD, stone verification, or metal confirmation.
          </p>
        </section>

        <footer className="publicQuoteFooter">
          <span>{quote.company.name}</span>
          {isBranded ? null : <span>Public quote preview powered by Azzure AutoQuote</span>}
        </footer>
      </article>
    </main>
  );
}
