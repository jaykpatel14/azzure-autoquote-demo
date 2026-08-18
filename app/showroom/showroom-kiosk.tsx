"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { QuoteCreationLayout, QuoteStepCard, QuoteBuilderPreview } from "@/components/QuoteCreationLayout";
import {
  calculateMakingPrice as calculateProductionCost,
  calculateTierPrice,
  DEFAULT_COLOR_CLARITY
} from "@/src/services/pricing";
import type { PricingTier } from "@prisma/client";

type Branding = { companyName: string; logoUrl: string | null; primaryColor: string | null; aboutUs: string | null };
type Pricing = { cadCost: number; customerMarginPct: number; pricingTier: PricingTier | null };
type Analysis = {
  analysisId: string;
  jewelryType: string;
  selectedMetal: string;
  metalWeightGrams: number;
  centerDiamondCarats: number;
  sideDiamondCarats: number;
  sideDiamondQuantity: number;
  centerShape?: string;
  settingType?: string;
  hasWeddingBand?: boolean;
  isTwoTone?: boolean;
};

const KIOSK_ANALYSIS_STAGES = [
  "Analysing your photo...",
  "Reading your description...",
  "Calculating pricing..."
] as const;

const METAL_OPTIONS = ["10K", "14K", "18K", "Platinum", "Silver"];

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function ShowroomKiosk({ token, branding, pricing }: { token: string; branding: Branding; pricing: Pricing }) {
  const [screen, setScreen] = useState<"home" | "builder" | "saved">("home");
  const [files, setFiles] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisIds, setAnalysisIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingProgress, setSavingProgress] = useState(0);
  const [renderingImageUrl, setRenderingImageUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState(false);

  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  const debouncedAnalysis = useDebouncedValue(analysis, 300);

  const reset = useCallback(() => {
    setScreen("home");
    setFiles([]);
    setDescription("");
    setAnalyzing(false);
    setStageIndex(0);
    setAnalysis(null);
    setAnalysisIds([]);
    setSaving(false);
    setSavingProgress(0);
    setRenderingImageUrl(null);
    setCode("");
    setPrice(null);
    setError("");
    setWarning(false);
  }, []);

  useEffect(() => {
    let warn: ReturnType<typeof setTimeout>;
    let clear: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(warn);
      clearTimeout(clear);
      setWarning(false);
      warn = setTimeout(() => setWarning(true), 80_000);
      clear = setTimeout(reset, 90_000);
    };
    arm();
    document.addEventListener("touchstart", arm);
    document.addEventListener("pointerdown", arm);
    return () => {
      clearTimeout(warn);
      clearTimeout(clear);
      document.removeEventListener("touchstart", arm);
      document.removeEventListener("pointerdown", arm);
    };
  }, [reset]);

  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  const estimatedSellingPrice = useMemo(() => {
    if (!debouncedAnalysis || !pricing.pricingTier) return 0;

    const centerCarat = Math.max(debouncedAnalysis.centerDiamondCarats, 0.0001);
    const sideStones =
      debouncedAnalysis.sideDiamondQuantity > 0 && debouncedAnalysis.sideDiamondCarats > 0
        ? [
            {
              shape: "round",
              caratWeightEach: debouncedAnalysis.sideDiamondCarats / debouncedAnalysis.sideDiamondQuantity,
              count: debouncedAnalysis.sideDiamondQuantity,
              settingType: debouncedAnalysis.settingType || "prong"
            }
          ]
        : [];

    try {
      const breakdown = calculateProductionCost({
        centerStone: { shape: debouncedAnalysis.centerShape || "round", caratWeight: centerCarat },
        sideStones,
        hasWeddingBand: Boolean(debouncedAnalysis.hasWeddingBand),
        isTwoTone: Boolean(debouncedAnalysis.isTwoTone),
        colorClarity: DEFAULT_COLOR_CLARITY,
        cadCost: pricing.cadCost,
        customerMarginPct: pricing.customerMarginPct
      });
      const totalCost = breakdown.subtotal + breakdown.customerMarginAmount;
      return calculateTierPrice(totalCost, pricing.pricingTier).estimatedSellingPrice;
    } catch {
      return 0;
    }
  }, [debouncedAnalysis, pricing]);

  function updateAnalysisField<K extends keyof Analysis>(field: K, value: Analysis[K]) {
    setAnalysis((current) => (current ? { ...current, [field]: value } : current));
  }

  async function analyse() {
    if (!files.length || analyzing) return;
    setAnalyzing(true);
    setStageIndex(0);
    setError("");
    setAnalysis(null);
    setRenderingImageUrl(null);

    const pulser = window.setInterval(() => {
      setStageIndex((current) => (current + 1) % KIOSK_ANALYSIS_STAGES.length);
    }, 800);

    try {
      const results: Analysis[] = [];
      for (const file of files) {
        const form = new FormData();
        form.set("token", token);
        form.set("image", file);
        form.set("description", description);
        const response = await fetch("/api/showroom/analyze", { method: "POST", body: form });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        results.push(body);
      }
      setAnalysisIds(results.map((r) => r.analysisId));
      setAnalysis(results[0]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      window.clearInterval(pulser);
      setAnalyzing(false);
    }
  }

  async function save() {
    if (!analysis) return;
    setError("");
    setSaving(true);
    setSavingProgress(0);

    const progressTimer = window.setInterval(() => {
      setSavingProgress((current) => Math.min(90, current + 6));
    }, 1600);

    try {
      const response = await fetch("/api/showroom/quotes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, analysisIds, customerNotes: description, ...analysis })
      });
      const body = await response.json();
      setSavingProgress(100);
      if (!response.ok) {
        setError(body.error);
        return;
      }
      setCode(body.displayCode);
      setPrice(body.estimatedSellingPrice);
      setRenderingImageUrl(body.renderingImageUrl ?? null);
      setScreen("saved");
    } finally {
      window.clearInterval(progressTimer);
      setSaving(false);
    }
  }

  return (
    <div className="showroom" style={{ "--color-brand": branding.primaryColor || "#c9a84c" } as React.CSSProperties}>
      <header className="showroomBrand">
        {branding.logoUrl ? <img src={branding.logoUrl} alt={branding.companyName} /> : <strong>{branding.companyName}</strong>}
      </header>

      {screen === "home" ? (
        <section className="showroomPanel">
          <p className="showroomEyebrow">Welcome to {branding.companyName}</p>
          <h1>Design Your Dream Ring</h1>
          <p>Upload a photo of the piece you love. We’ll give you an instant quote.</p>
          <button className="showroomButton" type="button" onClick={() => setScreen("builder")}>
            Start →
          </button>
          <p className="showroomSmall">Already have a quote code? Please show it to a team member.</p>
        </section>
      ) : null}

      {screen === "builder" ? (
        <section className="showroomStage">
          <button className="showroomBack" type="button" onClick={reset}>← Start over</button>
          <QuoteCreationLayout
            steps={
              <>
                <QuoteStepCard
                  number="01"
                  title="Show us what you love"
                  description="Upload a reference photo and tell us about the design."
                >
                  <div className="field quoteDesignDescription">
                    <div className="charCountHeader">
                      <label htmlFor="showroomDescription">Describe the requested design <span className="muted small" style={{ fontWeight: 400 }}>(Optional)</span></label>
                      <span className="charCountBadge">{description.length} / 1000</span>
                    </div>
                    <textarea
                      id="showroomDescription"
                      rows={3}
                      maxLength={1000}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Describe the piece, stone preferences, sizing, engravings, or changes you want..."
                    />
                  </div>

                  <div className="dropzone dropzone--multi">
                    <div className="dropzoneContent">
                      <div className="dropzoneIcon">
                        <span className="material-symbols-outlined" style={{ fontSize: 28, color: "var(--color-primary)" }}>cloud_upload</span>
                      </div>
                      <strong>Tap to upload photos</strong>
                      <span className="muted small">JPG, PNG, or WEBP · up to 3 photos</span>
                    </div>
                    <div className="dropzoneActions">
                      <label className="button primary button--sm">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 3))}
                        />
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>folder_open</span>
                        Choose photos
                      </label>
                    </div>
                  </div>

                  {previews.length > 0 ? (
                    <div className="facetThumbRail" aria-label="Uploaded photos">
                      {previews.map((src, index) => (
                        <div key={src} className="facetThumb">
                          <img src={src} alt={`Reference ${index + 1}`} className="facetThumbImage" />
                          <span className="facetThumbBadge">#{index + 1}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {error ? <p className="fieldError">{error}</p> : null}

                  <button
                    className="button primary"
                    style={{ marginTop: 16 }}
                    type="button"
                    disabled={!files.length || analyzing}
                    onClick={analyse}
                  >
                    {analyzing ? "Analysing…" : "Analyse my design →"}
                  </button>
                </QuoteStepCard>

                {analyzing || analysis ? (
                  <QuoteStepCard
                    number="02"
                    title="What our AI sees"
                    description="What the AI identified from your photo and description."
                  >
                    {analyzing ? (
                      <div className="facetProgressList">
                        {KIOSK_ANALYSIS_STAGES.map((stage, index) => (
                          <div key={stage} className={index <= stageIndex ? "facetProgressRow isActive" : "facetProgressRow"}>
                            <span className="facetProgressDot" aria-hidden="true" />
                            <span>{stage}</span>
                          </div>
                        ))}
                      </div>
                    ) : analysis ? (
                      <div className="facetResolvedGrid">
                        <label className="facetResolvedField">
                          <span>Jewelry type</span>
                          <input value={analysis.jewelryType} readOnly disabled className="facetReadOnlyInput" />
                        </label>
                        <label className="facetResolvedField">
                          <span>Metal</span>
                          <input value={analysis.selectedMetal} readOnly disabled className="facetReadOnlyInput" />
                        </label>
                        <label className="facetResolvedField">
                          <span>Center shape</span>
                          <input value={analysis.centerShape ?? ""} readOnly disabled className="facetReadOnlyInput" />
                        </label>
                        <label className="facetResolvedField">
                          <span>Metal weight (g)</span>
                          <input value={analysis.metalWeightGrams} readOnly disabled className="facetReadOnlyInput" />
                        </label>
                        <label className="facetResolvedField">
                          <span>Center stone (ct)</span>
                          <input value={analysis.centerDiamondCarats} readOnly disabled className="facetReadOnlyInput" />
                        </label>
                        <label className="facetResolvedField">
                          <span>Side stones (ct)</span>
                          <input value={analysis.sideDiamondCarats} readOnly disabled className="facetReadOnlyInput" />
                        </label>
                      </div>
                    ) : null}
                  </QuoteStepCard>
                ) : null}

                {analysis ? (
                  <QuoteStepCard
                    number="03"
                    title="Adjust your ring"
                    description="Tweak any value — your price updates automatically."
                  >
                    <div className="facetResolvedGrid">
                      <label className="facetResolvedField">
                        <span>Metal</span>
                        <select
                          value={analysis.selectedMetal}
                          onChange={(event) => updateAnalysisField("selectedMetal", event.target.value)}
                        >
                          {METAL_OPTIONS.map((metal) => (
                            <option key={metal} value={metal}>{metal}</option>
                          ))}
                        </select>
                      </label>
                      <label className="facetResolvedField">
                        <span>Center shape</span>
                        <input
                          value={analysis.centerShape ?? ""}
                          onChange={(event) => updateAnalysisField("centerShape", event.target.value)}
                          placeholder="e.g. Oval, Round"
                        />
                      </label>
                      <label className="facetResolvedField">
                        <span>Center stone (ct)</span>
                        <input
                          type="number" min={0} step={0.01}
                          value={analysis.centerDiamondCarats}
                          onChange={(event) => updateAnalysisField("centerDiamondCarats", Number(event.target.value) || 0)}
                        />
                      </label>
                      <label className="facetResolvedField">
                        <span>Side stones (ct)</span>
                        <input
                          type="number" min={0} step={0.01}
                          value={analysis.sideDiamondCarats}
                          onChange={(event) => updateAnalysisField("sideDiamondCarats", Number(event.target.value) || 0)}
                        />
                      </label>
                      <label className="facetResolvedField">
                        <span>Side stone qty</span>
                        <input
                          type="number" min={0} step={1}
                          value={analysis.sideDiamondQuantity}
                          onChange={(event) => updateAnalysisField("sideDiamondQuantity", Number(event.target.value) || 0)}
                        />
                      </label>
                      <label className="facetResolvedField">
                        <span>Setting type</span>
                        <input
                          value={analysis.settingType ?? ""}
                          onChange={(event) => updateAnalysisField("settingType", event.target.value)}
                          placeholder="e.g. Prong, Bezel"
                        />
                      </label>
                      <div className="facetCheckboxGroup facetFullWidth">
                        <label className="facetCheckboxLabel">
                          <input
                            type="checkbox"
                            checked={analysis.hasWeddingBand ?? false}
                            onChange={(event) => updateAnalysisField("hasWeddingBand", event.target.checked)}
                          />
                          <span>Ring + wedding band (2 pieces)</span>
                        </label>
                        <label className="facetCheckboxLabel">
                          <input
                            type="checkbox"
                            checked={analysis.isTwoTone ?? false}
                            onChange={(event) => updateAnalysisField("isTwoTone", event.target.checked)}
                          />
                          <span>Two-tone gold</span>
                        </label>
                      </div>
                    </div>
                  </QuoteStepCard>
                ) : null}
              </>
            }
            preview={
              <QuoteBuilderPreview>
                <div className="quotePreviewHeader">
                  <span className="quoteStepNumber">04</span>
                  <div>
                    <p className="eyebrow">AI visualization &amp; quote</p>
                    <p className="muted small">Updates automatically as you adjust the design.</p>
                  </div>
                </div>

                <div className="quotePreviewImageFrame">
                  {renderingImageUrl || previews[0] ? (
                    <img
                      src={renderingImageUrl ?? previews[0]}
                      alt="AI generated jewelry visualization"
                      className="quotePreviewImage"
                    />
                  ) : (
                    <div className="quotePreviewImagePlaceholder">
                      <span className="material-symbols-outlined" style={{ fontSize: 40, color: "var(--color-outline-variant)" }}>diamond</span>
                      <p className="muted small" style={{ margin: "8px 0 0", textAlign: "center" }}>Upload a photo to see your design here</p>
                    </div>
                  )}
                  {analyzing ? (
                    <div className="quotePreviewProcessingOverlay">
                      <span className="material-symbols-outlined ai-pulse" style={{ fontSize: 32, color: "white" }}>psychology</span>
                      <span style={{ color: "white", fontSize: "var(--text-sm)", fontWeight: 600, marginTop: 8 }}>AI Analysing…</span>
                    </div>
                  ) : null}
                  {saving ? (
                    <div className="quotePreviewProcessingOverlay">
                      <span className="material-symbols-outlined ai-pulse" style={{ fontSize: 32, color: "white" }}>diamond</span>
                      <span style={{ color: "white", fontSize: "var(--text-sm)", fontWeight: 600, marginTop: 8 }}>Creating your ring…</span>
                      <div style={{ width: "70%", height: 6, borderRadius: 999, background: "rgb(255 255 255 / 25%)", overflow: "hidden", marginTop: 10 }}>
                        <div style={{ height: "100%", width: `${savingProgress}%`, background: "white", transition: "width 400ms linear" }} />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="quotePreviewPriceBlock">
                  <p className="eyebrow" style={{ marginBottom: 4 }}>Quote price</p>
                  <div className="quotePrice" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>
                    {analysis
                      ? new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(estimatedSellingPrice)
                      : "—"}
                  </div>
                  <p className="muted small" style={{ marginTop: 4 }}>
                    {analysis ? "Updates as you adjust the design." : "Upload a photo to get started."}
                  </p>
                </div>

                <div className="quotePreviewActions">
                  <button
                    className="button primary"
                    style={{ width: "100%" }}
                    type="button"
                    disabled={!analysis || saving}
                    onClick={save}
                  >
                    {saving ? (
                      <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>hourglass_top</span> Saving…</>
                    ) : (
                      <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span> Save Quote</>
                    )}
                  </button>
                </div>
              </QuoteBuilderPreview>
            }
          />
        </section>
      ) : null}

      {screen === "saved" ? (
        <section className="showroomPanel">
          <p className="showroomSuccess">✓ Quote saved</p>
          <h1>Your quote code</h1>
          <div className="showroomCode">{code}</div>
          {price !== null ? (
            <p className="showroomPrice">
              Estimated price {new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(price)}
            </p>
          ) : null}
          <p>Tell this code to a team member to continue your design.</p>
          <button className="showroomButton" type="button" onClick={reset}>Start a new design</button>
        </section>
      ) : null}

      {warning ? <div className="showroomWarning">Still there? This screen will reset in 10 seconds.</div> : null}
      <footer>Powered by EveryFacets</footer>
    </div>
  );
}
