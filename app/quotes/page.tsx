import Link from "next/link";
import { redirect } from "next/navigation";
import type { Quote } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import CompanySwitcher from "@/components/company-switcher";
import SignOutButton from "@/components/sign-out-button";
import { getAuthenticatedCompanyContext } from "@/lib/company";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  const quotes = await prisma.quote.findMany({
    where: { companyId: context.company.id },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">Azzure AutoQuote</div>
        <Link className="navItem" href="/">
          New Estimate
        </Link>
        <Link className="navItem" href="/quotes">
          Quote History
        </Link>
        <CompanySwitcher />
        <SignOutButton />
      </aside>
      <main className="main">
        <h1 className="heading">Quote History</h1>
        <section className="card">
          {quotes.length === 0 ? (
            <p className="muted">No quotes have been saved.</p>
          ) : (
            quotes.map((quote: Quote) => (
              <p key={quote.id}>
                <strong>{quote.quoteNumber}</strong> - {quote.metalType} - $
                {Number(quote.estimatedPrice).toFixed(2)}
              </p>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
