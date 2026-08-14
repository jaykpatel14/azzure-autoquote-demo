import Link from "next/link";
import { notFound } from "next/navigation";
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
    where: { id: token },
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
      createdAt: true,
      company: {
        select: {
          name: true,
          logoUrl: true
        }
      }
    }
  });

  if (!quote) {
    notFound();
  }

  return (
    <main className="publicQuoteShell">
      <article className="publicQuoteCard card">
        <header className="publicQuoteHeader">
          {quote.company.logoUrl ? (
            <img className="publicQuoteLogo" src={quote.company.logoUrl} alt={quote.company.name} />
          ) : (
            <p className="publicQuoteTitle">{quote.company.name}</p>
          )}
          <p className="publicQuoteBlurb">
            This is the approved estimate for quote {quote.quoteNumber}. The final price is based on the
            selected metal, stone layout, and the current pricing profile at the time of approval.
          </p>
        </header>

        <section className="publicQuoteBody">
          <div className="quotePreview" style={{ position: "relative", top: 0 }}>
            <p className="eyebrow">Approved final price</p>
            <p className="publicQuotePrice">{formatCurrency(Number(quote.estimatedPrice))}</p>
            <div className="quoteMeta" style={{ background: "rgba(255,255,255,0.06)" }}>
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
            </div>
          </div>

          <div className="publicQuoteActions">
            <Link className="button primary publicQuoteButton" href="/signin">
              Sign in for revisions
            </Link>
            <Link className="button secondary publicQuoteButton" href="/">
              Return home
            </Link>
          </div>

          <p className="disclaimer">
            Final pricing is an approved estimate, not a manufacturing invoice. Production review may
            change the quote after CAD, stone verification, or metal confirmation.
          </p>
        </section>

        <footer className="publicQuoteFooter">
          <span>{quote.company.name}</span>
          <span>Public quote preview powered by Azzure AutoQuote</span>
        </footer>
      </article>
    </main>
  );
}
