"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  calculateQuote,
  convertMetalWeight,
  mergePricingProfiles,
  type MetalType,
  type PricingProfileInput
} from "@/lib/pricing";

type Estimate = {
  analysisId?: string;
  jewelryType?: string;
  centerShape?: string;
  metalWeightGrams: number;
  centerDiamondCarats: number;
  sideDiamondCarats: number;
  sideDiamondQuantity: number;
  confidence: string;
  notes?: string;
  assumptions?: string[];
};

type Phase = "idle" | "uploading" | "processing" | "ready" | "saving" | "saved" | "error";
type QuoteMode = "normal" | "without-center" | "without-center-and-side";

type SavedQuote = {
  id: string;
  quoteNumber: string;
};

type SaveQuoteResult =
  | { ok: true; id: string; quoteNumber: string }
  | { ok: false; error: string };

const initialEstimate: Estimate = {
  jewelryType: "",
  metalWeightGrams: 0,
  centerDiamondCarats: 0,
  sideDiamondCarats: 0,
  sideDiamondQuantity: 0,
  confidence: "manual"
};

const processingCopy: Record<Exclude<Phase, "saved" | "error">, string> = {
  idle: "Ready to upload a jewelry image.",
  uploading: "Uploading the image securely to the server.",
  processing: "Running moderation and three independent AI reviews.",
  ready: "AI analysis is complete and the values are editable.",
  saving: "Saving the approved quote to company history."
};

const QUOTE_MODE_OPTIONS: Array<{ value: QuoteMode; label: string; description: string }> = [
  {
    value: "normal",
    label: "Normal quote",
    description: "Include the center stone and side stones in the estimate."
  },
  {
    value: "without-center",
    label: "Quote without center stone",
    description: "Exclude the center stone while keeping side stones in the quote."
  },
  {
    value: "without-center-and-side",
    label: "Quote without center stone and side stone",
    description: "Exclude all center and side stone pricing from the quote."
  }
];

const initialCustomerPricingOverlay: PricingProfileInput = {
  goldSpotPerOz: 0,
  platinumSpotPerOz: 0,
  silverSpotPerOz: 0,
  cadCharge: 0,
  centerSettingPerCarat: 0,
  sideSettingPerStone: 0,
  sellingMarginDivisor: 0,
  finalMultiplier: 0
};

type QuoteCalculatorProps = {
  canEdit: boolean;
  pricingProfile?: PricingProfileInput;
  pricingSourceLabel?: string;
  pricingNote?: string;
};

