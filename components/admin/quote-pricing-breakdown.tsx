import { getPricingTierLabel } from "@/src/services/pricing";
import type { MakingPriceBreakdown } from "@/src/services/pricing";
import type { PricingTier } from "@prisma/client";

export function money(value: unknown) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value ?? 0));
}

export function pct(value: number) {
  return `${value.toFixed(1)}%`;
}

export function num(value: unknown, decimals = 2) {
  return Number(value ?? 0).toFixed(decimals);
}

export type QuotePricingBreakdownProps = {
  breakdown: MakingPriceBreakdown;
  computedMetalCost: number;
  goldSpot: number;
  metalType: string;
  metalWeightGrams: unknown;
  centerDiamondCarats: unknown;
  centerShape: string | null | undefined;
  sideDiamondQuantity: unknown;
  sideDiamondCarats: unknown;
  settingType: string | null | undefined;
  colorClarity: string | null | undefined;
  pricingTier: PricingTier | null | undefined;
  tierDivisor: number;
  makingPrice: number;
  sellingPrice: number;
};

export function QuotePricingKpis({
  breakdown,
  pricingTier,
  tierDivisor,
  makingPrice,
  sellingPrice
}: Pick<QuotePricingBreakdownProps, "breakdown" | "pricingTier" | "tierDivisor" | "makingPrice" | "sellingPrice">) {
  const profit = sellingPrice - makingPrice;
  const profitPct = makingPrice > 0 ? (profit / makingPrice) * 100 : 0;

  return (
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
        <span className="adminKpiSub">{pct(profitPct)} return on cost</span>
      </div>
      <div className="adminKpi adminKpi--margin">
        <span className="adminKpiLabel">Jeweler Margin</span>
        <strong className="adminKpiValue adminKpiValue--amber">{`${breakdown.customerMarginPct}%`}</strong>
        <span className="adminKpiSub">Applied at quote time</span>
      </div>
      <div className="adminKpi adminKpi--tier">
        <span className="adminKpiLabel">Pricing Tier</span>
        <strong className="adminKpiValue">{getPricingTierLabel(pricingTier) ?? "—"}</strong>
        <span className="adminKpiSub">Divisor: {tierDivisor}</span>
      </div>
    </section>
  );
}

