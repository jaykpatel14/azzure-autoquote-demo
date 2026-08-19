"use client";

import { useMemo, useState } from "react";
import { useToast } from "@/components/toast-provider";

interface PricingMarginSimulatorProps {
  initialMarginPct: number;
  goldSpotPerOz: number;
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
  { label: "15% (Competitive)", value: 15 },
  { label: "25% (Standard)", value: 25 },
  { label: "35% (Custom Studio)", value: 35 },
  { label: "50% (Luxury Boutique)", value: 50 },
  { label: "75% (High Margin)", value: 75 }
];

export default function PricingMarginSimulator({
  initialMarginPct,
  goldSpotPerOz,
  canEdit
}: PricingMarginSimulatorProps) {
  const [marginPct, setMarginPct] = useState(initialMarginPct);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  // Sample Ring Specifications: 14K White Gold 2.0ct Oval Solitaire (6.5g metal)
  const sampleRing = useMemo(() => {
    const metalWeightGrams = 6.5;
    const goldPurityMultiplier = 14 / 24; // 14K
    const castingLossMultiplier = 1.25; // 25% casting wastage
    const goldPerGram = (goldSpotPerOz / 31.1034768) * goldPurityMultiplier;
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
  }, [marginPct, goldSpotPerOz]);

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

  return (
    <div className="stack" style={{ gap: "var(--space-6)" }}>
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
              <span className="badge" style={{ fontSize: "1.1rem", padding: "4px 12px", background: "rgba(201, 168, 76, 0.15)", color: "#c9a84c", fontWeight: 700 }}>
                {marginPct}%
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <input
                id="marginRange"
                type="range"
                min={0}
                max={100}
                step={1}
                value={marginPct}
                onChange={(e) => setMarginPct(Number(e.target.value))}
                disabled={!canEdit}
                style={{ flex: 1, accentColor: "var(--color-primary, #0284c7)", cursor: canEdit ? "pointer" : "not-allowed" }}
              />
              <div className="inputUnitRow" style={{ width: 120 }}>
                <input
                  id="marginInput"
                  type="number"
                  min={0}
                  max={200}
                  step={0.5}
                  value={marginPct}
                  onChange={(e) => setMarginPct(Math.max(0, Math.min(200, Number(e.target.value) || 0)))}
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
                    background: marginPct === preset.value ? "rgba(2, 132, 199, 0.1)" : undefined,
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
      <section className="card" style={{ background: "linear-gradient(145deg, var(--color-surface), rgba(201, 168, 76, 0.04))", borderColor: "rgba(201, 168, 76, 0.3)" }}>
        <div className="sectionHeader">
          <div>
            <span className="eyebrow" style={{ color: "#c9a84c" }}>✦ Real-Time Margin Simulator</span>
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
          <div style={{ padding: 20, borderRadius: 12, background: "rgba(0, 0, 0, 0.03)", border: "1px solid var(--color-outline-variant)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span className="material-symbols-outlined" style={{ color: "#c9a84c", fontSize: 24 }}>diamond</span>
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
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 20, borderRadius: 12, background: "rgba(201, 168, 76, 0.08)", border: "1px solid rgba(201, 168, 76, 0.25)" }}>
            <div>
              <span className="eyebrow" style={{ color: "#c9a84c" }}>Customer Retail Quote</span>
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
