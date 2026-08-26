"use client";

import { useMemo, useState } from "react";
import { useToast } from "@/components/toast-provider";

interface PricingMarginSimulatorProps {
  initialMarginPct: number;
  goldSpotPerOz: number;
  platinumSpotPerOz?: number;
  silverSpotPerOz?: number;
  canEdit: boolean;
}

function formatUsd(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(amount);
}

function formatUsdExact(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

const PRESET_MARGINS = [
  { label: "50% (Default)", value: 50 },
  { label: "75%", value: 75 },
  { label: "100%", value: 100 },
  { label: "200%", value: 200 },
  { label: "300%", value: 300 },
  { label: "400%", value: 400 },
  { label: "500%", value: 500 }
];

export default function PricingMarginSimulator({
  initialMarginPct,
  goldSpotPerOz,
  platinumSpotPerOz = 985.2,
  silverSpotPerOz = 31.4,
  canEdit
}: PricingMarginSimulatorProps) {
  const [marginPct, setMarginPct] = useState(Math.max(50, initialMarginPct));
  const [customGoldSpot, setCustomGoldSpot] = useState(goldSpotPerOz);
  const [customPlatSpot, setCustomPlatSpot] = useState(platinumSpotPerOz);
  const [customSilverSpot, setCustomSilverSpot] = useState(silverSpotPerOz);
  const [saving, setSaving] = useState(false);
  const [savingSpots, setSavingSpots] = useState(false);
  const { showToast } = useToast();

  // Sample Ring Specifications: 14K White Gold 2.0ct Oval Solitaire (6.5g metal)
  const sampleRing = useMemo(() => {
    const metalWeightGrams = 6.5;
    const goldPurityMultiplier = 14 / 24; // 14K
    const castingLossMultiplier = 1.25; // 25% casting wastage
    const goldPerGram = (customGoldSpot / 31.1034768) * goldPurityMultiplier;
    const metalCost = metalWeightGrams * goldPerGram * castingLossMultiplier;
    const centerStoneCost = 520; // 2.0ct Lab Grown Oval E VS1
    const settingLaborCost = 75; // 4-prong diamond setting
    const cadCharge = 110; // CAD model & CAM prep

    const baseProductionCost = metalCost + centerStoneCost + settingLaborCost + cadCharge;
    const markupAmount = baseProductionCost * (marginPct / 100);
    const retailSellingPrice = baseProductionCost + markupAmount;
    const netProfit = markupAmount;

    return {
      metalWeightGrams,
      metalCost,
      centerStoneCost,
      settingLaborCost,
      cadCharge,
      baseProductionCost,
      markupAmount,
      retailSellingPrice,
      netProfit
    };
  }, [marginPct, customGoldSpot]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || saving) return;

    setSaving(true);
    try {
      const response = await fetch("/api/settings/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerMarginPct: marginPct })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update margin.");
      }

      showToast({
        message: `Store margin successfully saved to ${marginPct}%!`,
        variant: "success",
        autoDismiss: true
      });
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Error saving margin.",
        variant: "error",
        autoDismiss: false
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveManualSpotRates(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || savingSpots) return;

    setSavingSpots(true);
    try {
      const response = await fetch("/api/settings/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goldSpotPerOz: customGoldSpot,
          platinumSpotPerOz: customPlatSpot,
          silverSpotPerOz: customSilverSpot
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update manual spot rates.");
      }

      showToast({
        message: "Manual metal spot prices saved successfully!",
        variant: "success",
        autoDismiss: true
      });
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Error saving spot rates.",
        variant: "error",
        autoDismiss: false
      });
    } finally {
      setSavingSpots(false);
    }
  }

  return (
    <div className="stack" style={{ gap: "var(--space-6)" }}>
      {/* ── Manual Spot Prices Override Card ── */}
      <section className="card">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow" style={{ color: "#b45309" }}>Manual Spot Rates Fallback</span>
            <h2>Custom Metal Spot Pricing</h2>
            <p className="muted">
              If live market APIs are unavailable or you prefer custom spot rates with your casting supplier, enter manual spot rates per troy ounce below.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveManualSpotRates} className="stack" style={{ gap: "var(--space-4)" }}>
          <div className="grid threeUp" style={{ gap: 16 }}>
            <div className="field">
              <label htmlFor="goldSpotInput" style={{ fontWeight: 600 }}>
                Gold Spot ($ / troy oz)
              </label>
              <div className="inputUnitRow">
                <span className="unitBadge">$</span>
                <input
                  id="goldSpotInput"
                  type="number"
                  step="0.01"
                  min="100"
                  value={customGoldSpot}
                  onChange={(e) => setCustomGoldSpot(Number(e.target.value) || 0)}
                  disabled={!canEdit}
                  style={{ fontWeight: 600 }}
                />
              </div>
              <span className="muted small">14K: ~{formatUsdExact((customGoldSpot / 31.1034768) * (14 / 24))}/g</span>
            </div>

            <div className="field">
              <label htmlFor="platSpotInput" style={{ fontWeight: 600 }}>
                Platinum Spot ($ / troy oz)
              </label>
              <div className="inputUnitRow">
                <span className="unitBadge">$</span>
                <input
                  id="platSpotInput"
                  type="number"
                  step="0.01"
                  min="100"
                  value={customPlatSpot}
                  onChange={(e) => setCustomPlatSpot(Number(e.target.value) || 0)}
                  disabled={!canEdit}
                  style={{ fontWeight: 600 }}
                />
              </div>
              <span className="muted small">950 Plat: ~{formatUsdExact((customPlatSpot / 31.1034768) * 0.95)}/g</span>
            </div>

            <div className="field">
              <label htmlFor="silverSpotInput" style={{ fontWeight: 600 }}>
                Silver Spot ($ / troy oz)
              </label>
              <div className="inputUnitRow">
                <span className="unitBadge">$</span>
                <input
                  id="silverSpotInput"
                  type="number"
                  step="0.01"
                  min="1"
                  value={customSilverSpot}
                  onChange={(e) => setCustomSilverSpot(Number(e.target.value) || 0)}
                  disabled={!canEdit}
                  style={{ fontWeight: 600 }}
                />
              </div>
              <span className="muted small">925 Silver: ~{formatUsdExact((customSilverSpot / 31.1034768) * 0.925)}/g</span>
            </div>
          </div>

          {canEdit ? (
            <button
              className="button secondary button--md fitContent"
              type="submit"
              disabled={savingSpots}
            >
              {savingSpots ? "Saving Spot Rates…" : "Save Custom Spot Rates"}
            </button>
          ) : null}
        </form>
      </section>

      {/* ── Margin Input & Presets ── */}
      <section className="card">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow">Retail Pricing Policy</span>
            <h2>Store Margin &amp; Markup</h2>
            <p className="muted">
              Configure your default profit margin markup. This percentage is added to wholesale manufacturing casting + stones before customer presentation.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="stack" style={{ gap: "var(--space-4)" }}>
          <div className="field">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label htmlFor="marginInput" style={{ fontWeight: 600 }}>
                Default Retail Margin Markup:
              </label>
              <span className="badge" style={{ fontSize: "1.1rem", padding: "4px 12px", background: "rgba(2, 132, 199, 0.12)", color: "var(--color-primary, #0284c7)", fontWeight: 700 }}>
                {marginPct}%
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <input
                id="marginRange"
                type="range"
                min={50}
                max={500}
                step={5}
                value={marginPct}
                onChange={(e) => setMarginPct(Number(e.target.value))}
                disabled={!canEdit}
                style={{ flex: 1, accentColor: "var(--color-primary, #0284c7)", cursor: canEdit ? "pointer" : "not-allowed" }}
              />
              <div className="inputUnitRow" style={{ width: 130 }}>
                <input
                  id="marginInput"
                  type="number"
                  min={50}
                  max={500}
                  step={1}
                  value={marginPct}
                  onChange={(e) => setMarginPct(Math.max(50, Math.min(500, Number(e.target.value) || 50)))}
                  disabled={!canEdit}
                  className="shortInput"
                  style={{ fontSize: "1.15rem", fontWeight: "700", textAlign: "center" }}
                />
                <span className="unitBadge" style={{ fontWeight: "700" }}>%</span>
              </div>
            </div>

            {/* Quick preset pills */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {PRESET_MARGINS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setMarginPct(preset.value)}
                  disabled={!canEdit}
                  className="button secondary button--sm"
                  style={{
                    borderRadius: 999,
                    borderColor: marginPct === preset.value ? "var(--color-primary, #0284c7)" : undefined,
                    background: marginPct === preset.value ? "rgba(2, 132, 199, 0.12)" : undefined,
                    color: marginPct === preset.value ? "var(--color-primary, #0284c7)" : undefined,
                    fontWeight: marginPct === preset.value ? 700 : 500
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {canEdit ? (
            <button
              className="button primary button--lg fitContent"
              type="submit"
              disabled={saving}
              style={{ marginTop: "var(--space-2)" }}
            >
              {saving ? (
                <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>hourglass_top</span> Saving Configuration…</>
              ) : (
                <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span> Save Margin Configuration</>
              )}
            </button>
          ) : (
            <p className="muted small">Only company owners and administrators can change pricing margin settings.</p>
          )}
        </form>
      </section>

      {/* ── LIVE INTERACTIVE SAMPLE QUOTE PREVIEW ── */}
      <section className="card" style={{ background: "linear-gradient(145deg, var(--color-surface), rgba(2, 132, 199, 0.03))", borderColor: "rgba(2, 132, 199, 0.25)" }}>
        <div className="sectionHeader">
          <div>
            <span className="eyebrow" style={{ color: "var(--color-primary, #0284c7)" }}>✦ Real-Time Margin Simulator</span>
            <h2>Sample Quote Breakdown</h2>
            <p className="muted">
              Live simulation showing how your <strong>{marginPct}% markup</strong> affects wholesale production costs, retail presentation price, and net profit.
            </p>
          </div>
          <div className="badge" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10b981", padding: "6px 14px", fontWeight: 700 }}>
            +{marginPct}% Applied
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24, marginTop: 16 }}>
          {/* Left Column: Sample Ring Spec & Wholesale Costs */}
          <div style={{ padding: 20, borderRadius: 12, background: "rgba(0, 0, 0, 0.02)", border: "1px solid var(--color-outline-variant)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span className="material-symbols-outlined" style={{ color: "var(--color-primary, #0284c7)", fontSize: 24 }}>diamond</span>
              <div>
                <strong style={{ fontSize: "1.05rem" }}>14K White Gold Solitaire</strong>
                <p className="muted small" style={{ margin: 0 }}>2.0ct Oval Lab Diamond · 6.5g Gold</p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.9rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">14K Gold Casting (6.5g + loss):</span>
                <strong>{formatUsdExact(sampleRing.metalCost)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">2.0ct Oval Center Stone:</span>
                <strong>{formatUsdExact(sampleRing.centerStoneCost)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">Setting &amp; Labor:</span>
                <strong>{formatUsdExact(sampleRing.settingLaborCost)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">CAD &amp; CAM Fee:</span>
                <strong>{formatUsdExact(sampleRing.cadCharge)}</strong>
              </div>
              <hr style={{ margin: "8px 0", borderColor: "var(--color-outline-variant)" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                <span>Wholesale Base Cost:</span>
                <span>{formatUsdExact(sampleRing.baseProductionCost)}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Markup, Retail Price & Net Profit */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 20, borderRadius: 12, background: "rgba(2, 132, 199, 0.06)", border: "1px solid rgba(2, 132, 199, 0.2)" }}>
            <div>
              <span className="eyebrow" style={{ color: "var(--color-primary, #0284c7)" }}>Customer Retail Quote</span>
              <div style={{ fontSize: "2.5rem", fontWeight: 800, fontFamily: "var(--font-display, Georgia, serif)", color: "var(--color-on-surface)", margin: "8px 0" }}>
                {formatUsd(sampleRing.retailSellingPrice)}
              </div>
              <p className="muted small" style={{ margin: 0 }}>
                Wholesale ({formatUsd(sampleRing.baseProductionCost)}) + {marginPct}% Store Markup ({formatUsd(sampleRing.markupAmount)})
              </p>
            </div>

            <div style={{ marginTop: 20, padding: 14, borderRadius: 10, background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="material-symbols-outlined" style={{ color: "#10b981", fontSize: 22 }}>payments</span>
                  <span style={{ fontWeight: 600, color: "#10b981" }}>Your Net Profit:</span>
                </div>
                <strong style={{ fontSize: "1.25rem", color: "#10b981" }}>
                  +{formatUsdExact(sampleRing.netProfit)}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
