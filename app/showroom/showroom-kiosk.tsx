"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { QuoteCreationLayout, QuoteStepCard, QuoteBuilderPreview } from "@/components/QuoteCreationLayout";
import {
  calculateMakingPrice as calculateProductionCost,
  calculateTierPrice,
  DEFAULT_COLOR_CLARITY
} from "@/src/services/pricing";
import { convertMetalWeight, type MetalType } from "@/lib/pricing";
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
  "Analysing metal & piece composition...",
  "Estimating diamond specs & settings...",
  "Calculating weight..."
] as const;

const METAL_OPTIONS = ["10K", "14K", "18K", "Platinum", "Silver"];

const SHOWROOM_PRESETS = [
  {
    icon: "diamond",
    title: "2.5ct Pear Halo Solitaire",
    description: "14K White Gold with hidden pavé halo & micro-prong diamond shank.",
    prompt: "2.5ct Pear cut diamond ring with hidden halo in 14K White Gold, micro-prong band",
    metal: "14K",
    metalWeight: 5.5,
    centerCarat: 2.5,
    sideCarat: 0.65,
    sideQty: 28,
    shape: "Pear"
  },
  {
    icon: "auto_awesome",
    title: "3.0ct Oval Hidden Halo",
    description: "18K Yellow Gold with delicate 1.8mm plain band and cathedral prongs.",
    prompt: "3.0ct Oval solitaire engagement ring in 18K Yellow Gold with hidden diamond halo",
    metal: "18K",
    metalWeight: 6.2,
    centerCarat: 3.0,
    sideCarat: 0.25,
    sideQty: 16,
    shape: "Oval"
  },
  {
    icon: "view_in_ar",
    title: "2.0ct Emerald Cut 3-Stone",
    description: "Platinum with tapered trapezoid side diamonds & bezel accents.",
    prompt: "2.0ct Emerald cut diamond with tapered baguette side stones in solid Platinum",
    metal: "Platinum",
    metalWeight: 8.5,
    centerCarat: 2.0,
    sideCarat: 0.8,
    sideQty: 2,
    shape: "Emerald"
  },
  {
    icon: "stars",
    title: "1.5ct Cushion Pavé Split",
    description: "14K Rose Gold with double split pavé diamond band.",
    prompt: "1.5ct Cushion cut solitaire with split diamond pavé shank in 14K Rose Gold",
    metal: "14K",
    metalWeight: 6.8,
    centerCarat: 1.5,
    sideCarat: 1.1,
    sideQty: 36,
    shape: "Cushion"
  }
];

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function ShowroomKiosk({ token, branding, pricing }: { token: string; branding: Branding; pricing: Pricing }) {
  const [started, setStarted] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisIds, setAnalysisIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingProgress, setSavingProgress] = useState(0);
  const [renderingImageUrl, setRenderingImageUrl] = useState<string | null>(null);
  const [generatingConcept, setGeneratingConcept] = useState(false);
  const [code, setCode] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState(false);
  const [saved, setSaved] = useState(false);

  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  const debouncedAnalysis = useDebouncedValue(analysis, 300);

  const reset = useCallback(() => {
    setStarted(false);
    setFiles([]);
    setDescription("");
    setAnalyzing(false);
    setStageIndex(0);
    setAnalysis(null);
    setAnalysisIds([]);
    setSaving(false);
    setSavingProgress(0);
    setRenderingImageUrl(null);
    setGeneratingConcept(false);
    setCode("");
    setPrice(null);
    setError("");
    setWarning(false);
    setSaved(false);
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
        metalType: debouncedAnalysis.selectedMetal || "14K",
        metalWeightGrams: debouncedAnalysis.metalWeightGrams || 6,
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
    setAnalysis((current) => {
      if (!current) return current;
      if (field === "selectedMetal") {
        const fromMetal = (current.selectedMetal as MetalType) || "14K";
        const toMetal = (value as MetalType) || "14K";
        const newWeight = Number(convertMetalWeight(current.metalWeightGrams, fromMetal, toMetal).toFixed(2));
        return {
          ...current,
          selectedMetal: value as string,
          metalWeightGrams: newWeight
        };
      }
      return { ...current, [field]: value };
    });
  }

  function selectPreset(preset: (typeof SHOWROOM_PRESETS)[number]) {
    setDescription(preset.prompt);
    setAnalysis({
      analysisId: `preset-${Date.now()}`,
      jewelryType: "Ring",
      selectedMetal: preset.metal,
      metalWeightGrams: preset.metalWeight,
      centerDiamondCarats: preset.centerCarat,
      sideDiamondCarats: preset.sideCarat,
      sideDiamondQuantity: preset.sideQty,
      centerShape: preset.shape,
      settingType: "prong",
      hasWeddingBand: false,
      isTwoTone: false
    });
    setStarted(true);
  }

  // Auto-analyze function triggered immediately when photos are selected
  async function runAutoAnalysis(selectedFiles: File[]) {
    if (!selectedFiles.length || analyzing) return;

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
      for (const file of selectedFiles) {
        const form = new FormData();
        form.set("token", token);
        form.set("image", file);
        form.set("description", description);
        const response = await fetch("/api/showroom/analyze", { method: "POST", body: form });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Analysis failed.");
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

  // AI 3D Concept Generation from Description Prompt
  async function generateAiConcept() {
    if (!description.trim()) {
      setError("Please type a design description to generate an AI concept render.");
      return;
    }

    setGeneratingConcept(true);
    setError("");

    try {
      const response = await fetch("/api/concept/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: description,
          metalType: analysis?.selectedMetal || "14K"
        })
      });

      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "AI concept generation failed.");

      setRenderingImageUrl(body.imageDataUrl || null);
      if (!analysis) {
        setAnalysis({
          analysisId: body.analysisId || `concept-${Date.now()}`,
          jewelryType: body.jewelryType || "Ring",
          selectedMetal: "14K",
          metalWeightGrams: body.metalWeightGrams || 6.5,
          centerDiamondCarats: body.centerDiamondCarats || 2.0,
          sideDiamondCarats: body.sideDiamondCarats || 0.75,
          sideDiamondQuantity: body.sideDiamondQuantity || 24,
          centerShape: body.centerShape || "pear",
          settingType: body.settingType || "prong",
          hasWeddingBand: false,
          isTwoTone: false
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate AI concept.");
    } finally {
      setGeneratingConcept(false);
    }
  }

  function handleFileSelect(newFiles: File[]) {
    if (!newFiles.length) return;
    setFiles(newFiles);
    setStarted(true);
    runAutoAnalysis(newFiles);
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
        body: JSON.stringify({
          token,
          analysisIds,
          customerNotes: description,
          ...analysis,
          metalType: analysis.selectedMetal,
          selectedMetal: analysis.selectedMetal
        })
      });
      const body = await response.json();
      setSavingProgress(100);
      if (!response.ok) {
        setError(body.error || "Failed to save quote.");
        return;
      }
      setCode(body.displayCode);
      setPrice(body.estimatedSellingPrice);
      if (body.renderingImageUrl) {
        setRenderingImageUrl(body.renderingImageUrl);
      }
      setSaved(true);
    } finally {
      window.clearInterval(progressTimer);
      setSaving(false);
    }
  }

  const activeImage = renderingImageUrl || previews[0];

  return (
    <div className="showroom" style={{ "--color-brand": branding.primaryColor || "#0284c7" } as React.CSSProperties}>
      <header className="showroomBrand">
        <div>
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.companyName} />
          ) : (
            <strong>{branding.companyName}</strong>
          )}
        </div>
        {saved ? (
          <button className="showroomBack" type="button" onClick={reset}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
            New Quote
          </button>
        ) : started ? (
          <button className="showroomBack" type="button" onClick={reset}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
            Start Over
          </button>
        ) : null}
      </header>

      {/* ── 1. SAVED SCREEN: Claim Code Display with AI Generated Rendering ── */}
      {saved ? (
        <section className="showroomPanel">
          <div className="showroomSuccessCard">
            {renderingImageUrl ? (
              <div style={{ marginBottom: 20 }}>
                <img
                  src={renderingImageUrl}
                  alt="Photorealistic AI Generated Jewelry Render"
                  style={{ width: "100%", maxHeight: 320, objectFit: "contain", borderRadius: 16 }}
                />
                <span className="badge" style={{ background: "rgba(201, 168, 76, 0.15)", color: "#e6cb78", marginTop: 8, display: "inline-block" }}>
                  ✦ Photorealistic AI 3D Render
                </span>
              </div>
            ) : (
              <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--color-brand)" }}>verified</span>
            )}
            <h1 style={{ fontFamily: "var(--font-display, Georgia, serif)", fontSize: "2.25rem", margin: "16px 0 8px" }}>Quote Saved</h1>
            <div className="showroomCode">{code}</div>
            {price !== null ? (
              <p className="showroomPrice">
                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price)}
              </p>
            ) : null}
            <p className="muted" style={{ margin: "16px 0 0", fontSize: 16, lineHeight: 1.5, color: "#cbd5e1" }}>
              Show this code to your jeweler. They can see your design, adjust anything you want, and place the order.
            </p>
            <button className="showroomButton" type="button" onClick={reset} style={{ marginTop: 28, width: "auto", padding: "0 40px" }}>
              Done
            </button>
          </div>
        </section>
      ) : !started ? (
        /* ── 2. WELCOME / STANDBY SCREEN: Trust Before Touch & 1-Tap Start ── */
        <section className="showroomPanel">
          <p className="showroomEyebrow">Instant Custom Jewelry Pricing</p>
          <h1 className="showroomHeroTitle">
            Bring Your Dream Ring to Life in <em>30 Seconds</em>
          </h1>
          <p className="showroomSubtext">
            Upload an inspiration photo or pick a style below to see a photorealistic 3D visualization and an instant live price estimate.
          </p>

          <button
            className="showroomButton"
            type="button"
            onClick={() => setStarted(true)}
            style={{ marginBottom: 40 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>auto_awesome</span>
            Design Your Custom Ring
          </button>

          <div className="showroomPresetGrid">
            {SHOWROOM_PRESETS.map((preset) => (
              <div
                key={preset.title}
                className="showroomPresetCard"
                role="button"
                tabIndex={0}
                onClick={() => selectPreset(preset)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") selectPreset(preset);
                }}
              >
                <div className="showroomPresetIcon">
                  <span className="material-symbols-outlined">{preset.icon}</span>
                </div>
                <strong>{preset.title}</strong>
                <p>{preset.description}</p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        /* ── 3. WORKSPACE SCREEN: 3-Step Layout + Photorealistic AI Render ── */
        <section className="showroomStage">
          <QuoteCreationLayout
            steps={
              <>
                <QuoteStepCard
                  number="01"
                  title="Show us what you love"
                  description="Upload a reference photo or describe your custom design for an instant AI concept."
                >
                  <div className="field quoteDesignDescription">
                    <div className="charCountHeader">
                      <label htmlFor="showroomDescription">
                        DESCRIBE THE REQUESTED DESIGN <span className="muted small" style={{ fontWeight: 400 }}>(OPTIONAL)</span>
                      </label>
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
                    {description.trim() ? (
                      <button
                        className="button secondary button--sm"
                        style={{ marginTop: 10, alignSelf: "flex-start" }}
                        type="button"
                        disabled={generatingConcept}
                        onClick={generateAiConcept}
                      >
                        {generatingConcept ? (
                          <><span className="material-symbols-outlined ai-pulse" style={{ fontSize: 16 }}>auto_awesome</span> Generating AI Concept Render…</>
                        ) : (
                          <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span> Generate AI 3D Concept Render</>
                        )}
                      </button>
                    ) : null}
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
                          onChange={(event) => {
                            const selected = Array.from(event.target.files || []).slice(0, 3);
                            if (selected.length) {
                              handleFileSelect(selected);
                            }
                          }}
                        />
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>folder_open</span>
                        Choose photos
                      </label>
                    </div>
                  </div>

                  {previews.length > 0 ? (
                    <div className="facetThumbRail" aria-label="Uploaded photos" style={{ marginTop: 16 }}>
                      {previews.map((src, index) => (
                        <div key={src} className="facetThumb">
                          <img src={src} alt={`Reference ${index + 1}`} className="facetThumbImage" />
                          <span className="facetThumbBadge">#{index + 1}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {error ? <p className="fieldError" style={{ color: "#ef4444", marginTop: 12 }}>{error}</p> : null}
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
                          placeholder="e.g. Oval, Pear, Round"
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
                  {activeImage ? (
                    <img
                      src={activeImage}
                      alt="AI generated or reference photo"
                      className="quotePreviewImage"
                    />
                  ) : (
                    <div className="quotePreviewImagePlaceholder">
                      <span className="material-symbols-outlined" style={{ fontSize: 40, color: "var(--color-outline-variant)" }}>diamond</span>
                      <p className="muted small" style={{ margin: "8px 0 0", textAlign: "center" }}>Upload a photo or generate an AI concept</p>
                    </div>
                  )}
                  {analyzing ? (
                    <div className="quotePreviewProcessingOverlay">
                      <span className="material-symbols-outlined ai-pulse" style={{ fontSize: 32, color: "white" }}>psychology</span>
                      <span style={{ color: "white", fontSize: "var(--text-sm)", fontWeight: 600, marginTop: 8 }}>AI Analysing…</span>
                    </div>
                  ) : null}
                  {generatingConcept ? (
                    <div className="quotePreviewProcessingOverlay">
                      <span className="material-symbols-outlined ai-pulse" style={{ fontSize: 32, color: "white" }}>auto_awesome</span>
                      <span style={{ color: "white", fontSize: "var(--text-sm)", fontWeight: 600, marginTop: 8 }}>Rendering 3D AI Concept…</span>
                    </div>
                  ) : null}
                  {saving ? (
                    <div className="quotePreviewProcessingOverlay">
                      <span className="material-symbols-outlined ai-pulse" style={{ fontSize: 32, color: "white" }}>diamond</span>
                      <span style={{ color: "white", fontSize: "var(--text-sm)", fontWeight: 600, marginTop: 8 }}>Saving quote &amp; 3D Render…</span>
                      <div style={{ width: "70%", height: 6, borderRadius: 999, background: "rgb(255 255 255 / 25%)", overflow: "hidden", marginTop: 10 }}>
                        <div style={{ height: "100%", width: `${savingProgress}%`, background: "white", transition: "width 400ms linear" }} />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="quotePreviewPriceBlock">
                  <p className="eyebrow" style={{ marginBottom: 4 }}>Live Estimate</p>
                  <div className="quotePrice" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>
                    {analysis
                      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(estimatedSellingPrice)
                      : "—"}
                  </div>
                  <p className="muted small" style={{ marginTop: 4 }}>
                    {analysis ? "Updates automatically as you adjust the design." : "Upload a photo to get started."}
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
      )}

      {warning ? <div className="showroomWarning">Still there? This screen will reset in 10 seconds.</div> : null}
      <footer style={{ marginTop: "auto", textAlign: "center", color: "var(--color-on-surface-variant)", fontSize: 12, padding: "24px 0" }}>
        Powered by Azzure AutoQuote
      </footer>
    </div>
  );
}
