import type { MakingPriceBreakdown } from "@/src/services/pricing";

function money(value: unknown) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value ?? 0));
}

// Jewelers should see what each category actually costs them to have made —
// that's the making price (production cost with Azzure's tier fee applied),
// not the raw pre-fee subtotal. Scaling every line by the same tier divisor
// preserves each category's proportion of the total while keeping the rows
// consistent with the "Manufacturing cost" total below (division distributes
// over addition, so the scaled rows still sum to makingPrice).
function tierAdjusted(value: unknown, tierDivisor: number) {
  return Number(value ?? 0) / (tierDivisor || 1);
}

export function QuoteCostBreakdown({ breakdown }: { breakdown: MakingPriceBreakdown }) {
  const rows = [
    ["Metal", tierAdjusted(breakdown.metalCost, breakdown.tierDivisor)],
    ["Center stone", tierAdjusted(breakdown.centerStoneCost, breakdown.tierDivisor)],
    ["Side stones", tierAdjusted(breakdown.sideStoneCost, breakdown.tierDivisor)],
    ["Center-setting labor", tierAdjusted(breakdown.centerStoneSettingCost, breakdown.tierDivisor)],
    ["Side-stone setting labor", tierAdjusted(breakdown.sideStoneSettingCost, breakdown.tierDivisor)],
    ["Wax / rhodium labor", tierAdjusted(breakdown.waxCost, breakdown.tierDivisor)],
    ["Polishing labor", tierAdjusted(breakdown.polishingCost, breakdown.tierDivisor)],
    ["CAD design", tierAdjusted(breakdown.cadCost, breakdown.tierDivisor)]
  ] as const;

  return (
    <section className="card" style={{ marginTop: 20 }}>
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Cost breakdown</p>
          <h2>What&apos;s In This Piece</h2>
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
          <span>Manufacturing cost</span>
          <strong>{money(breakdown.makingPrice)}</strong>
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
  const labor = tierAdjusted(
    Number(breakdown.centerStoneSettingCost) + Number(breakdown.sideStoneSettingCost) + Number(breakdown.waxCost) + Number(breakdown.polishingCost) + Number(breakdown.cadCost),
    breakdown.tierDivisor
  );
  const diamonds = tierAdjusted(Number(breakdown.centerStoneCost) + Number(breakdown.sideStoneCost), breakdown.tierDivisor);
  const metal = tierAdjusted(breakdown.metalCost, breakdown.tierDivisor);
  return (
    <div className="muted small" style={{ display: "grid", gap: 2, minWidth: 145 }}>
      <span>Metal: <strong>{money(metal)}</strong></span>
      <span>Stones: <strong>{money(diamonds)}</strong></span>
      <span>Labor + CAD: <strong>{money(labor)}</strong></span>
    </div>
  );
}

export function RestrictedQuoteCostBreakdown({ breakdown }: { breakdown: MakingPriceBreakdown }) {
  return (
    <section className="card" style={{ marginTop: 20 }}>
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Cost overview</p>
          <h2>Pricing</h2>
        </div>
      </div>
      <div className="detailStack">
        <div className="detailRow">
          <span>Manufacturing cost</span>
          <strong>{money(breakdown.makingPrice)}</strong>
        </div>
        <div className="quotePreview">
          <span className="muted small">Final customer price</span>
          <strong className="quotePrice">{money(breakdown.estimatedSellingPrice)}</strong>
        </div>
      </div>
    </section>
  );
}
