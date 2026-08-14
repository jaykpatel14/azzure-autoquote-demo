"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { calculateQuote, type MetalType, type PricingProfileInput } from "@/lib/pricing";
import { mergeConfidence, median } from "@/lib/statistics";
import { mergePricingProfiles } from "@/lib/pricing";
import { useToast } from "@/components/toast-provider";

type QuoteMode = "normal" | "without-center" | "without-center-and-side";
type QuoteSaveResult = { ok: true; id: string; quoteNumber: string } | { ok: false; error: string };
type FacetStatus = "pending" | "processing" | "done" | "error";

type FacetOutput = {
  analysisId?: string;
  jewelryType: string;
  centerShape?: string | null;
  metalWeightGrams: number;
  centerDiamondCarats: number;
  sideDiamondCarats: number;
  sideDiamondQuantity: number;
  confidence: "low" | "medium" | "high";
  notes?: string;
  assumptions?: string[];
};

type FacetDraft = {
  id: string;
  file?: File;
  previewUrl: string | null;
  isObjectUrl: boolean;
  title: string;
  description: string;
  showDescription: boolean;
  status: FacetStatus;
  stageIndex: number;
  output: FacetOutput | null;
  error: string;
};

type AggregateQuote = {
  jewelryType: string;
  centerShape?: string;
  metalWeightGrams: number;
  centerDiamondCarats: number;
  sideDiamondCarats: number;
  sideDiamondQuantity: number;
  confidence: "low" | "medium" | "high";
  assumptions: string[];
  notes: string;
  analysisId?: string;
};

type QuoteCalculatorProps = {
  canEdit: boolean;
  pricingProfile?: PricingProfileInput;
  pricingSourceLabel?: string;
  pricingNote?: string;
  initialQuote?: {
    quoteId: string;
    quoteNumber: string;
    customerName: string | null;
    metalType: MetalType;
    metalWeightGrams: number;
    centerDiamondCarats: number;
    sideDiamondCarats: number;
    sideDiamondQuantity: number;
    imageDataUrl: string | null;
    analysisId: string | null;
    jewelryType: string | null;
    centerShape: string | null;
    confidence: string | null;
    notes: string | null;
    assumptions: string[] | null;
  };
};

const ANALYSIS_STAGES = [
  "Analysing metal composition...",
  "Estimating diamond specs...",
  "Calculating weight..."
] as const;

const EMPTY_PROFILE: PricingProfileInput = {
  goldSpotPerOz: 0,
  platinumSpotPerOz: 0,
  silverSpotPerOz: 0,
  cadCharge: 0,
  centerSettingPerCarat: 0,
  sideSettingPerStone: 0,
  sellingMarginDivisor: 0,
  finalMultiplier: 0
};