export default function QuoteCalculator({
  canEdit,
  pricingProfile,
  pricingSourceLabel,
  pricingNote
}: QuoteCalculatorProps) {
  const [metalType, setMetalType] = useState<MetalType>("14K");
  const [quoteMode, setQuoteMode] = useState<QuoteMode>("normal");
  const [customerName, setCustomerName] = useState("");
  const [customerPricingOverlay, setCustomerPricingOverlay] = useState<PricingProfileInput>(
    initialCustomerPricingOverlay
  );
  const [estimate, setEstimate] = useState<Estimate>(initialEstimate);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [status, setStatus] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedQuote, setSavedQuote] = useState<SavedQuote | null>(null);
  const [draftIsFresh, setDraftIsFresh] = useState(true);

  const quoteEstimate = useMemo(() => applyQuoteMode(estimate, quoteMode), [estimate, quoteMode]);
  const effectivePricingProfile = useMemo(
    () => mergePricingProfiles(pricingProfile ?? {}, customerPricingOverlay),
    [pricingProfile, customerPricingOverlay]
  );
  const price = useMemo(
    () =>
      calculateQuote(
        {
          metalType,
          metalWeightGrams: quoteEstimate.metalWeightGrams,
          centerDiamondCarats: quoteEstimate.centerDiamondCarats,
          sideDiamondCarats: quoteEstimate.sideDiamondCarats,
          sideDiamondQuantity: quoteEstimate.sideDiamondQuantity
        },
        effectivePricingProfile
      ),
    [metalType, quoteEstimate, effectivePricingProfile]
  );
  const previewPrice = draftIsFresh ? 0 : price.estimatedFinalPrice;
  const hasCustomerOverlay = useMemo(
    () => Object.values(customerPricingOverlay).some((value) => Number(value) > 0),
    [customerPricingOverlay]
  );
  const publicQuoteUrl = savedQuote ? `/q/${savedQuote.id}` : "";
  const centerStoneDisabled = quoteMode !== "normal";
  const sideStoneDisabled = quoteMode === "without-center-and-side";

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function clearDraftState(message: string) {
    setEstimate(initialEstimate);
    setMetalType("14K");
    setQuoteMode("normal");
    setCustomerName("");
    setCustomerPricingOverlay(initialCustomerPricingOverlay);
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setStatus(message);
    setPhase("idle");
    setUploadProgress(0);
    setDraftIsFresh(true);
    setSavedQuote(null);
  }

  function updateNumber(key: keyof Estimate, value: number) {
    setEstimate((current) => ({ ...current, [key]: Math.max(0, value) }));
  }

  function updateOverlayNumber(key: keyof PricingProfileInput, value: number) {
    setCustomerPricingOverlay((current) => ({ ...current, [key]: Math.max(0, value) }));
  }

  function changeMetal(next: MetalType) {
    setEstimate((current) => ({
      ...current,
      metalWeightGrams: Number(
        convertMetalWeight(current.metalWeightGrams, metalType, next).toFixed(2)
      )
    }));
    setMetalType(next);
  }

  function changeQuoteMode(next: QuoteMode) {
    setQuoteMode(next);
  }

  function resetEstimate(message = "Draft estimate cleared.") {
    if (!window.confirm("Clear the current draft estimate?")) {
      return;
    }

    clearDraftState(message);
  }

  const statusMessage =
    phase === "error"
      ? status
      : status || processingCopy[phase as Exclude<Phase, "saved" | "error">] || "Ready to upload a jewelry image.";

  const progressCopy = (() => {
    if (phase === "saved" || phase === "error") {
      return status;
    }

    return processingCopy[phase];
  })();

  function sendAnalysisRequest(selectedFile: File) {
    return new Promise<{ ok: boolean; payload: unknown }>((resolve, reject) => {
      const body = new FormData();
      body.append("image", selectedFile);
      body.append("metalType", metalType);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/analyze");
      xhr.responseType = "json";
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          setUploadProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
        }
      };
      xhr.onload = () => {
        const payload = xhr.response ?? {};
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, payload });
      };
      xhr.onerror = () => reject(new Error("Upload failed. Please try again."));
      xhr.send(body);
    });
  }

  async function analyze() {
    if (!file) {
      setStatus("Choose a jewelry image first.");
      return;
    }

    setLoading(true);
    setPhase("uploading");
    setUploadProgress(0);
    setStatus("Uploading image and preparing AI review.");
    setSavedQuote(null);

    try {
      const response = await sendAnalysisRequest(file);
      setPhase("processing");
      setStatus(processingCopy.processing);

      if (!response.ok) {
        const errorPayload = response.payload as { error?: string };
        throw new Error(errorPayload.error || "Analysis failed.");
      }

      const result = response.payload as {
        analysisId?: string;
        jewelryType?: string;
        centerShape?: string;
        metalWeightGrams: number;
        centerDiamondCarats: number;
        sideDiamondCarats: number;
        sideDiamondQuantity: number;
        confidence: string;
        notes?: string;
        assumptions?: string[];
      };
      setEstimate({
        analysisId: result.analysisId,
        jewelryType: result.jewelryType,
        centerShape: result.centerShape,
        metalWeightGrams: result.metalWeightGrams,
        centerDiamondCarats: result.centerDiamondCarats,
        sideDiamondCarats: result.sideDiamondCarats,
        sideDiamondQuantity: result.sideDiamondQuantity,
        confidence: result.confidence,
        notes: result.notes,
        assumptions: result.assumptions
      });
      setDraftIsFresh(false);
      setUploadProgress(100);
      setPhase("ready");
      setStatus("Estimate applied. Review and edit the details, then save the quote.");
    } catch (error) {
      setPhase("error");
      setStatus(error instanceof Error ? error.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  async function persistQuote(
    payload: {
      analysisId?: string;
      customerName: string;
      quoteMode: QuoteMode;
      metalType: MetalType;
      metalWeightGrams: number;
      centerDiamondCarats: number;
      sideDiamondCarats: number;
      sideDiamondQuantity: number;
      pricingOverlay: PricingProfileInput;
    },
    options?: { resetDraftAfterSave?: boolean; confirm?: boolean }
  ): Promise<SaveQuoteResult> {
    if (options?.confirm !== false && !window.confirm("Save this approved quote to company history?")) {
      return { ok: false, error: "Cancelled." };
    }

    setSaving(true);
    setPhase("saving");
    setStatus("Saving quote...");

    const response = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (response.ok) {
      const savedId = result.id as string;
      const savedQuoteNumber = result.quoteNumber as string;
      setPhase("saved");
      setSavedQuote({ id: savedId, quoteNumber: savedQuoteNumber });
      setStatus(`Quote ${savedQuoteNumber} saved. You can keep editing and save again if needed.`);
      setSaving(false);
      if (options?.resetDraftAfterSave) {
        setDraftIsFresh(true);
      }
      return { ok: true, id: savedId, quoteNumber: savedQuoteNumber };
    } else {
      setPhase("error");
      setStatus(result.error || "Unable to save quote.");
      setSaving(false);
      return { ok: false, error: result.error || "Unable to save quote." };
    }
  }

  const processingSteps = [
    { label: "Upload", state: phase === "uploading" ? "active" : uploadProgress === 100 ? "done" : "idle" },
    { label: "Moderate", state: phase === "processing" || phase === "ready" || phase === "saving" ? "active" : "idle" },
    { label: "Review", state: phase === "ready" || phase === "saving" || phase === "saved" ? "active" : "idle" },
    { label: "Save", state: phase === "saving" || phase === "saved" ? "active" : "idle" }
  ] as const;
  const analysisRows = [
    {
      label: "Image upload",
      value: uploadProgress > 0 ? `${uploadProgress}% complete` : "Waiting for an image",
      state: phase === "uploading" || uploadProgress === 100 ? "done" : "pending"
    },
    {
      label: "Moderation pass",
      value: phase === "processing" || phase === "ready" || phase === "saving" ? "Running" : "Queued",
      state: phase === "processing" || phase === "ready" || phase === "saving" ? "pending" : "idle"
    },
    {
      label: "Estimate review",
      value: phase === "ready" || phase === "saving" || phase === "saved" ? "Ready" : "Waiting",
      state: phase === "ready" || phase === "saving" || phase === "saved" ? "done" : "idle"
    }
  ] as const;

  return (
    <div className="estimateWorkspace">
      <div className="twoColumnLayout">
        <section className="card formCard">
          <div className="sectionHeader">
            <div>
              <h2>Upload and review</h2>
              <p className="muted">
                AI output is approximate. Keep every field editable before you save a quote.
              </p>
            </div>
            <div className="buttonRow">
              <button className="button secondary" disabled={!canEdit || loading || saving} onClick={() => resetEstimate()}>
                Reset draft
              </button>
              <button className="button primary" disabled={loading || saving || !canEdit} onClick={analyze}>
                {loading ? "Analyzing..." : "Analyze with AI"}
              </button>
            </div>
          </div>

          <label className="dropzone">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={!canEdit || loading || saving}
              onChange={(event) => {
                const selected = event.target.files?.[0] || null;
                setFile(selected);
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setPreviewUrl(selected ? URL.createObjectURL(selected) : "");
                setPhase("idle");
                setStatus(selected ? "Image ready for analysis." : "");
              }}
            />
            <strong>Click to select a jewelry image</strong>
            <span className="muted small">JPG, PNG, or WEBP up to 8 MB.</span>
            {previewUrl && (
              <Image
                className="preview"
                src={previewUrl}
                alt="Jewelry preview"
                width={800}
                height={600}
                unoptimized
              />
            )}
          </label>

          <div className="analysisPanel" aria-live="polite">
            <div className="sectionHeader">
              <div>
                <h3>Analysis pipeline</h3>
                <p className="muted">The image moves through moderation, extraction, and review before it is saved.</p>
              </div>
              <span className="eyebrow">{phase === "saved" ? "Completed" : phase === "error" ? "Needs attention" : "Live"}</span>
            </div>
            <div className="analysisList">
              {analysisRows.map((row) => (
                <div key={row.label} className={`analysisRow is${row.state[0].toUpperCase()}${row.state.slice(1)}`}>
                  <span className="analysisDot" aria-hidden="true" />
                  <span>{row.label}</span>
                  <span className="analysisValue">{row.value}</span>
                </div>
              ))}
            </div>
            <div className="progressShell">
              <div className="progressHeader">
                <strong>Upload progress</strong>
                <span className="muted small">{uploadProgress}%</span>
              </div>
              <div className="progressTrack" aria-hidden="true">
                <div
                  className={`progressFill ${phase === "processing" ? "isPulsing" : ""}`}
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="muted small">{progressCopy}</p>
            </div>
            <div className="stepper" aria-label="AI processing states">
              {processingSteps.map((step, index) => (
                <div key={step.label} className={`step ${step.state}`}>
                  <span className="stepNumber">0{index + 1}</span>
                  <span className="stepLabel">{step.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="fields">
            <div className="field">
              <label htmlFor="quoteMode">Quote mode</label>
              <select
                id="quoteMode"
                value={quoteMode}
                disabled={!canEdit || loading || saving}
                onChange={(event) => changeQuoteMode(event.target.value as QuoteMode)}
              >
                {QUOTE_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="muted small">
                {QUOTE_MODE_OPTIONS.find((option) => option.value === quoteMode)?.description}
              </p>
            </div>
            <div className="field">
              <label htmlFor="customerName">Customer name</label>
              <input
                id="customerName"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Optional"
                disabled={!canEdit || loading || saving}
              />
            </div>
            <div className="field">
              <label htmlFor="jewelryType">Jewelry type</label>
              <input
                id="jewelryType"
                value={estimate.jewelryType || ""}
                onChange={(event) => setEstimate((current) => ({ ...current, jewelryType: event.target.value }))}
                disabled={!canEdit || loading || saving}
              />
            </div>
            <div className="field">
              <label htmlFor="metalType">Metal type</label>
              <select
                id="metalType"
                value={metalType}
                disabled={!canEdit || loading || saving}
                onChange={(event) => changeMetal(event.target.value as MetalType)}
              >
                {["10K", "14K", "18K", "Platinum", "Silver"].map((metal) => (
                  <option key={metal} value={metal}>
                    {metal}
                  </option>
                ))}
              </select>
            </div>
            <NumberField
              label="Metal weight (g)"
              value={estimate.metalWeightGrams}
              disabled={!canEdit || loading || saving}
              onChange={(value) => updateNumber("metalWeightGrams", value)}
            />
            <NumberField
              label="Center diamond (ct)"
              value={estimate.centerDiamondCarats}
              disabled={!canEdit || loading || saving || centerStoneDisabled}
              onChange={(value) => updateNumber("centerDiamondCarats", value)}
            />
            <NumberField
              label="Side diamonds (ct)"
              value={estimate.sideDiamondCarats}
              disabled={!canEdit || loading || saving || sideStoneDisabled}
              onChange={(value) => updateNumber("sideDiamondCarats", value)}
            />
            <NumberField
              label="Side stone quantity"
              value={estimate.sideDiamondQuantity}
              step={1}
              disabled={!canEdit || loading || saving || sideStoneDisabled}
              onChange={(value) => updateNumber("sideDiamondQuantity", value)}
            />
            <div className="field">
              <label htmlFor="centerShape">Center shape</label>
              <input
                id="centerShape"
                value={estimate.centerShape || ""}
                onChange={(event) => setEstimate((current) => ({ ...current, centerShape: event.target.value }))}
                placeholder="Round, oval, princess..."
                disabled={!canEdit || loading || saving}
              />
            </div>
            <div className="field">
              <label>Confidence</label>
              <input readOnly value={estimate.confidence} />
            </div>
          </div>

          {estimate.notes ? <p className="muted">{estimate.notes}</p> : null}

          <div className="sectionHeader" style={{ marginTop: "1.25rem" }}>
            <div>
              <h3>Customer pricing overlay</h3>
              <p className="muted">
                Add editable pricing on top of the Azzure base pricing before the final quote is calculated.
              </p>
            </div>
            {hasCustomerOverlay ? <span className="eyebrow">Overlay active</span> : null}
          </div>
          <div className="fields">
            <NumberField
              label="Gold spot / oz add-on"
              value={customerPricingOverlay.goldSpotPerOz ?? 0}
              disabled={!canEdit || loading || saving}
              onChange={(value) => updateOverlayNumber("goldSpotPerOz", value)}
            />
            <NumberField
              label="Platinum spot / oz add-on"
              value={customerPricingOverlay.platinumSpotPerOz ?? 0}
              disabled={!canEdit || loading || saving}
              onChange={(value) => updateOverlayNumber("platinumSpotPerOz", value)}
            />
            <NumberField
              label="Silver spot / oz add-on"
              value={customerPricingOverlay.silverSpotPerOz ?? 0}
              disabled={!canEdit || loading || saving}
              onChange={(value) => updateOverlayNumber("silverSpotPerOz", value)}
            />
            <NumberField
              label="CAD charge add-on"
              value={customerPricingOverlay.cadCharge ?? 0}
              disabled={!canEdit || loading || saving}
              onChange={(value) => updateOverlayNumber("cadCharge", value)}
            />
            <NumberField
              label="Center setting / carat add-on"
              value={customerPricingOverlay.centerSettingPerCarat ?? 0}
              disabled={!canEdit || loading || saving}
              onChange={(value) => updateOverlayNumber("centerSettingPerCarat", value)}
            />
            <NumberField
              label="Side setting / stone add-on"
              value={customerPricingOverlay.sideSettingPerStone ?? 0}
              disabled={!canEdit || loading || saving}
              onChange={(value) => updateOverlayNumber("sideSettingPerStone", value)}
            />
            <NumberField
              label="Selling margin divisor add-on"
              value={customerPricingOverlay.sellingMarginDivisor ?? 0}
              disabled={!canEdit || loading || saving}
              onChange={(value) => updateOverlayNumber("sellingMarginDivisor", value)}
            />
            <NumberField
              label="Final multiplier add-on"
              value={customerPricingOverlay.finalMultiplier ?? 0}
              disabled={!canEdit || loading || saving}
              onChange={(value) => updateOverlayNumber("finalMultiplier", value)}
            />
          </div>
        </section>

        <section className="card previewCard">
          <div className="sectionHeader">
            <div>
              <h2>Customer quote preview</h2>
              <p className="muted">
                Recipients see only the approved final price and the disclaimer.
              </p>
            </div>
          </div>
          <div className="quotePreview">
            <p className="eyebrow">Approved final price</p>
            {pricingSourceLabel ? <p className="muted small">{pricingSourceLabel}</p> : null}
            <div className="quotePrice">
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(previewPrice)}
            </div>
            <div className="quoteMeta">
              <div>
                <span>Customer</span>
                <strong>{customerName || "Unassigned"}</strong>
              </div>
              <div>
                <span>Metal</span>
                <strong>{metalType}</strong>
              </div>
              <div>
                <span>Quote mode</span>
                <strong>{QUOTE_MODE_OPTIONS.find((option) => option.value === quoteMode)?.label}</strong>
              </div>
              <div>
                <span>Stone layout</span>
                <strong>
                  {quoteEstimate.centerDiamondCarats.toFixed(2)} ct center, {quoteEstimate.sideDiamondQuantity} side stones
                </strong>
              </div>
            </div>
            {hasCustomerOverlay ? (
              <p className="muted small">Customer pricing overlay is added on top of Azzure pricing.</p>
            ) : null}
            {pricingNote ? <p className="muted small">{pricingNote}</p> : null}
            <p className="disclaimer">
              Final pricing is an approved estimate, not a manufacturing invoice. Production review may
              change the quote after CAD, stone verification, or metal confirmation.
            </p>
          </div>

          <div className="buttonRow">
            <button
              className="button primary"
              disabled={!canEdit || loading || saving || draftIsFresh}
              onClick={() =>
                persistQuote(
                  {
                    analysisId: estimate.analysisId,
                    customerName,
                    quoteMode,
                    metalType,
                    metalWeightGrams: quoteEstimate.metalWeightGrams,
                    centerDiamondCarats: quoteEstimate.centerDiamondCarats,
                    sideDiamondCarats: quoteEstimate.sideDiamondCarats,
                    sideDiamondQuantity: quoteEstimate.sideDiamondQuantity,
                    pricingOverlay: customerPricingOverlay
                  },
                  { resetDraftAfterSave: false }
                )
              }
            >
              {saving ? "Saving..." : "Save current draft"}
            </button>
            {savedQuote ? (
              <a className="button secondary" href={`/api/quotes/${savedQuote.id}/pdf`} target="_blank" rel="noreferrer">
                Download PDF
              </a>
            ) : null}
            {savedQuote ? (
              <a className="button secondary" href={publicQuoteUrl} target="_blank" rel="noreferrer">
                Open public quote
              </a>
            ) : null}
            <button className="button secondary" onClick={() => window.print()}>
              Print preview
            </button>
          </div>

          <div className="status" role="status" aria-live="polite">
            {statusMessage || "Ready to quote."}
          </div>
        </section>
      </div>
    </div>
  );
}

function applyQuoteMode(estimate: Estimate, quoteMode: QuoteMode): Estimate {
  if (quoteMode === "without-center-and-side") {
    return {
      ...estimate,
      centerDiamondCarats: 0,
      sideDiamondCarats: 0,
      sideDiamondQuantity: 0
    };
  }

  if (quoteMode === "without-center") {
    return {
      ...estimate,
      centerDiamondCarats: 0
    };
  }

  return estimate;
}

function NumberField({
  label,
  value,
  step = 0.01,
  disabled = false,
  onChange
}: {
  label: string;
  value: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="number"
        min={0}
        step={step}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
    </div>
  );
}
