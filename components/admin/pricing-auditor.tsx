"use client";

import { useMemo, useState } from "react";
import type { PricingTier } from "@prisma/client";
import { calculateMakingPrice, getPricingTierLabel } from "@/src/services/pricing";
import { METAL_TYPES, type MetalType } from "@/lib/pricing";
import { QuotePricingBreakdown, QuotePricingKpis } from "@/components/admin/quote-pricing-breakdown";

const PRICING_TIERS: PricingTier[] = ["TIER_1", "TIER_2", "TIER_3"];

export type PricingAuditorInitialValues = {
  metalType: string;
  metalWeightGrams: number;
  centerDiamondCarats: number;
  centerShape: string;
  sideDiamondQuantity: number;
  sideDiamondCarats: number;
  sideStoneShape: string;
  settingType: string;
  hasWeddingBand: boolean;
  isTwoTone: boolean;
  goldSpotPerOz: number;
  platinumSpotPerOz: number;
  silverSpotPerOz: number;
  cadCost: number;
  pricingTier: PricingTier;
  customerMarginPct: number;
};

function isMetalType(value: string): value is MetalType {
  return (METAL_TYPES as readonly string[]).includes(value);
}

export function PricingAuditor({ initial }: { initial: PricingAuditorInitialValues }) {
  const [values, setValues] = useState(initial);

  const set = <K extends keyof PricingAuditorInitialValues>(key: K, value: PricingAuditorInitialValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const isDirty = useMemo(
    () => (Object.keys(initial) as (keyof PricingAuditorInitialValues)[]).some((key) => initial[key] !== values[key]),
    [initial, values]
  );

  const { breakdown, error } = useMemo(() => {
    try {
      const sideStones =
        values.sideDiamondQuantity > 0 && values.sideDiamondCarats > 0
          ? [
              {
                shape: values.sideStoneShape || "round",
                caratWeightEach: values.sideDiamondCarats / values.sideDiamondQuantity,
                count: values.sideDiamondQuantity,
                settingType: values.settingType || "prong"
              }
            ]
          : [];

      return {
        breakdown: calculateMakingPrice({
          metalType: values.metalType,
          metalWeightGrams: values.metalWeightGrams,
          goldSpotPerOz: values.goldSpotPerOz,
          platinumSpotPerOz: values.platinumSpotPerOz,
          silverSpotPerOz: values.silverSpotPerOz,
          centerStone: {
            shape: values.centerShape || "round",
            caratWeight: Math.max(values.centerDiamondCarats, 0.0001)
          },
          sideStones,
          hasWeddingBand: values.hasWeddingBand,
          isTwoTone: values.isTwoTone,
          colorClarity: "E VS1",
          cadCost: values.cadCost,
          pricingTier: values.pricingTier,
          customerMarginPct: values.customerMarginPct
        }),
        error: null as string | null
      };
    } catch (err) {
      return { breakdown: null, error: err instanceof Error ? err.message : "Unable to compute a price for these inputs." };
    }
  }, [values]);

  return (
    <div className="card adminBreakdownCard" style={{ marginBottom: "1.25rem" }}>
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">What-If Pricing Sandbox</p>
          <h2>Adjust Parameters</h2>
          <p className="muted small" style={{ marginTop: 4 }}>
            Tweak any input to see production cost, making price, and customer price recalculate instantly.
            Nothing here is saved — this is a live audit tool only.
          </p>
        </div>
        {isDirty && (
          <button type="button" className="button secondary button--sm" onClick={() => setValues(initial)}>
            Reset to original
          </button>
        )}
      </div>

      <div className="adminAuditorGrid">
        <label className="field" style={{ margin: 0 }}>
          <span>Metal type</span>
          <select
            value={values.metalType}
            onChange={(e) => set("metalType", isMetalType(e.target.value) ? e.target.value : values.metalType)}
          >
            {METAL_TYPES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>

        <label className="field" style={{ margin: 0 }}>
          <span>Metal weight (g)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={values.metalWeightGrams}
            onChange={(e) => set("metalWeightGrams", Number(e.target.value) || 0)}
          />
        </label>

        <label className="field" style={{ margin: 0 }}>
          <span>Gold spot ($/oz)</span>
          <input
            type="number"
            step="1"
            min="0"
            value={values.goldSpotPerOz}
            onChange={(e) => set("goldSpotPerOz", Number(e.target.value) || 0)}
          />
        </label>

        <label className="field" style={{ margin: 0 }}>
          <span>Platinum spot ($/oz)</span>
          <input
            type="number"
            step="1"
            min="0"
            value={values.platinumSpotPerOz}
            onChange={(e) => set("platinumSpotPerOz", Number(e.target.value) || 0)}
          />
        </label>

        <label className="field" style={{ margin: 0 }}>
          <span>Silver spot ($/oz)</span>
          <input
            type="number"
            step="1"
            min="0"
            value={values.silverSpotPerOz}
            onChange={(e) => set("silverSpotPerOz", Number(e.target.value) || 0)}
          />
        </label>

        <label className="field" style={{ margin: 0 }}>
          <span>Center stone shape</span>
          <input
            type="text"
            value={values.centerShape}
            onChange={(e) => set("centerShape", e.target.value)}
          />
        </label>

        <label className="field" style={{ margin: 0 }}>
          <span>Center stone (ct)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={values.centerDiamondCarats}
            onChange={(e) => set("centerDiamondCarats", Number(e.target.value) || 0)}
          />
        </label>

        <label className="field" style={{ margin: 0 }}>
          <span>Side stones (qty)</span>
          <input
            type="number"
            step="1"
            min="0"
            value={values.sideDiamondQuantity}
            onChange={(e) => set("sideDiamondQuantity", Math.max(0, Math.round(Number(e.target.value) || 0)))}
          />
        </label>

        <label className="field" style={{ margin: 0 }}>
          <span>Side stones (ct total)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={values.sideDiamondCarats}
            onChange={(e) => set("sideDiamondCarats", Number(e.target.value) || 0)}
          />
        </label>

        <label className="field" style={{ margin: 0 }}>
          <span>Side stone shape</span>
          <input
            type="text"
            value={values.sideStoneShape}
            onChange={(e) => set("sideStoneShape", e.target.value)}
            placeholder="round or fancy"
          />
        </label>

        <label className="field" style={{ margin: 0 }}>
          <span>Setting type</span>
          <input
            type="text"
            value={values.settingType}
            onChange={(e) => set("settingType", e.target.value)}
          />
        </label>

        <label className="field" style={{ margin: 0 }}>
          <span>Pricing tier</span>
          <select
            value={values.pricingTier}
            onChange={(e) => set("pricingTier", e.target.value as PricingTier)}
          >
            {PRICING_TIERS.map((tier) => (
              <option key={tier} value={tier}>{getPricingTierLabel(tier)}</option>
            ))}
          </select>
        </label>

        <label className="field" style={{ margin: 0 }}>
          <span>Jeweler margin (%)</span>
          <input
            type="number"
            step="1"
            min="0"
            max="200"
            value={values.customerMarginPct}
            onChange={(e) => set("customerMarginPct", Number(e.target.value) || 0)}
          />
        </label>

        <label className="field" style={{ margin: 0 }}>
          <span>CAD design fee ($)</span>
          <input
            type="number"
            step="1"
            min="0"
            value={values.cadCost}
            onChange={(e) => set("cadCost", Number(e.target.value) || 0)}
          />
        </label>

        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={values.hasWeddingBand}
              onChange={(e) => set("hasWeddingBand", e.target.checked)}
            />
            Wedding band (2 pieces)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={values.isTwoTone}
              onChange={(e) => set("isTwoTone", e.target.checked)}
            />
            Two-tone
          </label>
        </div>
      </div>

      {isDirty && !error && (
        <p className="muted small" style={{ marginTop: 12, color: "#b45309" }}>
          ✎ Showing a hypothetical price based on your edits above, not the original saved values.
        </p>
      )}

      {error && (
        <p className="muted small" style={{ color: "#ef4444", marginTop: 12 }}>
          {error}
        </p>
      )}

      {breakdown && (
        <div style={{ marginTop: "1.5rem" }}>
          <QuotePricingKpis
            breakdown={breakdown}
            pricingTier={values.pricingTier}
            tierDivisor={breakdown.tierDivisor}
            makingPrice={breakdown.makingPrice}
            sellingPrice={breakdown.estimatedSellingPrice}
          />
        </div>
      )}

      {breakdown && (
        <div style={{ marginTop: "1.25rem" }}>
          <QuotePricingBreakdown
            breakdown={breakdown}
            computedMetalCost={breakdown.metalCost}
            goldSpot={values.goldSpotPerOz}
            metalType={values.metalType}
            metalWeightGrams={values.metalWeightGrams}
            centerDiamondCarats={values.centerDiamondCarats}
            centerShape={values.centerShape}
            sideDiamondQuantity={values.sideDiamondQuantity}
            sideDiamondCarats={values.sideDiamondCarats}
            settingType={values.settingType}
            colorClarity="E VS1"
            pricingTier={values.pricingTier}
            tierDivisor={breakdown.tierDivisor}
            makingPrice={breakdown.makingPrice}
            sellingPrice={breakdown.estimatedSellingPrice}
          />
        </div>
      )}
    </div>
  );
}
