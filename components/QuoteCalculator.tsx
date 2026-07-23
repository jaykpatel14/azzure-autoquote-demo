"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { calculateQuote, convertMetalWeight, type MetalType } from "@/lib/pricing";

type Estimate = {
  analysisId?: string;
  metalWeightGrams: number;
  centerDiamondCarats: number;
  sideDiamondCarats: number;
  sideDiamondQuantity: number;
  confidence: string;
  notes?: string;
};

const initialEstimate: Estimate = {
  metalWeightGrams: 5.2,
  centerDiamondCarats: 1,
  sideDiamondCarats: 0.35,
  sideDiamondQuantity: 18,
  confidence: "manual"
};

export default function QuoteCalculator({ canEdit }: { canEdit: boolean }) {
  const [metalType, setMetalType] = useState<MetalType>("14K");
  const [estimate, setEstimate] = useState<Estimate>(initialEstimate);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const price = useMemo(
    () =>
      calculateQuote({
        metalType,
        metalWeightGrams: estimate.metalWeightGrams,
        centerDiamondCarats: estimate.centerDiamondCarats,
        sideDiamondCarats: estimate.sideDiamondCarats,
        sideDiamondQuantity: estimate.sideDiamondQuantity
      }),
    [metalType, estimate]
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

  async function analyze() {
    if (!file) {
      setStatus("Choose a jewelry image first.");
      return;
    }

    setLoading(true);
    setStatus("Running three independent AI reviews...");

    try {
      const body = new FormData();
      body.append("image", file);
      body.append("metalType", metalType);

      const response = await fetch("/api/analyze", { method: "POST", body });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Analysis failed.");

      setEstimate({
        analysisId: result.analysisId,
        metalWeightGrams: result.metalWeightGrams,
        centerDiamondCarats: result.centerDiamondCarats,
        sideDiamondCarats: result.sideDiamondCarats,
        sideDiamondQuantity: result.sideDiamondQuantity,
        confidence: result.confidence,
        notes: result.notes
      });
      setStatus("Estimate applied. Review and edit every value before saving.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  async function saveQuote() {
    setStatus("Saving quote...");
    const response = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysisId: estimate.analysisId,
        metalType,
        metalWeightGrams: estimate.metalWeightGrams,
        centerDiamondCarats: estimate.centerDiamondCarats,
        sideDiamondCarats: estimate.sideDiamondCarats,
        sideDiamondQuantity: estimate.sideDiamondQuantity
      })
    });
    const result = await response.json();
    setStatus(response.ok ? `Quote ${result.quoteNumber} saved.` : result.error);
  }

  return (
    <div className="grid">
      <section className="card">
        <h2>Upload Design</h2>
        <p className="muted">
          Upload a photograph, sketch, CAD render, or reference image. AI output is a
          preliminary estimate and remains editable.
        </p>

        <label className="dropzone">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={!canEdit}
            onChange={(event) => {
              const selected = event.target.files?.[0] || null;
              setFile(selected);
              if (previewUrl) URL.revokeObjectURL(previewUrl);
              setPreviewUrl(selected ? URL.createObjectURL(selected) : "");
            }}
          />
          <strong>Click to select a jewelry image</strong>
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

        <div className="actions">
          <button className="button primary" disabled={loading || !canEdit} onClick={analyze}>
            {loading ? "Analyzing..." : "Analyze with AI"}
          </button>
        </div>

        {status && <div className="status">{status}</div>}

        <div className="fields">
          <div className="field">
            <label>Metal Type</label>
            <select
              value={metalType}
              disabled={!canEdit}
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
            label="Metal Weight (g)"
            value={estimate.metalWeightGrams}
            disabled={!canEdit}
            onChange={(value) => updateNumber("metalWeightGrams", value)}
          />
          <NumberField
            label="Center Diamond (ct)"
            value={estimate.centerDiamondCarats}
            disabled={!canEdit}
            onChange={(value) => updateNumber("centerDiamondCarats", value)}
          />
          <NumberField
            label="Side Diamonds (ct)"
            value={estimate.sideDiamondCarats}
            disabled={!canEdit}
            onChange={(value) => updateNumber("sideDiamondCarats", value)}
          />
          <NumberField
            label="Side Stone Quantity"
            value={estimate.sideDiamondQuantity}
            step={1}
            disabled={!canEdit}
            onChange={(value) => updateNumber("sideDiamondQuantity", value)}
          />
          <div className="field">
            <label>Confidence</label>
            <input readOnly value={estimate.confidence} />
          </div>
        </div>
        {estimate.notes && <p className="muted">{estimate.notes}</p>}
      </section>

      <section className="card">
        <h2>Customer Estimate</h2>
        <div className="priceBox">
          <div>Estimated Final Price</div>
          <div className="price">
            {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
              price.estimatedFinalPrice
            )}
          </div>
          <div className="summary">
            {metalType} - {estimate.metalWeightGrams.toFixed(2)} g
            <br />
            {estimate.centerDiamondCarats.toFixed(2)} ct center
            <br />
            {estimate.sideDiamondCarats.toFixed(2)} ct sides - {estimate.sideDiamondQuantity} stones
          </div>
        </div>
        <div className="actions">
          <button className="button primary" disabled={!canEdit} onClick={saveQuote}>
            Save Quote
          </button>
          <button className="button secondary" onClick={() => window.print()}>
            Print
          </button>
        </div>
        {!canEdit && <p className="disclaimer">Your role is read-only, so editing is disabled.</p>}
        <p className="disclaimer">
          The estimated price is approximate. Final pricing must be confirmed after CAD
          design and production review.
        </p>
      </section>
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
