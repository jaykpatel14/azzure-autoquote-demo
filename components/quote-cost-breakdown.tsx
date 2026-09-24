import type { MakingPriceBreakdown } from "@/src/services/pricing";
import { formatMoneyWithFx, type SupportedCurrency } from "@/lib/currency";

function money(value: unknown, currency: SupportedCurrency = "USD", fxRate?: number) {
  return formatMoneyWithFx(Number(value ?? 0), currency, fxRate);
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

export function QuoteCostBreakdown({
  breakdown,
  currency = "USD",
  fxRate
}: {
  breakdown: MakingPriceBreakdown;
  currency?: SupportedCurrency;
  fxRate?: number;
}) {
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
          <p className="eyebrow">Cost breakdown {currency === "CAD" ? "(CAD)" : "(USD)"}</p>
          <h2>What&apos;s In This Piece</h2>
          <p className="muted small">
            Pricing values were snapshotted when this quote was created
            {currency === "CAD" ? " and converted to Canadian Dollars (CAD)" : ""}.
          </p>
        </div>
      </div>
      <div className="detailStack">
        {rows.map(([label, value]) => (
          <div className="detailRow" key={label}>
            <span>{label}</span>
            <strong>{money(value, currency, fxRate)}</strong>
          </div>
        ))}
        <div className="detailRow" style={{ borderTop: "2px solid var(--color-outline-variant, #e2e8f0)", paddingTop: 12 }}>
          <span>Manufacturing cost</span>
          <strong>{money(breakdown.makingPrice, currency, fxRate)}</strong>
        </div>
        <div className="quotePreview">
          <span className="muted small">Final customer price ({currency})</span>
          <strong className="quotePrice">{money(breakdown.estimatedSellingPrice, currency, fxRate)}</strong>
        </div>
      </div>
    </section>
  );
}

export function CompactQuoteCostBreakdown({
  breakdown,
  currency = "USD",
  fxRate
}: {
  breakdown: MakingPriceBreakdown;
  currency?: SupportedCurrency;
  fxRate?: number;
}) {
  const labor = tierAdjusted(
    Number(breakdown.centerStoneSettingCost) + Number(breakdown.sideStoneSettingCost) + Number(breakdown.waxCost) + Number(breakdown.polishingCost) + Number(breakdown.cadCost),
    breakdown.tierDivisor
  );
  const diamonds = tierAdjusted(Number(breakdown.centerStoneCost) + Number(breakdown.sideStoneCost), breakdown.tierDivisor);
  const metal = tierAdjusted(breakdown.metalCost, breakdown.tierDivisor);
  return (
    <div className="muted small" style={{ display: "grid", gap: 2, minWidth: 145 }}>
      <span>Metal: <strong>{money(metal, currency, fxRate)}</strong></span>
      <span>Stones: <strong>{money(diamonds, currency, fxRate)}</strong></span>
      <span>Labor + CAD: <strong>{money(labor, currency, fxRate)}</strong></span>
    </div>
  );
}
