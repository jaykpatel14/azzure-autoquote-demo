import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav } from "@/lib/internal-admin-nav";
import { prisma } from "@/lib/prisma";
import { calculateMakingPrice, calculateMetalCost, calculateTierPrice } from "@/src/services/pricing";
import { getSettingValue } from "@/lib/app-settings";
import { loadQuoteRenderingDataUrlFromS3 } from "@/lib/quote-pdf-s3";
import { QuotePricingKpis, QuotePricingBreakdown, num } from "@/components/admin/quote-pricing-breakdown";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "medium" }).format(date);
}

export default async function AdminUnsavedAnalysisPage({
  params
}: {
  params: Promise<{ analysisId: string }>;
}) {
  const admin = await getInternalAdminContext();
  if (!admin) redirect("/signin");

  const { analysisId } = await params;
  const analysis = await prisma.aiAnalysis.findUnique({
    where: { id: analysisId },
    include: {
      company: { include: { pricingProfile: true } },
      quote: { select: { id: true } }
    }
  });
  if (!analysis) notFound();

  // Once a jeweler saves this analysis as a real quote, the audit trail lives there.
  if (analysis.quote) {
    redirect(`/admin/quotes/${analysis.quote.id}`);
  }

  const goldSpot = Number(analysis.company.pricingProfile?.goldSpotPerOz ?? 4500);
  const hasSpec =
    analysis.status === "COMPLETED" &&
    analysis.metalWeightGrams != null &&
    analysis.centerDiamondCarats != null &&
    Number(analysis.centerDiamondCarats) > 0 &&
    Boolean(analysis.company.pricingTier);

  let breakdown = null;
  let tierDivisor = 0;
  let sellingPrice = 0;
  let computedMetalCost = 0;

  if (hasSpec) {
    const cadCost = (await getSettingValue("cad_cost_per_quote")) ?? 0;
    const customerMarginPct = analysis.company.customerMarginPct ?? 0;
    const centerCarat = Math.max(Number(analysis.centerDiamondCarats), 0.0001);
    const sideDiamondQuantity = analysis.sideDiamondQuantity ?? 0;
    const sideDiamondCarats = Number(analysis.sideDiamondCarats ?? 0);
    const sideStones =
      sideDiamondQuantity > 0 && sideDiamondCarats > 0
        ? [
            {
              shape: "round",
              caratWeightEach: sideDiamondCarats / sideDiamondQuantity,
              count: sideDiamondQuantity,
              settingType: analysis.settingType || "prong"
            }
          ]
        : [];

    breakdown = calculateMakingPrice({
      metalType: analysis.selectedMetal,
      metalWeightGrams: Number(analysis.metalWeightGrams ?? 0),
      goldSpotPerOz: goldSpot,
      centerStone: { shape: analysis.centerShape || "round", caratWeight: centerCarat },
      sideStones,
      hasWeddingBand: false,
      isTwoTone: false,
      colorClarity: "E VS1",
      cadCost,
      customerMarginPct
    });
    const tierResult = calculateTierPrice(breakdown.makingPrice, analysis.company.pricingTier!);
    tierDivisor = tierResult.divisor;
    sellingPrice = tierResult.estimatedSellingPrice;
    computedMetalCost = calculateMetalCost(
      analysis.selectedMetal,
      Number(analysis.metalWeightGrams ?? 0),
      goldSpot,
      25
    );
  }

  const sourceImageUrl = analysis.sourceImageStorageKey
    ? await loadQuoteRenderingDataUrlFromS3(analysis.sourceImageStorageKey)
    : analysis.imageDataUrl ?? null;

  return (
    <InternalAdminShell
      title={`Unsaved Analysis ${analysisId.slice(-6).toUpperCase()}`}
      description="Internal pricing audit — live estimate for a jeweler analysis that has not been saved as a quote."
      navItems={getInternalAdminNav("/admin/quotes")}
      adminName={admin.user.name || admin.user.email}
      actions={
        <>
          <Link className="button secondary button--sm" href="/admin/quotes">
            ← All Quotes
          </Link>
          <Link className="button secondary button--sm" href={`/admin/tenants/${analysis.companyId}`}>
            View Tenant
          </Link>
        </>
      }
    >
      {/* ── Admin-only banner ── */}
      <div className="adminAuditBanner">
        <span className="adminAuditBannerIcon">🔒</span>
        <span>
          <strong>Internal Audit View</strong> — This analysis has not been saved as a quote by the jeweler.
          Pricing below is a live estimate computed from current company settings, not a locked snapshot.
        </span>
        <span
          className="badge"
          style={{ background: "rgba(245,158,11,0.12)", color: "#b45309", border: "1px solid rgba(245,158,11,0.25)" }}
        >
          UNSAVED
        </span>
      </div>

      {breakdown ? (
        <>
          <QuotePricingKpis
            breakdown={breakdown}
            pricingTier={analysis.company.pricingTier}
            tierDivisor={tierDivisor}
            makingPrice={breakdown.makingPrice}
            sellingPrice={sellingPrice}
          />

          <div className="adminQuoteDetailGrid">
            <section>
              <QuotePricingBreakdown
                breakdown={breakdown}
                computedMetalCost={computedMetalCost}
                goldSpot={goldSpot}
                metalType={analysis.selectedMetal}
                metalWeightGrams={analysis.metalWeightGrams}
                centerDiamondCarats={analysis.centerDiamondCarats}
                centerShape={analysis.centerShape}
                sideDiamondQuantity={analysis.sideDiamondQuantity ?? 0}
                sideDiamondCarats={analysis.sideDiamondCarats}
                settingType={analysis.settingType}
                colorClarity="E VS1"
                pricingTier={analysis.company.pricingTier}
                tierDivisor={tierDivisor}
                makingPrice={breakdown.makingPrice}
                sellingPrice={sellingPrice}
              />
            </section>

            <section>
              <div className="card">
                <p className="eyebrow">Tenant & Analysis</p>
                <h3 style={{ margin: "0.25rem 0 1rem" }}>
                  <Link href={`/admin/tenants/${analysis.companyId}`} style={{ color: "inherit", textDecoration: "none" }}>
                    {analysis.company.name}
                  </Link>
                </h3>
                <div className="detailStack">
                  <div className="detailRow">
                    <span>Analysis ID</span>
                    <strong className="monoCell">{analysis.id}</strong>
                  </div>
                  <div className="detailRow">
                    <span>Created</span>
                    <strong>{formatDate(analysis.createdAt)}</strong>
                  </div>
                  <div className="detailRow">
                    <span>Jewelry type</span>
                    <strong>{analysis.jewelryType || "—"}</strong>
                  </div>
                  <div className="detailRow">
                    <span>Setting type</span>
                    <strong>{analysis.settingType || "—"}</strong>
                  </div>
                  <div className="detailRow">
                    <span>Metal weight</span>
                    <strong>{num(analysis.metalWeightGrams, 2)} g</strong>
                  </div>
                  <div className="detailRow">
                    <span>Side stones</span>
                    <strong>
                      {num(analysis.sideDiamondCarats, 2)} ct · {analysis.sideDiamondQuantity ?? 0} stones
                    </strong>
                  </div>
                </div>
              </div>

              {sourceImageUrl && (
                <div className="card" style={{ marginTop: "1.25rem" }}>
                  <p className="eyebrow">Reference Photo</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sourceImageUrl} alt="Customer reference photo" className="adminQuoteImage" style={{ marginTop: 8 }} />
                </div>
              )}
            </section>
          </div>
        </>
      ) : (
        <div className="card adminBreakdownCard">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Cost & Margin Audit</p>
              <h2>Full Pricing Breakdown</h2>
            </div>
          </div>
          <p className="muted small" style={{ marginTop: 12 }}>
            {analysis.status !== "COMPLETED"
              ? `This analysis is still ${analysis.status.toLowerCase()} — no price can be estimated yet.`
              : !analysis.company.pricingTier
                ? "This company has no pricing tier assigned, so a customer price cannot be estimated."
                : "This analysis is missing the specification fields needed to compute a price."}
          </p>
        </div>
      )}
    </InternalAdminShell>
  );
}