const QUOTE_MODE_OPTIONS: Array<{
  value: QuoteMode;
  label: string;
  description: string;
}> = [
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

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `facet-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function chooseMode(values: string[]) {
  if (!values.length) return undefined;

  const counts = new Map<string, { count: number; firstIndex: number }>();
  values.forEach((value, index) => {
    const existing = counts.get(value) ?? { count: 0, firstIndex: index };
    existing.count += 1;
    counts.set(value, existing);
  });

  let bestValue: string | undefined;
  let bestCount = -1;
  let bestIndex = Number.POSITIVE_INFINITY;

  for (const [value, entry] of counts.entries()) {
    if (entry.count > bestCount || (entry.count === bestCount && entry.firstIndex < bestIndex)) {
      bestValue = value;
      bestCount = entry.count;
      bestIndex = entry.firstIndex;
    }
  }

  return bestValue;
}

function applyQuoteMode(input: FacetOutput, quoteMode: QuoteMode): FacetOutput {
  if (quoteMode === "without-center-and-side") {
    return {
      ...input,
      centerDiamondCarats: 0,
      sideDiamondCarats: 0,
      sideDiamondQuantity: 0
    };
  }

  if (quoteMode === "without-center") {
    return {
      ...input,
      centerDiamondCarats: 0
    };
  }

  return input;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function mergeAssumptions(outputs: FacetOutput[]) {
  return Array.from(
    new Set(outputs.flatMap((output) => output.assumptions ?? []).map((value) => value.trim()).filter(Boolean))
  );
}

export default function QuoteCalculator({
  canEdit,
  pricingProfile,
  initialQuote
}: QuoteCalculatorProps) {
  const [metalType, setMetalType] = useState<MetalType>(initialQuote?.metalType ?? "14K");
  const [quoteMode, setQuoteMode] = useState<QuoteMode>("normal");
  const [customerName, setCustomerName] = useState(initialQuote?.customerName ?? "");
  const [customerNotes, setCustomerNotes] = useState("");
  const [customerPricingOverlay, setCustomerPricingOverlay] = useState<PricingProfileInput>(EMPTY_PROFILE);
  const [facets, setFacets] = useState<FacetDraft[]>(() =>
    initialQuote
      ? [
          {
            id: initialQuote.quoteId,
            file: undefined,
            previewUrl: initialQuote.imageDataUrl,
            isObjectUrl: false,
            title: initialQuote.quoteNumber,
            description: "",
            showDescription: false,
            status: "done",
            stageIndex: 0,
            output: {
              analysisId: initialQuote.analysisId ?? undefined,
              jewelryType: initialQuote.jewelryType ?? "Jewelry",
              centerShape: initialQuote.centerShape ?? "",
              metalWeightGrams: initialQuote.metalWeightGrams,
              centerDiamondCarats: initialQuote.centerDiamondCarats,
              sideDiamondCarats: initialQuote.sideDiamondCarats,
              sideDiamondQuantity: initialQuote.sideDiamondQuantity,
              confidence:
                initialQuote.confidence === "low" ||
                initialQuote.confidence === "medium" ||
                initialQuote.confidence === "high"
                  ? initialQuote.confidence
                  : "medium",
              notes: initialQuote.notes ?? undefined,
              assumptions: initialQuote.assumptions ?? undefined
            },
            error: ""
          }
        ]
      : []
  );
  const [activeFacetId, setActiveFacetId] = useState<string | null>(() => initialQuote?.quoteId ?? null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedQuote, setSavedQuote] = useState<{ id: string; quoteNumber: string } | null>(null);
  const [draftIsFresh, setDraftIsFresh] = useState(!initialQuote);
  const { showToast } = useToast();

  const facetsRef = useRef<FacetDraft[]>([]);

  useEffect(() => {
    facetsRef.current = facets;
  }, [facets]);

  useEffect(() => {
    return () => {
      facetsRef.current.forEach((facet) => {
        if (facet.isObjectUrl && facet.previewUrl) {
          URL.revokeObjectURL(facet.previewUrl);
        }
      });
    };
  }, []);

  useEffect(() => {
    if (initialQuote) {
      setStatus(`Editing quote ${initialQuote.quoteNumber}.`);
    }
  }, [initialQuote]);

  const effectivePricingProfile = useMemo(
    () => mergePricingProfiles(pricingProfile ?? {}, customerPricingOverlay),
    [pricingProfile, customerPricingOverlay]
  );

  const completedFacets = facets.filter((facet) => facet.status === "done" && facet.output);
  const aggregateQuote = useMemo<AggregateQuote | null>(() => {
    if (!completedFacets.length) return null;

    const outputs = completedFacets.map((facet) => facet.output!).map((output) => applyQuoteMode(output, quoteMode));
    return {
      jewelryType: chooseMode(outputs.map((output) => output.jewelryType)) || "Jewelry",
      centerShape: chooseMode(outputs.map((output) => output.centerShape ?? "").filter(Boolean)) || undefined,
      metalWeightGrams: Number(median(outputs.map((output) => output.metalWeightGrams)).toFixed(2)),
      centerDiamondCarats: Number(median(outputs.map((output) => output.centerDiamondCarats)).toFixed(2)),
      sideDiamondCarats: Number(median(outputs.map((output) => output.sideDiamondCarats)).toFixed(2)),
      sideDiamondQuantity: Math.round(median(outputs.map((output) => output.sideDiamondQuantity))),
      confidence: mergeConfidence(outputs.map((output) => output.confidence)),
      assumptions: mergeAssumptions(outputs),
      notes:
        mergeAssumptions(outputs).length > 0
          ? `AI review values are approximate. Assumptions: ${mergeAssumptions(outputs).join(" | ")}`
          : "AI review values are approximate.",
      analysisId: completedFacets[0]?.output?.analysisId
    };
  }, [completedFacets, quoteMode]);

  const computedPrice = useMemo(() => {
    if (!aggregateQuote) return null;

    return calculateQuote(
      {
        metalType,
        metalWeightGrams: aggregateQuote.metalWeightGrams,
        centerDiamondCarats: aggregateQuote.centerDiamondCarats,
        sideDiamondCarats: aggregateQuote.sideDiamondCarats,
        sideDiamondQuantity: aggregateQuote.sideDiamondQuantity
      },
      effectivePricingProfile
    );
  }, [aggregateQuote, metalType, effectivePricingProfile]);

  const previewPrice = computedPrice?.estimatedFinalPrice ?? 0;
  const canAnalyse = canEdit && facets.some((facet) => facet.status === "pending" || facet.status === "error");

  function updateFacet(id: string, updater: (facet: FacetDraft) => FacetDraft) {
    setFacets((current) => current.map((facet) => (facet.id === id ? updater(facet) : facet)));
  }

  function handleFiles(selectedFiles: File[]) {
    if (!selectedFiles.length) return;

    setSavedQuote(null);
    setDraftIsFresh(false);
    const nextFacets = selectedFiles.map((file, index) => ({
      id: uid(),
      file,
      previewUrl: URL.createObjectURL(file),
      isObjectUrl: true,
      title: `Facet ${facetsRef.current.length + index + 1}`,
      description: "",
      showDescription: false,
      status: "pending" as FacetStatus,
      stageIndex: 0,
      output: null,
      error: ""
    }));

    setFacets((current) => [...current, ...nextFacets]);
    setActiveFacetId((current) => current ?? nextFacets[0].id);
    setStatus(`${selectedFiles.length} image${selectedFiles.length === 1 ? "" : "s"} added.`);
    showToast({
      message: `${selectedFiles.length} image${selectedFiles.length === 1 ? "" : "s"} added to the quote.`,
      variant: "info"
    });
  }

  function clearAllFacets() {
    facetsRef.current.forEach((facet) => {
      if (facet.isObjectUrl && facet.previewUrl) {
        URL.revokeObjectURL(facet.previewUrl);
      }
    });
    setFacets([]);
    setActiveFacetId(null);
    setSavedQuote(null);
    setDraftIsFresh(true);
    setStatus("Draft cleared.");
    showToast({
      message: "Quote draft cleared.",
      variant: "info"
    });
  }

  function removeFacet(id: string) {
    setFacets((current) => {
      const facet = current.find((item) => item.id === id);
      if (facet && facet.isObjectUrl && facet.previewUrl) {
        URL.revokeObjectURL(facet.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
    setActiveFacetId((current) => (current === id ? null : current));
  }

  async function sendAnalysisRequest(file: File, metal: MetalType) {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("metalType", metal);

    const response = await fetch("/api/analyze", {
      method: "POST",
      body: formData
    });

    const responseText = await response.text();
    let payload: Record<string, unknown> = {};
    if (responseText) {
      try {
        payload = JSON.parse(responseText) as Record<string, unknown>;
      } catch {
        payload = {
          error:
            response.status === 413
              ? "The server rejected this image because the upload is too large."
              : `Analysis request failed (${response.status} ${response.statusText || "HTTP error"}).`
        };
      }
    }
    return { ok: response.ok, payload };
  }

  async function analyseFacet(facet: FacetDraft) {
    if (!facet.file) {
      updateFacet(facet.id, (current) => ({
        ...current,
        status: "error",
        error: "This facet already has imported values. Add a new photo to re-analyse."
      }));
      return;
    }

    updateFacet(facet.id, (current) => ({
      ...current,
      status: "processing",
      stageIndex: 0,
      error: ""
    }));

    const pulser = window.setInterval(() => {
      updateFacet(facet.id, (current) => ({
        ...current,
        stageIndex: (current.stageIndex + 1) % ANALYSIS_STAGES.length
      }));
    }, 800);

    try {
      const response = await sendAnalysisRequest(facet.file, metalType);
      if (!response.ok) {
        const errorPayload = response.payload as { error?: string };
        throw new Error(errorPayload.error || "Analysis failed.");
      }

      const result = response.payload as FacetOutput;
      updateFacet(facet.id, (current) => ({
        ...current,
        status: "done",
        stageIndex: 0,
        output: {
          analysisId: result.analysisId,
          jewelryType: result.jewelryType || "Jewelry",
          centerShape: result.centerShape ?? "",
          metalWeightGrams: result.metalWeightGrams,
          centerDiamondCarats: result.centerDiamondCarats,
          sideDiamondCarats: result.sideDiamondCarats,
          sideDiamondQuantity: result.sideDiamondQuantity,
          confidence: result.confidence,
          notes: result.notes,
          assumptions: result.assumptions
        }
      }));
    } catch (error) {
      updateFacet(facet.id, (current) => ({
        ...current,
        status: "error",
        error: error instanceof Error ? error.message : "Analysis failed."
      }));
      showToast({
        message: error instanceof Error ? error.message : "Analysis failed.",
        variant: "error",
        autoDismiss: false
      });
    } finally {
      window.clearInterval(pulser);
    }
  }

  async function analyseAll() {
    if (!facets.length) {
      setStatus("Add at least one jewelry photo first.");
      showToast({
        message: "Add at least one jewelry photo first.",
        variant: "warning",
        autoDismiss: false
      });
      return;
    }

    setStatus("Starting analysis for all facets.");
    setSavedQuote(null);

    for (const facet of facetsRef.current) {
      if (facet.status === "done" && facet.output) continue;
      await analyseFacet(facet);
    }

    setStatus("Facet analysis complete. Review the quote and save when ready.");
    setDraftIsFresh(false);
    showToast({
      message: "Facet analysis complete.",
      variant: "success"
    });
  }

  async function persistQuote(options?: { resetDraftAfterSave?: boolean }) {
    if (!aggregateQuote || !computedPrice) {
      setStatus("Analyse the photos before saving the quote.");
      showToast({
        message: "Analyse the photos before saving the quote.",
        variant: "warning",
        autoDismiss: false
      });
      return;
    }

    if (!window.confirm("Save this approved quote to company history?")) {
      return;
    }

    setSaving(true);
    setStatus("Saving quote...");

    const response = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysisId: aggregateQuote.analysisId,
        customerName,
        quoteMode,
        metalType,
        metalWeightGrams: aggregateQuote.metalWeightGrams,
        centerDiamondCarats: aggregateQuote.centerDiamondCarats,
        sideDiamondCarats: aggregateQuote.sideDiamondCarats,
        sideDiamondQuantity: aggregateQuote.sideDiamondQuantity,
        pricingOverlay: customerPricingOverlay
      })
    });

    const result = (await response.json().catch(() => ({}))) as { id?: string; quoteNumber?: string; error?: string };
    if (!response.ok) {
      setStatus(result.error || "Unable to save quote.");
      showToast({
        message: result.error || "Unable to save quote.",
        variant: "error",
        autoDismiss: false
      });
      setSaving(false);
      return;
    }

    if (result.id && result.quoteNumber) {
      setSavedQuote({ id: result.id, quoteNumber: result.quoteNumber });
      setStatus(`Quote ${result.quoteNumber} saved. You can download the PDF or open the public view.`);
      showToast({
        message: `Quote ${result.quoteNumber} saved successfully.`,
        variant: "success"
      });
      if (options?.resetDraftAfterSave) {
        setDraftIsFresh(true);
      }
    }

    setSaving(false);
  }

  function updateFacetOutput(id: string, field: keyof FacetOutput, value: string | number) {
    updateFacet(id, (current) => {
      if (!current.output) return current;
      return {
        ...current,
        output: {
          ...current.output,
          [field]: value
        } as FacetOutput
      };
    });
  }

  const activeFacet = facets.find((facet) => facet.id === activeFacetId) ?? facets[0] ?? null;

  return (
    <div className="estimateWorkspace">
      <section className="statGrid quoteStepGrid" aria-label="Quote creation steps">
        <article className="statCard">
          <span className="eyebrow">Step 1</span>
          <strong>Upload</strong>
          <p className="muted small">Add one or more jewelry photos to start the draft.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Step 2</span>
          <strong>AI analysis</strong>
          <p className="muted small">Each facet gets its own analysis card and editable result set.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Step 3</span>
          <strong>Review &amp; generate</strong>
          <p className="muted small">Approve the estimate, download the PDF, or open the public quote.</p>
        </article>
      </section>

      <div className="twoColumnLayout">
        <section className="card formCard">
          <div className="sectionHeader">
            <div>
              <h2>Step 1 · Upload photos</h2>
              <p className="muted">Drop multiple photos here or click to upload. JPG, PNG, or WEBP up to 10 MB each.</p>
            </div>
            <div className="buttonRow">
              <button className="button secondary" type="button" disabled={!canEdit} onClick={clearAllFacets}>
                Clear all
              </button>
              <button className="button primary" type="button" disabled={!canAnalyse} onClick={analyseAll}>
                Analyse Photos
              </button>
            </div>
          </div>

          <div
            className="dropzone dropzone--multi"
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (!canEdit) return;
              handleFiles(Array.from(event.dataTransfer.files).filter(Boolean));
            }}
          >
            <strong>Add jewelry photos</strong>
            <span className="muted small">Use your camera or choose JPG, PNG, or WEBP images up to 10 MB.</span>
            <div className="dropzoneActions">
              <label className="button primary"><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={!canEdit} onChange={(event) => handleFiles(Array.from(event.target.files ?? []))} />Take a photo</label>
              <label className="button secondary"><input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={!canEdit} onChange={(event) => handleFiles(Array.from(event.target.files ?? []))} />Choose from library</label>
            </div>
          </div>

          {facets.length ? (
            <div className="facetThumbRail" aria-label="Uploaded photos">
              {facets.map((facet, index) => (
                <button
                  key={facet.id}
                  type="button"
                  className={activeFacet?.id === facet.id ? "facetThumb isActive" : "facetThumb"}
                  onClick={() => setActiveFacetId(facet.id)}
                >
                  {facet.previewUrl ? (
                    <img src={facet.previewUrl} alt={`${facet.title} jewelry preview`} className="facetThumbImage" />
                  ) : (
                    <div className="facetThumbImage facetThumbImage--fallback">
                      <span>{facet.title}</span>
                    </div>
                  )}
                  <span className="facetThumbBadge">#{index + 1}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="fields">
            <div className="field">
              <label htmlFor="customerName">Customer name</label>
              <input
                id="customerName"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Optional"
                disabled={!canEdit}
              />
            </div>
            <div className="field">
              <label htmlFor="quoteMode">Quote mode</label>
              <select
                id="quoteMode"
                value={quoteMode}
                disabled={!canEdit}
                onChange={(event) => setQuoteMode(event.target.value as QuoteMode)}
              >
                {QUOTE_MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="muted small">{QUOTE_MODE_OPTIONS.find((option) => option.value === quoteMode)?.description}</p>
            </div>
            <div className="field">
              <label htmlFor="metalType">Metal type</label>
              <select
                id="metalType"
                value={metalType}
                disabled={!canEdit}
                onChange={(event) => setMetalType(event.target.value as MetalType)}
              >
                {["10K", "14K", "18K", "Platinum", "Silver"].map((metal) => (
                  <option key={metal} value={metal}>
                    {metal}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="customerNotes">Notes</label>
              <textarea
                id="customerNotes"
                rows={3}
                value={customerNotes}
                onChange={(event) => setCustomerNotes(event.target.value)}
                placeholder="Optional notes for the quote review."
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="sectionHeader quoteSectionHeader">
            <div>
              <h3>Step 2 - Facet analysis</h3>
              <p className="muted">Each uploaded image gets its own card. Use the card inputs to refine the resolved values.</p>
            </div>
          </div>

          <div className="facetGrid">
            {facets.length ? (
              facets.map((facet, index) => (
                <article
                  key={facet.id}
                  className={facet.id === activeFacet?.id ? "facetCard facetCard--active" : "facetCard"}
                >
                  <div className="facetCardHeader">
                    {facet.previewUrl ? (
                      <img src={facet.previewUrl} alt={`${facet.title} jewelry analysis`} className="facetCardImage" />
                    ) : (
                      <div className="facetCardImage facetCardImage--fallback">
                        <span>{facet.title}</span>
                      </div>
                    )}
                    <div className="facetCardHeading">
                      <div className="facetCardTitleRow">
                        <input
                          className="inlineTitleInput"
                          value={facet.title}
                          onChange={(event) =>
                            updateFacet(facet.id, (current) => ({ ...current, title: event.target.value }))
                          }
                          disabled={!canEdit}
                        />
                        <span className={`statusPill statusPill--${facet.status}`}>{facet.status}</span>
                      </div>
                      <div className="facetCardMeta">
                        <span className="monoCell">#{index + 1}</span>
                        <button
                          className="textLink"
                          type="button"
                          onClick={() =>
                            updateFacet(facet.id, (current) => ({ ...current, showDescription: !current.showDescription }))
                          }
                        >
                          {facet.showDescription ? "Hide description" : "+ Add description"}
                        </button>
                        <button className="textLink destructive" type="button" onClick={() => removeFacet(facet.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>

                  {facet.showDescription ? (
                    <textarea
                      className="facetDescription"
                      rows={2}
                      value={facet.description}
                      onChange={(event) =>
                        updateFacet(facet.id, (current) => ({ ...current, description: event.target.value }))
                      }
                      placeholder="Optional description for this facet."
                      disabled={!canEdit}
                    />
                  ) : null}

                  {facet.status === "processing" ? (
                    <div className="facetProgressList">
                      {ANALYSIS_STAGES.map((stage, stageIndex) => (
                        <div
                          key={stage}
                          className={stageIndex <= facet.stageIndex ? "facetProgressRow isActive" : "facetProgressRow"}
                        >
                          <span className="facetProgressDot" aria-hidden="true" />
                          <span>{stage}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {facet.status === "error" ? <p className="fieldError">{facet.error}</p> : null}

                  {facet.status === "done" && facet.output ? (
                    <div className="facetResolvedGrid">
                      <label className="facetResolvedField">
                        <span>Jewelry type</span>
                        <input
                          value={facet.output.jewelryType}
                          onChange={(event) => updateFacetOutput(facet.id, "jewelryType", event.target.value)}
                          disabled={!canEdit}
                        />
                      </label>
                      <label className="facetResolvedField">
                        <span>Metal weight (g)</span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={facet.output.metalWeightGrams}
                          onChange={(event) =>
                            updateFacetOutput(facet.id, "metalWeightGrams", Number(event.target.value) || 0)
                          }
                          disabled={!canEdit}
                        />
                      </label>
                      <label className="facetResolvedField">
                        <span>Center stone (ct)</span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={facet.output.centerDiamondCarats}
                          onChange={(event) =>
                            updateFacetOutput(facet.id, "centerDiamondCarats", Number(event.target.value) || 0)
                          }
                          disabled={!canEdit}
                        />
                      </label>
                      <label className="facetResolvedField">
                        <span>Side stones (ct)</span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={facet.output.sideDiamondCarats}
                          onChange={(event) =>
                            updateFacetOutput(facet.id, "sideDiamondCarats", Number(event.target.value) || 0)
                          }
                          disabled={!canEdit}
                        />
                      </label>
                      <label className="facetResolvedField">
                        <span>Side stone qty</span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={facet.output.sideDiamondQuantity}
                          onChange={(event) =>
                            updateFacetOutput(facet.id, "sideDiamondQuantity", Number(event.target.value) || 0)
                          }
                          disabled={!canEdit}
                        />
                      </label>
                      <label className="facetResolvedField">
                        <span>Center shape</span>
                        <input
                          value={facet.output.centerShape ?? ""}
                          onChange={(event) => updateFacetOutput(facet.id, "centerShape", event.target.value)}
                          disabled={!canEdit}
                        />
                      </label>
                      <label className="facetResolvedField">
                        <span>Confidence</span>
                        <input
                          value={facet.output.confidence}
                          onChange={(event) => updateFacetOutput(facet.id, "confidence", event.target.value)}
                          disabled={!canEdit}
                        />
                      </label>
                      <div className="facetResolvedNotes">
                        <span>Notes</span>
                        <p className="muted small">{facet.output.notes || "No notes provided."}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="emptyState emptyState--compact">
                      <strong>{facet.status === "pending" ? "Awaiting analysis" : "Ready to analyse"}</strong>
                      <p className="muted small">This card will populate after you run the AI review.</p>
                    </div>
                  )}
                </article>
              ))
            ) : (
              <div className="emptyState emptyStateIllustrated">
                <QuoteUploadIllustration />
                <strong>Drop in one or more jewelry photos to start the quote.</strong>
                <p className="muted">Each uploaded photo becomes a facet card with its own analysis and editable values.</p>
              </div>
            )}
          </div>
        </section>

        <section className="card previewCard">
          <div className="sectionHeader">
            <div>
              <h2>Step 3 - Review and generate</h2>
              <p className="muted">Approve the final customer price and save the quote when ready.</p>
            </div>
          </div>

          <div className="quotePreview">
            <p className="eyebrow">Quote price</p>
            <div className="quotePrice">{formatCurrency(previewPrice)}</div>
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
                <span>Facet count</span>
                <strong>{completedFacets.length} analysed</strong>
              </div>
            </div>
            {aggregateQuote?.notes ? <p className="muted small">{aggregateQuote.notes}</p> : null}
            <p className="disclaimer">
              Final pricing is an approved estimate, not a manufacturing invoice. Production review may change the
              quote after CAD, stone verification, or metal confirmation.
            </p>
          </div>

          <div className="buttonRow">
            <button
              className="button primary"
              type="button"
              disabled={!canEdit || saving || !aggregateQuote || draftIsFresh}
              onClick={() => persistQuote({ resetDraftAfterSave: false })}
            >
              {saving ? "Saving..." : "Save current draft"}
            </button>
            {savedQuote ? (
              <a className="button secondary" href={`/api/quotes/${savedQuote.id}/pdf`} target="_blank" rel="noreferrer">
                Download PDF
              </a>
            ) : null}
            <button className="button secondary" type="button" onClick={() => window.print()}>
              Print preview
            </button>
          </div>

          <div className="status" role="status" aria-live="polite">
            {status || "Ready to quote."}
          </div>
        </section>
      </div>
    </div>
  );
}

function QuoteUploadIllustration() {
  return (
    <svg className="emptyStateIllustration" viewBox="0 0 240 120" role="img" aria-label="Jewelry outline illustration">
      <path
        d="M64 56c12-16 30-24 56-24s44 8 56 24c-12 16-30 24-56 24s-44-8-56-24Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M72 68h96" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M103 58l17-20 17 20-17 26-17-26Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
