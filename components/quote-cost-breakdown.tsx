import type { MakingPriceBreakdown } from "@/src/services/pricing";

function money(value: unknown) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value ?? 0));
}

export function QuoteCostBreakdown({ breakdown }: { breakdown: MakingPriceBreakdown }) {
  const rows = [
    ["Metal", breakdown.metalCost],
    ["Center stone", breakdown.centerStoneCost],
    ["Side stones", breakdown.sideStoneCost],
    ["Center-setting labor", breakdown.centerStoneSettingCost],
    ["Side-stone setting labor", breakdown.sideStoneSettingCost],
    ["Wax / rhodium labor", breakdown.waxCost],
    ["Polishing labor", breakdown.polishingCost],
    ["CAD design", breakdown.cadCost]
  ] as const;

  return (
    <section className="card" style={{ marginTop: 20 }}>
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Manufacturing ledger</p>
          <h2>Complete Cost Breakdown</h2>
          <p className="muted small">Pricing values were snapshotted when this quote was created.</p>
        </div>
      </div>
      <div className="detailStack">
        {rows.map(([label, value]) => (
          <div className="detailRow" key={label}>
            <span>{label}</span>
            <strong>{money(value)}</strong>
          </div>
        ))}
        <div className="detailRow" style={{ borderTop: "2px solid var(--color-outline-variant, #e2e8f0)", paddingTop: 12 }}>
          <span>Manufacturing subtotal</span>
          <strong>{money(breakdown.subtotal)}</strong>
        </div>
        <div className="detailRow">
          <span>Tier price (subtotal ÷ {breakdown.tierDivisor})</span>
          <strong>{money(breakdown.makingPrice)}</strong>
        </div>
        <div className="detailRow">
          <span>Jeweler markup ({breakdown.customerMarginPct}%)</span>
          <strong>+{money(breakdown.customerMarginAmount)}</strong>
        </div>
        <div className="quotePreview">
          <span className="muted small">Final customer price</span>
          <strong className="quotePrice">{money(breakdown.estimatedSellingPrice)}</strong>
        </div>
      </div>
    </section>
  );
}

export function CompactQuoteCostBreakdown({ breakdown }: { breakdown: MakingPriceBreakdown }) {
  const labor = Number(breakdown.centerStoneSettingCost) + Number(breakdown.sideStoneSettingCost) + Number(breakdown.waxCost) + Number(breakdown.polishingCost) + Number(breakdown.cadCost);
  const diamonds = Number(breakdown.centerStoneCost) + Number(breakdown.sideStoneCost);
  return (
    <div className="muted small" style={{ display: "grid", gap: 2, minWidth: 145 }}>
      <span>Metal: <strong>{money(breakdown.metalCost)}</strong></span>
      <span>Stones: <strong>{money(diamonds)}</strong></span>
      <span>Labor + CAD: <strong>{money(labor)}</strong></span>
    </div>
  );
}
