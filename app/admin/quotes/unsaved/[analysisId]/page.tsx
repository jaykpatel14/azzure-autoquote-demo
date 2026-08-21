import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav } from "@/lib/internal-admin-nav";
import { prisma } from "@/lib/prisma";
import { computeAnalysisPricingBreakdown } from "@/lib/admin-analysis-pricing";
import { loadQuoteRenderingDataUrlFromS3 } from "@/lib/quote-pdf-s3";
import { num } from "@/components/admin/quote-pricing-breakdown";
import { PricingAuditor } from "@/components/admin/pricing-auditor";

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

  const { breakdown, goldSpot, platinumSpot, silverSpot, cadCost, customerMarginPct, detectedSideShape, pricingProfile } =
    await computeAnalysisPricingBreakdown(analysis);

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
          {breakdown ? (
            <a
              className="button secondary button--sm"
              href={`/api/admin/quotes/unsaved/${analysis.id}/pdf`}
              target="_blank"
              rel="noreferrer"
            >
              Print / Download PDF
            </a>
          ) : null}
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
          <div className="adminQuoteDetailGrid">
            <section>
              <PricingAuditor
                initial={{
                  metalType: analysis.selectedMetal,
                  metalWeightGrams: Number(analysis.metalWeightGrams ?? 0),
                  centerDiamondCarats: Number(analysis.centerDiamondCarats ?? 0),
                  centerShape: analysis.centerShape || "round",
                  sideDiamondQuantity: analysis.sideDiamondQuantity ?? 0,
                  sideDiamondCarats: Number(analysis.sideDiamondCarats ?? 0),
                  sideStoneShape: detectedSideShape,
                  settingType: analysis.settingType || "prong",
                  hasWeddingBand: false,
                  isTwoTone: false,
                  goldSpotPerOz: goldSpot,
                  platinumSpotPerOz: platinumSpot,
                  silverSpotPerOz: silverSpot,
                  cadCost,
                  pricingTier: analysis.company.pricingTier!,
                  customerMarginPct,
                  pricingProfile
                }}
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
