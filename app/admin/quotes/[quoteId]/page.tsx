import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav } from "@/lib/internal-admin-nav";
import { prisma } from "@/lib/prisma";
import { getPricingTierLabel } from "@/src/services/pricing";

export const dynamic = "force-dynamic";

function money(value: unknown) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(Number(value ?? 0));
}

export default async function AdminQuotePage({ params }: { params: Promise<{ quoteId: string }> }) {
  const admin = await getInternalAdminContext();
  if (!admin) redirect("/signin");

  const { quoteId } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { company: true, order: true }
  });
  if (!quote) notFound();

  return (
    <InternalAdminShell
      title={`Quote ${quote.quoteNumber}`}
      description="ADMIN VIEW — this financial breakdown is never visible to the jeweler."
      navItems={getInternalAdminNav("/admin/tenants")}
      adminName={admin.user.name || admin.user.email}
      actions={<Link className="button secondary" href={`/admin/tenants/${quote.companyId}`}>Back to tenant</Link>}
    >
      <section className="card accentCard">
        <p className="eyebrow">Internal financial snapshot</p>
        <div className="detailStack">
          <div className="detailRow"><span>Making price (Azzure cost)</span><strong>{money(quote.makingPrice)}</strong></div>
          <div className="detailRow"><span>Tier applied</span><strong>{getPricingTierLabel(quote.pricingTierSnapshot) ?? "Not recorded"}</strong></div>
          <div className="detailRow"><span>Tier divisor at quote time</span><strong>{quote.tierDivisorSnapshot?.toString() ?? "Not recorded"}</strong></div>
          <div className="detailRow"><span>End customer price</span><strong>{money(quote.estimatedSellingPrice ?? quote.estimatedPrice)}</strong></div>
        </div>
      </section>
      <section className="grid twoUp">
        <article className="card"><span className="eyebrow">Company</span><h2>{quote.company.name}</h2><p>{quote.customerName || "Unassigned customer"}</p></article>
        <article className="card"><span className="eyebrow">Quote specification</span><h2>{quote.metalType}</h2><p>{Number(quote.metalWeightGrams).toFixed(2)} g · {Number(quote.centerDiamondCarats).toFixed(2)} ct center</p></article>
      </section>
    </InternalAdminShell>
  );
}
