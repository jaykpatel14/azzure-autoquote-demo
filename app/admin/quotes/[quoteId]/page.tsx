import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav } from "@/lib/internal-admin-nav";
import { prisma } from "@/lib/prisma";
import { getPricingTierLabel, type MakingPriceBreakdown } from "@/src/services/pricing";

export const dynamic = "force-dynamic";

function money(value: unknown) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value ?? 0));
}

export default async function AdminQuotePage({ params }: { params: Promise<{ quoteId: string }> }) {
  const admin = await getInternalAdminContext();
  if (!admin) redirect("/signin");

  const { quoteId } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { company: true, order: true, analysis: true }
  });
  if (!quote) notFound();

  const breakdown = (quote.makingPriceBreakdown as unknown as MakingPriceBreakdown) || null;
  const tierDivisor = quote.tierDivisorSnapshot?.toString() ?? "0.7";

  return (
    <InternalAdminShell
      title={`Quote ${quote.quoteNumber}`}
      description="ADMIN VIEW — this financial breakdown is never visible to the jeweler."
      navItems={getInternalAdminNav("/admin/tenants")}
      adminName={admin.user.name || admin.user.email}
      actions={<Link className="button secondary" href={`/admin/tenants/${quote.companyId}`}>Back to tenant</Link>}
    >
      <section className="card accentCard">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Cost &amp; pricing audit breakdown</p>
            <h2>Making Price &amp; Tier Calculation</h2>
          </div>
          <span className="badge">Internal Only</span>
        </div>

        <div className="detailStack" style={{ marginTop: "1rem" }}>
          {breakdown ? (
            <>
              <div className="detailRow">
                <span>Center stone ({Number(quote.centerDiamondCarats).toFixed(2)}ct {quote.analysis?.centerShape || "stone"})</span>
                <strong>{money(breakdown.centerStoneCost)}</strong>
              </div>
              <div className="detailRow">
                <span>Side stones ({quote.sideDiamondQuantity}× stones, {Number(quote.sideDiamondCarats).toFixed(2)}ct total)</span>
                <strong>{money(breakdown.sideStoneCost)}</strong>
              </div>
              <div className="detailRow">
                <span>Center stone setting ({Number(quote.centerDiamondCarats).toFixed(2)}ct @ $20/ct)</span>
                <strong>{money(breakdown.centerStoneSettingCost)}</strong>
              </div>
              <div className="detailRow">
                <span>Side stone setting ({quote.sideDiamondQuantity}× {quote.analysis?.settingType || "prong"})</span>
                <strong>{money(breakdown.sideStoneSettingCost)}</strong>
              </div>
              <div className="detailRow">
                <span>Wax ({breakdown.pieces} piece{breakdown.pieces === 1 ? "" : "s"} @ $15/ea)</span>
                <strong>{money(breakdown.waxCost)}</strong>
              </div>
              <div className="detailRow">
                <span>Polishing ({breakdown.pieces} piece{breakdown.pieces === 1 ? "" : "s"} @ $20/ea)</span>
                <strong>{money(breakdown.polishingCost)}</strong>
              </div>
              <div className="detailRow">
                <span>CAD cost (platform fee)</span>
                <strong>{money(breakdown.cadCost)}</strong>
              </div>
              <div className="detailRow" style={{ borderTop: "1px dashed var(--color-border, #e5e7eb)", paddingTop: "0.75rem", fontWeight: 600 }}>
                <span>Subtotal (production cost)</span>
                <strong>{money(breakdown.subtotal)}</strong>
              </div>
              <div className="detailRow">
                <span>Customer margin ({breakdown.customerMarginPct}%)</span>
                <strong>+{money(breakdown.customerMarginAmount)}</strong>
              </div>
              <div className="detailRow" style={{ borderTop: "1px solid var(--color-border, #e5e7eb)", paddingTop: "0.75rem" }}>
                <span><strong>Making price</strong></span>
                <strong style={{ fontSize: "1.125rem", color: "var(--color-primary, #10172a)" }}>{money(breakdown.makingPrice)}</strong>
              </div>
              <div className="detailRow">
                <span>Tier formula (÷ {tierDivisor} × 2) [{getPricingTierLabel(quote.pricingTierSnapshot) ?? "Tier 2"}]</span>
                <span className="monoCell">÷ {tierDivisor} × 2</span>
              </div>
              <div className="detailRow" style={{ borderTop: "2px solid var(--color-obsidian, #111827)", paddingTop: "0.75rem" }}>
                <span><strong>End customer price</strong></span>
                <strong style={{ fontSize: "1.25rem", color: "var(--color-obsidian, #111827)" }}>
                  {money(quote.estimatedSellingPrice ?? quote.estimatedPrice)}
                </strong>
              </div>
            </>
          ) : (
            <>
              <div className="detailRow"><span>Making price (Azzure cost)</span><strong>{money(quote.makingPrice)}</strong></div>
              <div className="detailRow"><span>Tier applied</span><strong>{getPricingTierLabel(quote.pricingTierSnapshot) ?? "Not recorded"}</strong></div>
              <div className="detailRow"><span>Tier divisor at quote time</span><strong>{tierDivisor}</strong></div>
              <div className="detailRow"><span>End customer price</span><strong>{money(quote.estimatedSellingPrice ?? quote.estimatedPrice)}</strong></div>
            </>
          )}
        </div>
      </section>

      <section className="grid twoUp">
        <article className="card">
          <span className="eyebrow">Company</span>
          <h2>{quote.company.name}</h2>
          <p>{quote.customerName || "Unassigned customer"}</p>
          <div className="detailStack" style={{ marginTop: "1rem" }}>
            <div className="detailRow"><span>Color / Clarity</span><strong>{quote.colorClarity}</strong></div>
            <div className="detailRow"><span>Created on</span><strong>{quote.createdAt.toLocaleString()}</strong></div>
            {quote.analysis?.notes ? (
              <div className="detailRow" style={{ flexDirection: "column", alignItems: "flex-start", gap: "0.25rem" }}>
                <span>Photo description &amp; notes</span>
                <p className="muted small" style={{ margin: 0 }}>{quote.analysis.notes}</p>
              </div>
            ) : null}
          </div>
        </article>
        <article className="card">
          <span className="eyebrow">Quote specification</span>
          <h2>{quote.metalType}</h2>
          <p>{Number(quote.metalWeightGrams).toFixed(2)} g · {Number(quote.centerDiamondCarats).toFixed(2)} ct center</p>
          <div className="detailStack" style={{ marginTop: "1rem" }}>
            <div className="detailRow"><span>Side stones</span><strong>{Number(quote.sideDiamondCarats).toFixed(2)} ct ({quote.sideDiamondQuantity} stones)</strong></div>
            <div className="detailRow"><span>Center shape</span><strong>{quote.analysis?.centerShape || "Not recorded"}</strong></div>
            <div className="detailRow"><span>Setting type</span><strong>{quote.analysis?.settingType || "Not recorded"}</strong></div>
          </div>
        </article>
      </section>
    </InternalAdminShell>
  );
}