export function QuotePricingBreakdown({
  breakdown,
  computedMetalCost,
  goldSpot,
  metalType,
  metalWeightGrams,
  centerDiamondCarats,
  centerShape,
  sideDiamondQuantity,
  sideDiamondCarats,
  settingType,
  colorClarity,
  pricingTier,
  tierDivisor,
  makingPrice,
  sellingPrice
}: QuotePricingBreakdownProps) {
  const profit = sellingPrice - makingPrice;
  const profitPct = makingPrice > 0 ? (profit / makingPrice) * 100 : 0;

  // Rates shown in the "@ $X" notes are derived from the actual breakdown
  // numbers rather than hardcoded, since they depend on the company's own
  // configured profile (e.g. centerSettingPerCarat) — a hardcoded string here
  // silently goes stale the moment a tenant's rate differs from the default.
  const centerCaratsNum = Number(centerDiamondCarats) || 0;
  const sideCaratsNum = Number(sideDiamondCarats) || 0;
  const sideQtyNum = Number(sideDiamondQuantity) || 0;
  const effectiveRate = (total: number, divisor: number) => (divisor > 0 ? total / divisor : 0);

  return (
    <>
      {/* Cost Breakdown Card */}
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

        <div className="adminBreakdownTable">
          {/* Metal */}
          <div className="adminBreakdownSection">
            <div className="adminBreakdownSectionLabel">⚙️ Metal</div>
            <div className="adminBreakdownRow">
              <span>
                {metalType} · {num(metalWeightGrams, 2)}g
                <span className="adminBreakdownNote">
                  &nbsp;(spot ${num(goldSpot, 0)}/oz · 25% casting loss)
                </span>
              </span>
              <strong>{money(breakdown.metalCost || computedMetalCost)}</strong>
            </div>
          </div>

          {/* Diamonds */}
          <div className="adminBreakdownSection">
            <div className="adminBreakdownSectionLabel">💎 Diamonds</div>
            <div className="adminBreakdownRow">
              <span>
                Center stone — {num(centerDiamondCarats, 2)}ct{" "}
                {centerShape || "unknown shape"}
                <span className="adminBreakdownNote">
                  &nbsp;({colorClarity || "E VS1"}) ·{" "}
                  {money(effectiveRate(breakdown.centerStoneCost, centerCaratsNum))}/ct
                </span>
              </span>
              <strong>{money(breakdown.centerStoneCost)}</strong>
            </div>
            <div className="adminBreakdownRow">
              <span>
                Side stones — {String(sideDiamondQuantity)}× stones · {num(sideDiamondCarats, 2)}ct total
                <span className="adminBreakdownNote">
                  &nbsp;{money(effectiveRate(breakdown.sideStoneCost, sideCaratsNum))}/ct
                </span>
              </span>
              <strong>{money(breakdown.sideStoneCost)}</strong>
            </div>
          </div>

          {/* Setting */}
          <div className="adminBreakdownSection">
            <div className="adminBreakdownSectionLabel">🔩 Setting Labor</div>
            <div className="adminBreakdownRow">
              <span>
                Center setting — {num(centerDiamondCarats, 2)}ct
                <span className="adminBreakdownNote">&nbsp;@ {money(effectiveRate(breakdown.centerStoneSettingCost, centerCaratsNum))}/ct</span>
              </span>
              <strong>{money(breakdown.centerStoneSettingCost)}</strong>
            </div>
            <div className="adminBreakdownRow">
              <span>
                Side setting — {String(sideDiamondQuantity)}× {settingType || "prong"}
                <span className="adminBreakdownNote">&nbsp;{money(effectiveRate(breakdown.sideStoneSettingCost, sideQtyNum))}/stone</span>
              </span>
              <strong>{money(breakdown.sideStoneSettingCost)}</strong>
            </div>
          </div>

          {/* Production */}
          <div className="adminBreakdownSection">
            <div className="adminBreakdownSectionLabel">🏭 Production</div>
            <div className="adminBreakdownRow">
              <span>
                Wax casting — {breakdown.pieces} piece{breakdown.pieces === 1 ? "" : "s"}
                <span className="adminBreakdownNote">&nbsp;@ {money(effectiveRate(breakdown.waxCost, breakdown.pieces))}/ea</span>
              </span>
              <strong>{money(breakdown.waxCost)}</strong>
            </div>
            <div className="adminBreakdownRow">
              <span>
                Polishing — {breakdown.pieces} piece{breakdown.pieces === 1 ? "" : "s"}
                <span className="adminBreakdownNote">&nbsp;@ {money(effectiveRate(breakdown.polishingCost, breakdown.pieces))}/ea</span>
              </span>
              <strong>{money(breakdown.polishingCost)}</strong>
            </div>
            <div className="adminBreakdownRow">
              <span>
                CAD design fee
                <span className="adminBreakdownNote">&nbsp;(platform-configured flat fee)</span>
              </span>
              <strong>{money(breakdown.cadCost)}</strong>
            </div>
          </div>

          {/* Subtotal */}
          <div className="adminBreakdownDivider" />
          <div className="adminBreakdownRow adminBreakdownRow--subtotal">
            <span>Production Subtotal</span>
            <strong>{money(breakdown.subtotal)}</strong>
          </div>

          {/* Tier formula applied first on Production Subtotal */}
          <div className="adminBreakdownSection">
            <div className="adminBreakdownSectionLabel">🧮 Tier Formula Applied</div>
            <div className="adminBreakdownRow">
              <span>
                {getPricingTierLabel(pricingTier) ?? "Tier 2 - Standard"}
                <span className="adminBreakdownNote">&nbsp;→ Production Subtotal ÷ {tierDivisor} = Azzure Making Price</span>
              </span>
              <code className="adminBreakdownFormula">
                {money(breakdown.subtotal)} ÷ {tierDivisor} = {money(breakdown.makingPrice)}
              </code>
            </div>
          </div>

          {/* Making Price total */}
          <div className="adminBreakdownDivider adminBreakdownDivider--heavy" />
          <div className="adminBreakdownRow adminBreakdownRow--making">
            <span>
              <strong>Making Price</strong>
              <span className="adminBreakdownNote">&nbsp;(Azzure invoice to jeweler)</span>
            </span>
            <strong className="adminBreakdownMaking">{money(breakdown.makingPrice)}</strong>
          </div>

          {/* Jeweler Markup applied on top of Making Price */}
          <div className="adminBreakdownSection">
            <div className="adminBreakdownSectionLabel">📈 Jeweler Markup</div>
            <div className="adminBreakdownRow">
              <span>
                Customer margin — {breakdown.customerMarginPct}%
                <span className="adminBreakdownNote">&nbsp;(jeweler-configured on top of Making Price)</span>
              </span>
              <strong className="adminBreakdownPositive">+{money(breakdown.customerMarginAmount)}</strong>
            </div>
          </div>

          {/* Final customer price */}
          <div className="adminBreakdownDivider adminBreakdownDivider--heavy" />
          <div className="adminBreakdownRow adminBreakdownRow--final">
            <span>
              <strong>End Customer Price</strong>
              <span className="adminBreakdownNote">&nbsp;(jeweler charges customer)</span>
            </span>
            <strong className="adminBreakdownFinal">{money(sellingPrice || breakdown.estimatedSellingPrice)}</strong>
          </div>

          {/* Profitability check */}
          <div className="adminProfitabilityPanel">
            <div className="adminProfitabilityRow">
              <span>Jeweler profit margin (customer price − making price)</span>
              <span>
                <strong className="adminBreakdownPositive">{money(profit)}</strong>
                <span className="muted small">&nbsp;({pct(profitPct)} ROI)</span>
              </span>
            </div>
            <div className="adminProfitabilityRow">
              <span>Azzure estimated cost (production subtotal)</span>
              <span><strong>{money(breakdown.subtotal)}</strong></span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
