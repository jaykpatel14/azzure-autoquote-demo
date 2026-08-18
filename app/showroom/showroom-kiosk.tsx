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
  "Analysing your photo & design concept...",
  "Calculating metal weight & stone specs...",
  "Synthesizing live spot retail quote..."
] as const;

const METAL_OPTIONS = ["10K", "14K", "18K", "Platinum", "Silver"];

const LUXURY_PRESETS = [
  {
    title: "2.5ct Pear Halo Solitaire",
    description: "14K White Gold with delicate micro-pavé halo and thin diamond band",
    prompt: "14K White Gold 2.5ct Pear Cut Diamond Solitaire with Micro-Pavé Halo and thin Diamond Band",
    icon: "diamond"
  },
  {
    title: "3.0ct Oval Hidden Halo",
    description: "18K Yellow Gold with hidden under-halo and solitaire band",
    prompt: "18K Yellow Gold 3.0ct Oval Cut Diamond Solitaire with Hidden Halo",
    icon: "auto_awesome"
  },
  {
    title: "2.0ct Emerald Cut 3-Stone",
    description: "Platinum with tapered baguette side diamonds",
    prompt: "Platinum 2.0ct Emerald Cut Diamond Ring with Tapered Baguette Side Stones",
    icon: "category"
  },
  {
    title: "1.5ct Cushion Pavé Split Shank",
    description: "14K Rose Gold with double claw prongs and split pavé band",
    prompt: "14K Rose Gold 1.5ct Cushion Cut Diamond Ring with Split Shank Pavé Band",
    icon: "sparkles"
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
        metalType: debouncedAnalysis.selectedMetal,
        metalWeightGrams: debouncedAnalysis.metalWeightGrams,
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

  async function analyse(customText?: string) {
    const textToUse = customText || description;
    if (!files.length && !textToUse.trim()) {
      setError("Please upload a photo or select an inspiration preset.");
      return;
    }

    setAnalyzing(true);
    setStageIndex(0);
    setError("");
    setAnalysis(null);
    setRenderingImageUrl(null);

    const pulser = window.setInterval(() => {
      setStageIndex((current) => (current + 1) % KIOSK_ANALYSIS_STAGES.length);
    }, 800);

    try {
      if (files.length) {
        const results: Analysis[] = [];
        for (const file of files) {
          const form = new FormData();
          form.set("token", token);
          form.set("image", file);
          form.set("description", textToUse);
          const response = await fetch("/api/showroom/analyze", { method: "POST", body: form });
          const body = await response.json();
          if (!response.ok) throw new Error(body.error);
          results.push(body);
        }
        setAnalysisIds(results.map((r) => r.analysisId));
        setAnalysis(results[0]);
      } else {
        // Concept text synthesis for preset
        const response = await fetch("/api/concept/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: textToUse })
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Concept synthesis failed.");
        setAnalysis({
          analysisId: body.analysisId,
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
        setRenderingImageUrl(body.imageDataUrl || null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      window.clearInterval(pulser);
      setAnalyzing(false);
    }
  }

  function handlePresetSelect(presetPrompt: string, presetTitle: string) {
    setDescription(presetPrompt);
    setScreen("builder");
    setFiles([]);
    analyse(presetPrompt);
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
        <div>
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt={branding.companyName} />
          ) : (
            <strong>{branding.companyName}</strong>
          )}
        </div>
        <div className="showroomBadge">
          <span className="showroomBadgeDot" aria-hidden="true" />
          <span>Interactive Bespoke Studio</span>
        </div>
      </header>

      {/* ── HOME SCREEN: Luxury Welcome & Inspiration Cards ── */}
      {screen === "home" ? (
        <section className="showroomPanel">
          <p className="showroomEyebrow">Bespoke Jewelry Consultation</p>
          <h1 className="showroomHeroTitle">
            Design Your <em>Dream Ring</em>
          </h1>
          <p className="showroomSubtext">
            Upload a photo from Pinterest, Instagram, or your phone — or tap any design below to generate an instant quote in 30 seconds.
          </p>

          {/* Quick End-Customer Inspiration Presets */}
          <div className="showroomPresetGrid">
            {LUXURY_PRESETS.map((preset) => (
              <div
                key={preset.title}
                className="showroomPresetCard"
                onClick={() => handlePresetSelect(preset.prompt, preset.title)}
                role="button"
                tabIndex={0}
              >
                <div className="showroomPresetIcon">
                  <span className="material-symbols-outlined">{preset.icon}</span>
                </div>
                <strong>{preset.title}</strong>
                <p>{preset.description}</p>
              </div>
            ))}
          </div>

          <button className="showroomButton" type="button" onClick={() => setScreen("builder")}>
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>photo_camera</span>
            Upload Reference Photo →
          </button>
        </section>
      ) : null}

      {/* ── BUILDER SCREEN: 3-Step Interactive Customizer ── */}
      {screen === "builder" ? (
        <section className="showroomStage">
          <button className="showroomBack" type="button" onClick={reset}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
            Start Over
          </button>

          <QuoteCreationLayout
            steps={
              <>
                <QuoteStepCard
                  number="01"
                  title="Reference Photo &amp; Description"
                  description="Upload your reference photo or describe your custom ring idea."
                >
                  <div className="field quoteDesignDescription">
                    <div className="charCountHeader">
                      <label htmlFor="showroomDescription">
                        Describe the requested design <span className="muted small" style={{ fontWeight: 400 }}>(Optional)</span>
                      </label>
                      <span className="charCountBadge">{description.length} / 1000</span>
                    </div>
                    <textarea
                      id="showroomDescription"
                      rows={3}
                      maxLength={1000}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Describe stone shape, metal preferences, halo styling, or engravings..."
                    />
                  </div>

                  <div className="dropzone dropzone--multi">
                    <div className="dropzoneContent">
                      <div className="dropzoneIcon">
                        <span className="material-symbols-outlined" style={{ fontSize: 28, color: "var(--color-brand)" }}>cloud_upload</span>
                      </div>
                      <strong>Tap to upload inspiration photos</strong>
                      <span className="muted small">JPG, PNG, or WEBP · up to 3 photos</span>
                    </div>
                    <div className="dropzoneActions">
                      <label className="button primary button--sm" style={{ background: "var(--color-brand)", color: "#08090b" }}>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          onChange={(event) => {
                            const selected = Array.from(event.target.files || []).slice(0, 3);
                            setFiles(selected);
                            if (selected.length) {
                              setScreen("builder");
                            }
                          }}
                        />
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>photo_camera</span>
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

                  {error ? <p className="fieldError">{error}</p> : null}

                  <button
                    className="button primary"
                    style={{ marginTop: 20, width: "100%", background: "var(--color-brand)", color: "#08090b", minHeight: 48, fontSize: 16, fontWeight: 700 }}
                    type="button"
                    disabled={(!files.length && !description.trim()) || analyzing}
                    onClick={() => analyse()}
                  >
                    {analyzing
                      ? <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>hourglass_top</span> Analysing Design…</>
                      : <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>auto_awesome</span> Calculate Live Quote</>}
                  </button>
                </QuoteStepCard>

                {analyzing || analysis ? (
                  <QuoteStepCard
                    number="02"
                    title="AI Analysis"
                    description="What our AI identified from your photo and specifications."
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
                    title="Customize Your Ring"
                    description="Tweak any specification — your quote on the right updates automatically."
                  >
                    <div className="facetResolvedGrid">
                      <label className="facetResolvedField">
                        <span>Metal type</span>
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
                          placeholder="e.g. Prong, Bezel, Pavé"
                        />
                      </label>
                      <div className="facetCheckboxGroup facetFullWidth">
                        <label className="facetCheckboxLabel">
                          <input
                            type="checkbox"
                            checked={analysis.hasWeddingBand ?? false}
                            onChange={(event) => updateAnalysisField("hasWeddingBand", event.target.checked)}
                          />
                          <span>Ring + matching wedding band</span>
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
                  <span className="quoteStepNumber" style={{ background: "rgba(201, 168, 76, 0.15)", color: "var(--color-brand)" }}>04</span>
                  <div>
                    <p className="eyebrow" style={{ color: "var(--color-brand)" }}>3D Concept &amp; Live Quote</p>
                    <p className="muted small">Updates in real time as you adjust specifications.</p>
                  </div>
                </div>

                <div className="quotePreviewImageFrame">
                  {renderingImageUrl || previews[0] ? (
                    <img
                      src={renderingImageUrl ?? previews[0]}
                      alt="AI generated jewelry concept"
                      className="quotePreviewImage"
                    />
                  ) : (
                    <div className="quotePreviewImagePlaceholder">
                      <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--color-brand)" }}>diamond</span>
                      <p className="muted small" style={{ margin: "12px 0 0", textAlign: "center" }}>Select an inspiration card or upload a photo to render your 3D design</p>
                    </div>
                  )}
                  {analyzing ? (
                    <div className="quotePreviewProcessingOverlay">
                      <span className="material-symbols-outlined ai-pulse" style={{ fontSize: 36, color: "var(--color-brand)" }}>psychology</span>
                      <span style={{ color: "white", fontSize: "var(--text-sm)", fontWeight: 600, marginTop: 8 }}>Synthesizing 3D Concept…</span>
                    </div>
                  ) : null}
                  {saving ? (
                    <div className="quotePreviewProcessingOverlay">
                      <span className="material-symbols-outlined ai-pulse" style={{ fontSize: 36, color: "var(--color-brand)" }}>diamond</span>
                      <span style={{ color: "white", fontSize: "var(--text-sm)", fontWeight: 600, marginTop: 8 }}>Saving Consultation…</span>
                      <div style={{ width: "70%", height: 6, borderRadius: 999, background: "rgba(255, 255, 255, 0.2)", overflow: "hidden", marginTop: 12 }}>
                        <div style={{ height: "100%", width: `${savingProgress}%`, background: "var(--color-brand)", transition: "width 400ms linear" }} />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="quotePreviewPriceBlock">
                  <p className="eyebrow" style={{ color: "var(--color-brand)", marginBottom: 4 }}>Live Showroom Estimate</p>
                  <div className="quotePrice" style={{ fontSize: "clamp(2.2rem, 4.5vw, 3.2rem)" }}>
                    {analysis
                      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(estimatedSellingPrice)
                      : "—"}
                  </div>
                  <p className="muted small" style={{ marginTop: 4 }}>
                    {analysis ? "Includes precious metal, master handcrafting, and certified stones." : "Select an idea to generate a live quote."}
                  </p>
                </div>

                <div className="quotePreviewActions">
                  <button
                    className="button primary"
                    style={{ width: "100%", background: "var(--color-brand)", color: "#08090b", minHeight: 52, fontSize: 17, fontWeight: 700 }}
                    type="button"
                    disabled={!analysis || saving}
                    onClick={save}
                  >
                    {saving ? (
                      <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>hourglass_top</span> Saving…</>
                    ) : (
                      <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>bookmark</span> Save Showroom Consultation</>
                    )}
                  </button>
                </div>
              </QuoteBuilderPreview>
            }
          />
        </section>
      ) : null}

      {/* ── SAVED SCREEN: Luxury Claim Code Display for Walk-in Client ── */}
      {screen === "saved" ? (
        <section className="showroomPanel">
          <div className="showroomSuccessCard">
            <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--color-brand)" }}>verified</span>
            <h1 style={{ fontFamily: "var(--font-display, Georgia, serif)", fontSize: "2.25rem", margin: "16px 0 8px" }}>Consultation Saved</h1>
            <p className="muted small" style={{ margin: 0 }}>Show this claim code to your jewelry associate to complete your custom order:</p>
            <div className="showroomCode">{code}</div>
            {price !== null ? (
              <p className="showroomPrice">
                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(price)}
              </p>
            ) : null}
            <button className="showroomButton" type="button" onClick={reset} style={{ marginTop: 24 }}>
              Design Another Piece →
            </button>
          </div>
        </section>
      ) : null}

      {warning ? <div className="showroomWarning">Still exploring? This kiosk screen will reset in 10 seconds.</div> : null}
      <footer>Powered by Azzure AutoQuote AI · Luxury Showroom Kiosk Mode</footer>
    </div>
  );
}
