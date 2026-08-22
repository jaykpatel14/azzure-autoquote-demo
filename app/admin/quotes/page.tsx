import Link from "next/link";
import { redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { AdminThumbImage } from "@/components/admin-thumb-image";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav, requireAdminRouteAccess } from "@/lib/internal-admin-nav";
import { prisma } from "@/lib/prisma";
import { calculateMakingPrice, calculateTierPrice } from "@/src/services/pricing";
import { getSettingValue } from "@/lib/app-settings";
import { resolveMetalPricing, normalizePricingProfile } from "@/lib/metal-pricing";
import type { MakingPriceBreakdown } from "@/src/services/pricing";
import type { PricingTier } from "@prisma/client";

export const dynamic = "force-dynamic";

function money(value: unknown) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value ?? 0));
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

type SearchParams = Promise<{
  company?: string;
  q?: string;
  status?: string;
  page?: string;
}>;

const PAGE_SIZE = 25;
const MAX_ROWS_PER_SOURCE = 500;

type QuoteRow = {
  kind: "quote";
  id: string;
  label: string;
  href: string;
  companyName: string;
  companyId: string;
  customerName: string | null;
  metalType: string;
  metalWeightGrams: number;
  centerDiamondCarats: number;
  centerShape: string | null;
  sideDiamondQuantity: number;
  sideDiamondCarats: number;
  makingPrice: number;
  sellingPrice: number;
  marginPct: number | null;
  tierLabel: string;
  tierDivisor: string;
  createdAt: Date;
};

type UnsavedRow = {
  kind: "unsaved";
  id: string;
  label: string;
  href: string;
  companyName: string;
  companyId: string;
  customerName: string | null;
  metalType: string;
  metalWeightGrams: number;
  centerDiamondCarats: number;
  centerShape: string | null;
  sideDiamondQuantity: number;
  sideDiamondCarats: number;
  makingPrice: number | null;
  sellingPrice: number | null;
  marginPct: number | null;
  tierLabel: string;
  tierDivisor: string;
  createdAt: Date;
  statusNote: string;
};

type Row = QuoteRow | UnsavedRow;

