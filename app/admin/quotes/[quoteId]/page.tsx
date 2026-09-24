import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav, requireAdminRouteAccess } from "@/lib/internal-admin-nav";
import { prisma } from "@/lib/prisma";
import { getPricingTierLabel, type MakingPriceBreakdown, calculateMetalCost } from "@/src/services/pricing";
import { loadAnalysisImageDataUrlFromS3, loadQuoteRenderingDataUrlFromS3 } from "@/lib/quote-pdf-s3";
import { resolveMetalPricing, normalizePricingProfile } from "@/lib/metal-pricing";
import { QuotePricingKpis, money, num } from "@/components/admin/quote-pricing-breakdown";
import { PricingAuditor } from "@/components/admin/pricing-auditor";
import ManufacturingOrderModal from "@/components/manufacturing-order-modal";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "medium" }).format(date);
}

export default async function AdminQuotePage({ params }: { params: Promise<{ quoteId: string }> }) {
  const admin = await getInternalAdminContext();
  if (!admin) redirect("/signin");

  const { quoteId } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      company: {
        include: {
          pricingProfile: true,
          subscription: { include: { plan: true } },
        },
      },
      order: true,
      analysis: true,
    },
  });
  if (!quote) notFound();

  const breakdown = (quote.makingPriceBreakdown as unknown as MakingPriceBreakdown) || null;
  const tierDivisor = Number(quote.tierDivisorSnapshot ?? 0.7);
  const makingPrice = Number(quote.makingPrice ?? 0);
  const sellingPrice = Number(quote.estimatedSellingPrice ?? quote.estimatedPrice ?? 0);
  const estimatedPrice = Number(quote.estimatedPrice ?? 0);
  const margin = breakdown ? breakdown.customerMarginPct : null;
  const profit = sellingPrice - makingPrice;
  const profitPct = makingPrice > 0 ? (profit / makingPrice) * 100 : 0;

  // Reflect today's live market rate in the audit sandbox rather than the
  // company's static configured profile, which drifts from the market and is
  // never auto-synced with it. Every other rate (setting labor, CAD, etc.)
  // still comes from the company's own configured profile, not the global
  // defaults — resolveMetalPricing only overrides the three spot prices.
  const baseProfile = quote.company.pricingProfile
    ? normalizePricingProfile({
        goldSpotPerOz: Number(quote.company.pricingProfile.goldSpotPerOz),
        platinumSpotPerOz: Number(quote.company.pricingProfile.platinumSpotPerOz),
        silverSpotPerOz: Number(quote.company.pricingProfile.silverSpotPerOz),
        cadCharge: Number(quote.company.pricingProfile.cadCharge),
        centerSettingPerCarat: Number(quote.company.pricingProfile.centerSettingPerCarat),
        sideSettingPerStone: Number(quote.company.pricingProfile.sideSettingPerStone),
        sellingMarginDivisor: Number(quote.company.pricingProfile.sellingMarginDivisor),
        finalMultiplier: Number(quote.company.pricingProfile.finalMultiplier)
      })
    : undefined;
  const livePricing = await resolveMetalPricing(baseProfile);
  const goldSpot = Number(livePricing.pricingProfile.goldSpotPerOz);
  const platinumSpot = Number(livePricing.pricingProfile.platinumSpotPerOz);
  const silverSpot = Number(livePricing.pricingProfile.silverSpotPerOz);
  const computedMetalCost = calculateMetalCost(
    quote.metalType ?? "14K",
    Number(quote.metalWeightGrams ?? 0),
    { goldSpotPerOz: goldSpot, platinumSpotPerOz: platinumSpot, silverSpotPerOz: silverSpot },
    25
  );

  const sideDiamondQuantity = quote.sideDiamondQuantity ?? 0;
  const detectedSideShape = (quote.analysis?.output as { sideStones?: { shape: string }[] })?.sideStones?.[0]?.shape ||
    (quote.analysis?.centerShape && ["emerald", "radiant", "cushion", "oval", "pear", "princess"].includes(quote.analysis.centerShape.toLowerCase()) && sideDiamondQuantity <= 4
      ? "fancy"
      : "round");

  const renderingDataUrl = quote.renderingStorageKey
    ? await loadQuoteRenderingDataUrlFromS3(quote.renderingStorageKey)
    : quote.renderingDataUrl;

  const sourceImageUrl = quote.analysis?.sourceImageStorageKey
    ? await loadAnalysisImageDataUrlFromS3({
        key: quote.analysis.sourceImageStorageKey,
        mimeType: quote.analysis.sourceImageMimeType || "image/jpeg"
      })
    : quote.analysis?.imageDataUrl ?? null;

  const planName = quote.company.subscription?.plan.name ?? "No plan";
  const planStatus = quote.company.subscription?.status ?? "inactive";

  return (
    <InternalAdminShell
      title={`Quote ${quote.quoteNumber}`}
      description="Internal pricing audit — full cost ledger, margin analysis, and tier mechanics."
      navItems={getInternalAdminNav("/admin/quotes", admin.user.adminRole )}
      adminName={admin.user.name || admin.user.email}
      actions={
        <>
          <Link className="button secondary button--sm" href="/admin/quotes">
            ← All Quotes
          </Link>
          <Link className="button secondary button--sm" href={`/admin/tenants/${quote.companyId}`}>
            View Tenant
          </Link>
          <a
            className="button secondary button--sm"
            href={`/api/admin/quotes/${quote.id}/pdf`}
            target="_blank"
            rel="noreferrer"
          >
            Print / Download PDF
          </a>
          {!quote.order && quote.company.accountStatus === "APPROVED" && (
            <ManufacturingOrderModal quote={{
                ...quote,
                metalWeightGrams: Number(quote.metalWeightGrams),
                centerDiamondCarats: Number(quote.centerDiamondCarats),
                sideDiamondCarats: Number(quote.sideDiamondCarats),
                estimatedSellingPrice: quote.estimatedSellingPrice ? Number(quote.estimatedSellingPrice) : null,
                estimatedPrice: quote.estimatedPrice ? Number(quote.estimatedPrice) : null
              }} />
          )}
        </>
      }
    >
      {/* ── Admin-only banner ── */}
      <div className="adminAuditBanner" role="note" aria-label="Internal audit notice">
        <span className="adminAuditBannerIcon">🔒</span>
        <span>
          <strong>Internal Audit View</strong> — This pricing breakdown is never exposed to the jeweler or customer. Contains Azzure cost structure and margin data.
        </span>
        <span className="badge" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
          ADMIN ONLY
        </span>
      </div>

      {breakdown ? (
        <QuotePricingKpis
          breakdown={breakdown}
          pricingTier={quote.pricingTierSnapshot}
          tierDivisor={tierDivisor}
          makingPrice={makingPrice}
          sellingPrice={sellingPrice}
        />
      ) : (
        <section className="adminKpiGrid">
          <div className="adminKpi adminKpi--production">
            <span className="adminKpiLabel">Azzure Making Price</span>
            <strong className="adminKpiValue">{money(makingPrice)}</strong>
            <span className="adminKpiSub">Invoice price to jeweler</span>
          </div>
          <div className="adminKpi adminKpi--selling">
            <span className="adminKpiLabel">Customer Selling Price</span>
            <strong className="adminKpiValue adminKpiValue--green">{money(sellingPrice)}</strong>
            <span className="adminKpiSub">What the end customer pays</span>
          </div>
          <div className="adminKpi adminKpi--profit">
            <span className="adminKpiLabel">Jeweler Gross Profit</span>
            <strong className="adminKpiValue adminKpiValue--blue">{money(profit)}</strong>
            <span className="adminKpiSub">{profitPct.toFixed(1)}% return on cost</span>
          </div>
          <div className="adminKpi adminKpi--margin">
            <span className="adminKpiLabel">Jeweler Margin</span>
            <strong className="adminKpiValue adminKpiValue--amber">{margin !== null ? `${margin}%` : "—"}</strong>
            <span className="adminKpiSub">Applied at quote time</span>
          </div>
          <div className="adminKpi adminKpi--tier">
            <span className="adminKpiLabel">Pricing Tier</span>
            <strong className="adminKpiValue">{getPricingTierLabel(quote.pricingTierSnapshot) ?? "—"}</strong>
            <span className="adminKpiSub">Divisor: {tierDivisor}</span>
          </div>
        </section>
      )}

      <div className="adminQuoteDetailGrid">
        {/* ── COLUMN 1: Full Pricing Breakdown ── */}
        <section>
          {breakdown ? (
            <PricingAuditor
              initial={{
                metalType: quote.metalType ?? "14K",
                metalWeightGrams: Number(quote.metalWeightGrams ?? 0),
                centerDiamondCarats: Number(quote.centerDiamondCarats ?? 0),
                centerShape: quote.analysis?.centerShape || "round",
                sideDiamondQuantity: quote.sideDiamondQuantity ?? 0,
                sideDiamondCarats: Number(quote.sideDiamondCarats ?? 0),
                sideStoneShape: detectedSideShape,
                settingType: quote.analysis?.settingType || "prong",
                hasWeddingBand: breakdown.pieces === 2,
                isTwoTone: false,
                goldSpotPerOz: goldSpot,
                platinumSpotPerOz: platinumSpot,
                silverSpotPerOz: silverSpot,
                cadCost: breakdown.cadCost,
                pricingTier: quote.pricingTierSnapshot ?? "TIER_2",
                customerMarginPct: breakdown.customerMarginPct,
                pricingProfile: livePricing.pricingProfile
              }}
            />
          ) : (
            <div className="card adminBreakdownCard">
              <div className="sectionHeader">
                <div>
                  <p className="eyebrow">Cost & Margin Audit</p>
                  <h2>Full Pricing Breakdown</h2>
                </div>
                <span className="badge" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                  Internal Only
                </span>
              </div>

              {/* Fallback for legacy quotes without full breakdown */}
              <div className="adminBreakdownTable">
                <div className="adminBreakdownRow">
                  <span>Making Price (Azzure cost)</span>
                  <strong>{money(quote.makingPrice)}</strong>
                </div>
                <div className="adminBreakdownRow">
                  <span>Tier applied</span>
                  <strong>{getPricingTierLabel(quote.pricingTierSnapshot) ?? "Not recorded"}</strong>
                </div>
                <div className="adminBreakdownRow">
                  <span>Tier divisor at quote time</span>
                  <strong>{tierDivisor}</strong>
                </div>
                <div className="adminBreakdownRow">
                  <span>Formula</span>
                  <code className="adminBreakdownFormula">
                    {money(makingPrice)} ÷ {tierDivisor} = {money(sellingPrice)}
                  </code>
                </div>
                <div className="adminBreakdownDivider adminBreakdownDivider--heavy" />
                <div className="adminBreakdownRow adminBreakdownRow--final">
                  <span><strong>End Customer Price</strong></span>
                  <strong className="adminBreakdownFinal">{money(sellingPrice)}</strong>
                </div>
                <p className="muted small" style={{ marginTop: "1rem" }}>
                  ⚠️ This quote was created before full breakdown snapshots were stored. Only top-level figures are available.
                </p>
              </div>
            </div>
          )}

          {/* Spot prices card */}
          <div className="card adminMarketRatesCard">
            <p className="eyebrow">Current Live Market Rates</p>
            <h3 style={{ margin: "0.25rem 0 1rem" }}>Metal Spot Pricing (Today)</h3>
            <p className="muted small" style={{ marginTop: -8, marginBottom: 12 }}>
              {livePricing.source !== "configured-default" ? "🟢 Live pricing" : "🟡 Configured fallback (live feed unavailable)"} — {livePricing.message}
              {" "}Not a historical snapshot — the locked price this quote actually charged is the KPI grid above.
            </p>
            <div className="adminSpotGrid">
              <div className="adminSpotCard">
                <span>Gold / oz</span>
                <strong>${num(goldSpot, 2)}</strong>
              </div>
              <div className="adminSpotCard">
                <span>Platinum / oz</span>
                <strong>${num(platinumSpot, 2)}</strong>
              </div>
              <div className="adminSpotCard">
                <span>Silver / oz</span>
                <strong>${num(silverSpot, 2)}</strong>
              </div>
              <div className="adminSpotCard">
                <span>Computed metal cost</span>
                <strong>{money(breakdown?.metalCost ?? computedMetalCost)}</strong>
              </div>
            </div>
          </div>
        </section>

        {/* ── COLUMN 2: Quote Details + Images ── */}
        <section>
          {/* Tenant & Quote Info */}
          <div className="card">
            <p className="eyebrow">Tenant & Quote</p>
            <h3 style={{ margin: "0.25rem 0 1rem" }}>
              <Link href={`/admin/tenants/${quote.companyId}`} style={{ color: "inherit", textDecoration: "none" }}>
                {quote.company.name}
              </Link>
            </h3>
            <div className="detailStack">
              <div className="detailRow">
                <span>Quote number</span>
                <strong className="monoCell">{quote.quoteNumber}</strong>
              </div>
              <div className="detailRow">
                <span>Customer</span>
                {admin.user.adminRole === "OPERATIONS_MANAGER" ? (
                  <strong style={{ fontStyle: "italic", opacity: 0.7, color: "var(--color-on-surface-variant)" }}>[Confidential to Jeweler]</strong>
                ) : (
                  <strong>{quote.customerName || "Unassigned"}</strong>
                )}
              </div>
              <div className="detailRow">
                <span>Created</span>
                <strong>{formatDate(quote.createdAt)}</strong>
              </div>
              <div className="detailRow">
                <span>Plan at quote time</span>
                <strong>
                  {planName}
                  <span className="muted small">&nbsp;({planStatus})</span>
                </strong>
              </div>
              {quote.order && (
                <div className="detailRow">
                  <span>Manufacturing order</span>
                  <strong className="monoCell">{quote.order.orderNumber}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Specification */}
          <div className="card" style={{ marginTop: "1.25rem" }}>
            <p className="eyebrow">Specification</p>
            <h3 style={{ margin: "0.25rem 0 1rem" }}>{quote.metalType}</h3>
            <div className="detailStack">
              <div className="detailRow">
                <span>Metal weight</span>
                <strong>{num(quote.metalWeightGrams, 2)} g</strong>
              </div>
              <div className="detailRow">
                <span>Center stone</span>
                <strong>
                  {num(quote.centerDiamondCarats, 2)} ct {quote.analysis?.centerShape || ""}
                </strong>
              </div>
              <div className="detailRow">
                <span>Side stones</span>
                <strong>
                  {Number(quote.sideDiamondCarats).toFixed(2)} ct · {quote.sideDiamondQuantity} stones
                </strong>
              </div>
              <div className="detailRow">
                <span>Color / Clarity</span>
                <strong>{quote.colorClarity || "E VS1"}</strong>
              </div>
              {quote.analysis?.settingType && (
                <div className="detailRow">
                  <span>Setting type</span>
                  <strong>{quote.analysis.settingType}</strong>
                </div>
              )}
              {quote.analysis?.centerClarity && (
                <div className="detailRow">
                  <span>Center clarity (AI)</span>
                  <strong>{quote.analysis.centerClarity}</strong>
                </div>
              )}
            </div>
          </div>

          {/* AI Analysis Notes */}
          {quote.analysis?.notes && (
            <div className="card" style={{ marginTop: "1.25rem" }}>
              <p className="eyebrow">AI Analysis Notes</p>
              <p className="muted small" style={{ marginTop: "0.5rem", lineHeight: 1.6 }}>
                {quote.analysis.notes}
              </p>
            </div>
          )}

          {/* Customer / Jeweler Notes */}
          {quote.notes && (
            <div className="card" style={{ marginTop: "1.25rem" }}>
              <p className="eyebrow">Customer / Jeweler Notes</p>
              <p className="muted small" style={{ marginTop: "0.5rem", lineHeight: 1.6 }}>
                {quote.notes}
              </p>
            </div>
          )}

          {/* Images */}
          {(renderingDataUrl || sourceImageUrl) && (
            <div className="card" style={{ marginTop: "1.25rem" }}>
              <p className="eyebrow">Images</p>
              <div className="adminImageGrid">
                {sourceImageUrl && (
                  <div className="adminImageCell">
                    <span className="adminImageLabel">Customer Reference</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sourceImageUrl} alt="Customer reference photo" className="adminQuoteImage" />
                  </div>
                )}
                {renderingDataUrl && (
                  <div className="adminImageCell">
                    <span className="adminImageLabel">AI Visualization</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={renderingDataUrl} alt="AI-generated rendering" className="adminQuoteImage" />
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </InternalAdminShell>
  );
}
