"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { calculateQuote, convertMetalWeight, type MetalType, type PricingProfileInput } from "@/lib/pricing";

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

const initialEstimate: Estimate = {
  jewelryType: "ring",
  metalWeightGrams: 5.2,
  centerDiamondCarats: 1,
  sideDiamondCarats: 0.35,
  sideDiamondQuantity: 18,
  confidence: "manual"
};

const processingCopy: Record<Exclude<Phase, "saved" | "error">, string> = {
  idle: "Ready to upload a jewelry image.",
  uploading: "Uploading the image securely to the server.",
  processing: "Running moderation and three independent AI reviews.",
  ready: "AI analysis is complete and the values are editable.",
  saving: "Saving the approved quote to company history."
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
  const [customerName, setCustomerName] = useState("");
  const [estimate, setEstimate] = useState<Estimate>(initialEstimate);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [status, setStatus] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const price = useMemo(
    () =>
      calculateQuote({
        metalType,
        metalWeightGrams: estimate.metalWeightGrams,
        centerDiamondCarats: estimate.centerDiamondCarats,
        sideDiamondCarats: estimate.sideDiamondCarats,
        sideDiamondQuantity: estimate.sideDiamondQuantity
      }, pricingProfile ?? {}),
    [metalType, estimate, pricingProfile]
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function updateNumber(key: keyof Estimate, value: number) {
    setEstimate((current) => ({ ...current, [key]: Math.max(0, value) }));
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

  function resetEstimate() {
    if (!window.confirm("Clear the current draft estimate?")) {
      return;
    }

    setEstimate(initialEstimate);
    setCustomerName("");
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setStatus("Draft estimate cleared.");
    setPhase("idle");
    setUploadProgress(0);
  }

  const statusMessage =
    phase === "saved"
      ? "Quote saved successfully."
      : phase === "error"
        ? status
        : processingCopy[phase as Exclude<Phase, "saved" | "error">] || status;

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
      setUploadProgress(100);
      setPhase("ready");
      setStatus("Estimate applied. Review and edit every value before saving.");
    } catch (error) {
      setPhase("error");
      setStatus(error instanceof Error ? error.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  async function saveQuote() {
    if (!window.confirm("Save this approved quote to company history?")) {
      return;
    }

    setSaving(true);
    setPhase("saving");
    setStatus("Saving quote...");

    const response = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysisId: estimate.analysisId,
        customerName,
        metalType,
        metalWeightGrams: estimate.metalWeightGrams,
        centerDiamondCarats: estimate.centerDiamondCarats,
        sideDiamondCarats: estimate.sideDiamondCarats,
        sideDiamondQuantity: estimate.sideDiamondQuantity
      })
    });

    const result = await response.json();
    if (response.ok) {
      setPhase("saved");
      setStatus(`Quote ${result.quoteNumber} saved.`);
    } else {
      setPhase("error");
      setStatus(result.error || "Unable to save quote.");
    }

    setSaving(false);
  }

  const processingSteps = [
    { label: "Upload", state: phase === "uploading" ? "active" : uploadProgress === 100 ? "done" : "idle" },
    { label: "Moderate", state: phase === "processing" || phase === "ready" || phase === "saving" ? "active" : "idle" },
    { label: "Review", state: phase === "ready" || phase === "saving" || phase === "saved" ? "active" : "idle" },
    { label: "Save", state: phase === "saving" || phase === "saved" ? "active" : "idle" }
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
              <button className="button secondary" disabled={!canEdit || loading || saving} onClick={resetEstimate}>
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

          <div className="progressShell" aria-live="polite">
            <div className="progressHeader">
              <strong>Image upload progress</strong>
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
            {processingSteps.map((step) => (
              <div key={step.label} className={`step ${step.state}`}>
                <span className="stepDot" aria-hidden="true" />
                <span>{step.label}</span>
              </div>
            ))}
          </div>

          <div className="fields">
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
              disabled={!canEdit || loading || saving}
              onChange={(value) => updateNumber("centerDiamondCarats", value)}
            />
            <NumberField
              label="Side diamonds (ct)"
              value={estimate.sideDiamondCarats}
              disabled={!canEdit || loading || saving}
              onChange={(value) => updateNumber("sideDiamondCarats", value)}
            />
            <NumberField
              label="Side stone quantity"
              value={estimate.sideDiamondQuantity}
              step={1}
              disabled={!canEdit || loading || saving}
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
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                price.estimatedFinalPrice
              )}
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
                <span>Stone layout</span>
                <strong>
                  {estimate.centerDiamondCarats.toFixed(2)} ct center, {estimate.sideDiamondQuantity} side stones
                </strong>
              </div>
            </div>
            {pricingNote ? <p className="muted small">{pricingNote}</p> : null}
            <p className="disclaimer">
              Final pricing is an approved estimate, not a manufacturing invoice. Production review may
              change the quote after CAD, stone verification, or metal confirmation.
            </p>
          </div>

          <div className="buttonRow">
            <button className="button primary" disabled={!canEdit || loading || saving} onClick={saveQuote}>
              {saving ? "Saving..." : "Save quote"}
            </button>
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