export default async function AdminQuotesPage({ searchParams }: { searchParams?: SearchParams }) {
  const admin = await getInternalAdminContext();
  if (!admin) redirect("/signin");

  const sp = searchParams ? await searchParams : undefined;
  const companyFilter = sp?.company?.trim() || "";
  const textFilter = sp?.q?.trim() || "";
  const page = Math.max(1, parseInt(sp?.page || "1", 10));

  const companyClause = companyFilter
    ? { company: { name: { contains: companyFilter, mode: "insensitive" as const } } }
    : {};

  let quotes: any[] = [];
  let unsavedAnalyses: any[] = [];
  let rawCadCost: number | null = null;

  try {
    const [fetchedQuotes, fetchedUnsaved, fetchedCad] = await Promise.all([
      prisma.quote.findMany({
        where: {
          AND: [
            companyClause,
            textFilter
              ? {
                  OR: [
                    { quoteNumber: { contains: textFilter, mode: "insensitive" as const } },
                    { customerName: { contains: textFilter, mode: "insensitive" as const } },
                    { metalType: { contains: textFilter, mode: "insensitive" as const } }
                  ]
                }
              : {}
          ]
        },
        orderBy: { createdAt: "desc" },
        take: MAX_ROWS_PER_SOURCE,
        include: {
          company: { select: { id: true, name: true, pricingTier: true } },
          analysis: { select: { centerShape: true, settingType: true } }
        }
      }).catch((err) => {
        console.error("[admin/quotes] Failed to fetch quotes:", err);
        return [];
      }),
      prisma.aiAnalysis.findMany({
        where: {
          AND: [
            { quote: null },
            companyClause,
            textFilter ? { selectedMetal: { contains: textFilter, mode: "insensitive" as const } } : {}
          ]
        },
        orderBy: { createdAt: "desc" },
        take: MAX_ROWS_PER_SOURCE,
        include: {
          company: { include: { pricingProfile: true } }
        }
      }).catch((err) => {
        console.error("[admin/quotes] Failed to fetch unsaved analyses:", err);
        return [];
      }),
      getSettingValue("cad_cost_per_quote").catch(() => null)
    ]);

    quotes = fetchedQuotes;
    unsavedAnalyses = fetchedUnsaved;
    rawCadCost = fetchedCad;
  } catch (err) {
    console.error("[admin/quotes] Unexpected error in Promise.all:", err);
  }

  const cadCost = typeof rawCadCost === "number" ? rawCadCost : Number(rawCadCost) || 0;
  // Resolved once and reused for every unsaved-analysis estimate below, rather than
  // each row falling back to its company's static (often stale) configured profile.
  const livePricing = await resolveMetalPricing().catch(() => null);

  const quoteRows: QuoteRow[] = quotes.map((quote) => {
    const breakdown = (quote.makingPriceBreakdown as unknown as MakingPriceBreakdown) || null;
    return {
      kind: "quote",
      id: quote.id,
      label: quote.quoteNumber || `QT-${quote.id.slice(-6).toUpperCase()}`,
      href: `/admin/quotes/${quote.id}`,
      companyName: quote.company?.name || "Unknown Company",
      companyId: quote.company?.id || quote.companyId,
      customerName: quote.customerName || null,
      metalType: quote.metalType || "14K",
      metalWeightGrams: Number(quote.metalWeightGrams || 0),
      centerDiamondCarats: Number(quote.centerDiamondCarats || 0),
      centerShape: quote.analysis?.centerShape ?? null,
      sideDiamondQuantity: quote.sideDiamondQuantity || 0,
      sideDiamondCarats: Number(quote.sideDiamondCarats || 0),
      makingPrice: Number(quote.makingPrice ?? 0),
      sellingPrice: Number(quote.estimatedSellingPrice ?? quote.estimatedPrice ?? 0),
      marginPct: breakdown ? breakdown.customerMarginPct : null,
      tierLabel: quote.company?.pricingTier?.replace("TIER_", "T") ?? "—",
      tierDivisor: quote.tierDivisorSnapshot ? `÷${quote.tierDivisorSnapshot}` : "",
      createdAt: quote.createdAt ? new Date(quote.createdAt) : new Date()
    };
  });

  const unsavedRows: UnsavedRow[] = unsavedAnalyses.map((analysis) => {
    const companyMarginPct = analysis.company?.customerMarginPct ?? 0;
    const pricingTier: PricingTier | null = analysis.company?.pricingTier ?? null;
    const hasSpec =
      analysis.status === "COMPLETED" &&
      analysis.metalWeightGrams != null &&
      analysis.centerDiamondCarats != null &&
      Number(analysis.centerDiamondCarats) > 0 &&
      Boolean(pricingTier);

    let makingPrice: number | null = null;
    let sellingPrice: number | null = null;
    let statusNote = "";

    if (hasSpec) {
      try {
        const goldSpot = Number(livePricing?.pricingProfile.goldSpotPerOz ?? analysis.company?.pricingProfile?.goldSpotPerOz ?? 4500);
        const platinumSpot = Number(livePricing?.pricingProfile.platinumSpotPerOz ?? analysis.company?.pricingProfile?.platinumSpotPerOz ?? 2000);
        const silverSpot = Number(livePricing?.pricingProfile.silverSpotPerOz ?? analysis.company?.pricingProfile?.silverSpotPerOz ?? 100);
        // Live spot prices overlay the company's own configured profile, so
        // rates like center/side setting labor stay the tenant's real values
        // instead of silently falling back to the global defaults.
        const rowPricingProfile = normalizePricingProfile({
          ...(analysis.company?.pricingProfile
            ? {
                cadCharge: Number(analysis.company.pricingProfile.cadCharge),
                centerSettingPerCarat: Number(analysis.company.pricingProfile.centerSettingPerCarat),
                sideSettingPerStone: Number(analysis.company.pricingProfile.sideSettingPerStone),
                sellingMarginDivisor: Number(analysis.company.pricingProfile.sellingMarginDivisor),
                finalMultiplier: Number(analysis.company.pricingProfile.finalMultiplier)
              }
            : {}),
          goldSpotPerOz: goldSpot,
          platinumSpotPerOz: platinumSpot,
          silverSpotPerOz: silverSpot
        });
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

        const breakdown = calculateMakingPrice({
          pricingProfile: rowPricingProfile,
          metalType: analysis.selectedMetal || "14K",
          metalWeightGrams: Number(analysis.metalWeightGrams ?? 0),
          goldSpotPerOz: goldSpot,
          platinumSpotPerOz: platinumSpot,
          silverSpotPerOz: silverSpot,
          centerStone: { shape: analysis.centerShape || "round", caratWeight: Math.max(Number(analysis.centerDiamondCarats), 0.0001) },
          sideStones,
          hasWeddingBand: false,
          isTwoTone: false,
          colorClarity: "E VS1",
          cadCost: cadCost,
          customerMarginPct: companyMarginPct
        });
        const tierResult = calculateTierPrice(breakdown.makingPrice, pricingTier!);
        makingPrice = breakdown.makingPrice;
        sellingPrice = tierResult.estimatedSellingPrice;
      } catch (err) {
        console.warn(`[admin/quotes] Failed to calculate spec for analysis ${analysis.id}:`, err);
        statusNote = "Calculation error";
      }
    } else if (analysis.status !== "COMPLETED") {
      statusNote = analysis.status === "FAILED" ? "Analysis failed" : analysis.status?.toLowerCase() || "pending";
    } else if (!pricingTier) {
      statusNote = "No pricing tier";
    } else {
      statusNote = "Incomplete spec";
    }

    return {
      kind: "unsaved",
      id: analysis.id,
      label: `Unsaved ${analysis.id.slice(-6).toUpperCase()}`,
      href: `/admin/quotes/unsaved/${analysis.id}`,
      companyName: analysis.company?.name || "Unknown Company",
      companyId: analysis.company?.id || analysis.companyId,
      customerName: null,
      metalType: analysis.selectedMetal || "14K",
      metalWeightGrams: Number(analysis.metalWeightGrams ?? 0),
      centerDiamondCarats: Number(analysis.centerDiamondCarats ?? 0),
      centerShape: analysis.centerShape || null,
      sideDiamondQuantity: analysis.sideDiamondQuantity ?? 0,
      sideDiamondCarats: Number(analysis.sideDiamondCarats ?? 0),
      makingPrice,
      sellingPrice,
      marginPct: hasSpec ? companyMarginPct : null,
      tierLabel: pricingTier?.replace("TIER_", "T") ?? "—",
      tierDivisor: "",
      createdAt: analysis.createdAt ? new Date(analysis.createdAt) : new Date(),
      statusNote
    };
  });

  const allRows: Row[] = [...quoteRows, ...unsavedRows].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );

  const total = allRows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = allRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <InternalAdminShell
      title="Quote Audit Center"
      description="Full platform-wide quote ledger with cost, margin, and tier breakdowns — including analyses jewelers haven't saved as quotes yet."
      navItems={getInternalAdminNav("/admin/quotes", admin.user.adminRole as any)}
      adminName={admin.user.name || admin.user.email}
    >
      {/* ── Filters ── */}
      <section className="card adminFilterBar">
        <form method="get" className="adminFilterForm">
          <input
            name="q"
            defaultValue={textFilter}
            placeholder="Search by quote #, customer, metal…"
            className="adminFilterInput"
          />
          <input
            name="company"
            defaultValue={companyFilter}
            placeholder="Filter by company name…"
            className="adminFilterInput"
          />
          <button className="button primary button--sm" type="submit">
            Search
          </button>
          {(textFilter || companyFilter) && (
            <Link className="button secondary button--sm" href="/admin/quotes">
              Clear
            </Link>
          )}
        </form>
        <p className="muted small" style={{ marginTop: "0.5rem" }}>
          {total} record{total !== 1 ? "s" : ""} found ({quoteRows.length} saved · {unsavedRows.length} unsaved)
          {companyFilter ? ` for "${companyFilter}"` : ""}
          {textFilter ? ` matching "${textFilter}"` : ""}
        </p>
      </section>

      {/* ── Quote Table ── */}
      <section className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="adminQuotesTable">
          <div className="adminQuotesHeader">
            <div></div>
            <div>Quote</div>
            <div>Company · Customer</div>
            <div>Specification</div>
            <div>Making Cost</div>
            <div>Selling Price</div>
            <div>Margin</div>
            <div>Tier</div>
            <div>Created</div>
            <div></div>
          </div>

          {pageRows.length === 0 ? (
            <div className="emptyState" style={{ padding: "3rem" }}>
              <strong>No quotes found</strong>
              <p className="muted">Try adjusting your search filters.</p>
            </div>
          ) : (
            pageRows.map((row) => (
              <div className="adminQuoteRow" key={`${row.kind}-${row.id}`}>
                <div>
                  <Link href={row.href} className="adminQuoteThumb">
                    <AdminThumbImage
                      src={
                        row.kind === "quote"
                          ? `/api/admin/quotes/${row.id}/image`
                          : `/api/admin/quotes/unsaved/${row.id}/image`
                      }
                      alt={`${row.metalType} ${row.centerShape || "design"}`}
                    />
                  </Link>
                </div>
                <div>
                  <Link className="adminQuoteLink" href={row.href}>
                    {row.label}
                  </Link>
                  {row.kind === "unsaved" && (
                    <span
                      className="badge"
                      style={{
                        marginLeft: 8,
                        background: "rgba(245,158,11,0.12)",
                        color: "#b45309",
                        border: "1px solid rgba(245,158,11,0.25)"
                      }}
                    >
                      Unsaved
                    </span>
                  )}
                </div>
                <div>
                  <Link className="adminQuoteCompanyLink" href={`/admin/tenants/${row.companyId}`}>
                    {row.companyName}
                  </Link>
                  <span className="muted small">{row.customerName || "—"}</span>
                </div>
                <div>
                  <strong className="adminQuoteMetal">{row.metalType}</strong>
                  <span className="muted small">
                    {row.metalWeightGrams.toFixed(1)}g · {row.centerDiamondCarats.toFixed(2)}ct
                    {row.centerShape ? ` ${row.centerShape}` : ""}
                  </span>
                  {row.sideDiamondQuantity > 0 && (
                    <span className="muted small">
                      +{row.sideDiamondQuantity}× side ({row.sideDiamondCarats.toFixed(2)}ct)
                    </span>
                  )}
                </div>
                <div>
                  {row.makingPrice !== null ? (
                    <>
                      <strong>{money(row.makingPrice)}</strong>
                      <span className="muted small">production</span>
                    </>
                  ) : (
                    <span className="muted small">{row.kind === "unsaved" ? row.statusNote || "—" : "—"}</span>
                  )}
                </div>
                <div>
                  {row.sellingPrice !== null ? (
                    <>
                      <strong className="adminPriceHighlight">{money(row.sellingPrice)}</strong>
                      <span className="muted small">customer</span>
                    </>
                  ) : (
                    <span className="muted small">—</span>
                  )}
                </div>
                <div>
                  {row.marginPct !== null ? (
                    <>
                      <strong className="adminMarginBadge">{row.marginPct}%</strong>
                      <span className="muted small">markup</span>
                    </>
                  ) : (
                    <span className="muted small">—</span>
                  )}
                </div>
                <div>
                  <span className="adminTierPill">{row.tierLabel}</span>
                  {row.tierDivisor && <span className="muted small">{row.tierDivisor}</span>}
                </div>
                <div>
                  <span className="muted small">{formatDate(row.createdAt)}</span>
                </div>
                <div>
                  <Link className="button secondary button--sm" href={row.href}>
                    Audit
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="adminPagination">
            {currentPage > 1 && (
              <Link
                href={`/admin/quotes?q=${textFilter}&company=${companyFilter}&page=${currentPage - 1}`}
                className="button secondary button--sm"
              >
                ← Previous
              </Link>
            )}
            <span className="muted small">
              Page {currentPage} of {totalPages}
            </span>
            {currentPage < totalPages && (
              <Link
                href={`/admin/quotes?q=${textFilter}&company=${companyFilter}&page=${currentPage + 1}`}
                className="button secondary button--sm"
              >
                Next →
              </Link>
            )}
          </div>
        )}
      </section>
    </InternalAdminShell>
  );
}
