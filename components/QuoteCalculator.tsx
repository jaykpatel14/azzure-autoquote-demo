"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type MetalType, type PricingProfileInput } from "@/lib/pricing";
import { mergeConfidence, median } from "@/lib/statistics";
import { useToast } from "@/components/toast-provider";
import {
  calculateMakingPrice as calculateProductionCost,
  calculateTierPrice,
  DEFAULT_COLOR_CLARITY
} from "@/src/services/pricing";
import type { PricingTier } from "@prisma/client";

type QuoteMode = "normal" | "without-center" | "without-center-and-side";
type FacetStatus = "pending" | "processing" | "done" | "error";

type FacetOutput = {
  analysisId?: string;
  jewelryType: string;
  centerShape?: string | null;
  centerClarity?: string | null;
  settingType?: string | null;
  metalWeightGrams: number;
  centerDiamondCarats: number;
  sideDiamondCarats: number;
  sideDiamondQuantity: number;
  hasWeddingBand?: boolean;
  isTwoTone?: boolean;
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
  centerClarity: string;
  settingType?: string;
  metalWeightGrams: number;
  centerDiamondCarats: number;
  sideDiamondCarats: number;
  sideDiamondQuantity: number;
  hasWeddingBand: boolean;
  isTwoTone: boolean;
  confidence: "low" | "medium" | "high";
  assumptions: string[];
  notes: string;
  analysisId?: string;
};

type QuoteCalculatorProps = {
  canEdit: boolean;
  pricingTier?: PricingTier;
  customerMarginPct?: number;
  cadCost?: number;
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
    centerClarity: string | null;
    settingType: string | null;
    confidence: string | null;
    notes: string | null;
    assumptions: string[] | null;
  };
};

const ANALYSIS_STAGES = [
  "Analysing metal & piece composition...",
  "Estimating diamond specs & settings...",
  "Calculating weight..."
] as const;

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
  pricingTier = "TIER_2",
  customerMarginPct = 0,
  cadCost = 0,
  initialQuote
}: QuoteCalculatorProps) {
  const [metalType, setMetalType] = useState<MetalType>(initialQuote?.metalType ?? "14K");
  const [quoteMode, setQuoteMode] = useState<QuoteMode>("normal");
  const [customerName, setCustomerName] = useState(initialQuote?.customerName ?? "");
  const [customerNotes, setCustomerNotes] = useState("");
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
              centerShape: initialQuote.centerShape ?? "round",
              centerClarity: DEFAULT_COLOR_CLARITY,
              settingType: initialQuote.settingType ?? "prong",
              metalWeightGrams: initialQuote.metalWeightGrams,
              centerDiamondCarats: initialQuote.centerDiamondCarats,
              sideDiamondCarats: initialQuote.sideDiamondCarats,
              sideDiamondQuantity: initialQuote.sideDiamondQuantity,
              hasWeddingBand: false,
              isTwoTone: false,
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
  const [inputMode, setInputMode] = useState<"photos" | "prompt">("photos");
  const [conceptPrompt, setConceptPrompt] = useState("");
  const [generatingConcept, setGeneratingConcept] = useState(false);
  const [showroomMode, setShowroomMode] = useState(false);
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

  async function generateConcept(customText?: string) {
    const textToUse = customText || conceptPrompt;
    if (!textToUse.trim()) {
      showToast({
        message: "Please enter a design description first.",
        variant: "warning",
        autoDismiss: false
      });
      return;
    }

    setGeneratingConcept(true);
    setStatus("Synthesizing jewelry design concept and calculating live quote...");
    setSavedQuote(null);

    try {
      const response = await fetch("/api/concept/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: textToUse,
          metalType,
          customerNotes: customerNotes || undefined
        })
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || "Concept generation failed.");
      }

      const result = await response.json();
      const newFacet: FacetDraft = {
        id: `concept-${Date.now()}`,
        file: undefined,
        title: result.centerShape ? `${result.centerShape} ${result.jewelryType || "Ring"}` : "AI Concept",
        description: textToUse,
        showDescription: false,
        previewUrl: result.imageDataUrl || "",
        isObjectUrl: false,
        status: "done",
        stageIndex: 0,
        error: "",
        output: {
          analysisId: result.analysisId,
          jewelryType: result.jewelryType || "Ring",
          centerShape: result.centerShape ?? "oval",
          centerClarity: result.centerClarity ?? DEFAULT_COLOR_CLARITY,
          settingType: result.settingType ?? "prong",
          metalWeightGrams: result.metalWeightGrams,
          centerDiamondCarats: result.centerDiamondCarats,
          sideDiamondCarats: result.sideDiamondCarats,
          sideDiamondQuantity: result.sideDiamondQuantity,
          hasWeddingBand: result.hasWeddingBand ?? false,
          isTwoTone: result.isTwoTone ?? false,
          confidence: result.confidence ?? "high",
          notes: result.notes ?? `Customer Concept: ${textToUse}`,
          assumptions: result.assumptions ?? []
        }
      };

      setFacets([newFacet]);
      setActiveFacetId(newFacet.id);
      setDraftIsFresh(false);
      setStatus("AI concept visualization and dynamic quote generated!");
      showToast({
        message: "AI concept synthesized and dynamic quote calculated!",
        variant: "success",
        autoDismiss: true
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate concept.";
      setStatus(message);
      showToast({
        message,
        variant: "error",
        autoDismiss: false
      });
    } finally {
      setGeneratingConcept(false);
    }
  }

  useEffect(() => {
    if (initialQuote) {
      setStatus(`Editing quote ${initialQuote.quoteNumber}.`);
    }
  }, [initialQuote]);

  const completedFacets = facets.filter((facet) => facet.status === "done" && facet.output);
  const aggregateQuote = useMemo<AggregateQuote | null>(() => {
    if (!completedFacets.length) return null;

    const outputs = completedFacets.map((facet) => facet.output!).map((output) => applyQuoteMode(output, quoteMode));
    const hasWeddingBand = outputs.some((o) => o.hasWeddingBand);
    const isTwoTone = outputs.some((o) => o.isTwoTone);

    return {
      jewelryType: chooseMode(outputs.map((output) => output.jewelryType)) || "Jewelry",
      centerShape: chooseMode(outputs.map((output) => output.centerShape ?? "").filter(Boolean)) || "round",
      centerClarity: DEFAULT_COLOR_CLARITY,
      settingType: chooseMode(outputs.map((output) => output.settingType ?? "").filter(Boolean)) || "prong",
      metalWeightGrams: Number(median(outputs.map((output) => output.metalWeightGrams)).toFixed(2)),
      centerDiamondCarats: Number(median(outputs.map((output) => output.centerDiamondCarats)).toFixed(2)),
      sideDiamondCarats: Number(median(outputs.map((output) => output.sideDiamondCarats)).toFixed(2)),
      sideDiamondQuantity: Math.round(median(outputs.map((output) => output.sideDiamondQuantity))),
      hasWeddingBand,
      isTwoTone,
      confidence: mergeConfidence(outputs.map((output) => output.confidence)),
      assumptions: mergeAssumptions(outputs),
      notes:
        mergeAssumptions(outputs).length > 0
          ? `AI review values are approximate. Assumptions: ${mergeAssumptions(outputs).join(" | ")}`
          : "AI review values are approximate.",
      analysisId: completedFacets[0]?.output?.analysisId
    };
  }, [completedFacets, quoteMode]);

  // Recalculate production cost & end customer price client-side in real-time
  const { costBreakdown, estimatedSellingPrice } = useMemo<{
    costBreakdown: unknown;
    estimatedSellingPrice: number;
  }>(() => {
    if (!aggregateQuote) return { costBreakdown: null, estimatedSellingPrice: 0 };

    const centerCarat = Math.max(aggregateQuote.centerDiamondCarats, 0.0001);
    const sideStones =
      aggregateQuote.sideDiamondQuantity > 0 && aggregateQuote.sideDiamondCarats > 0
        ? [
            {
              shape: "round",
              caratWeightEach: aggregateQuote.sideDiamondCarats / aggregateQuote.sideDiamondQuantity,
              count: aggregateQuote.sideDiamondQuantity,
              settingType: aggregateQuote.settingType || "prong"
            }
          ]
        : [];

    try {
      const breakdown = calculateProductionCost({
        centerStone: {
          shape: aggregateQuote.centerShape || "round",
          caratWeight: centerCarat
        },
        sideStones,
        hasWeddingBand: aggregateQuote.hasWeddingBand,
        isTwoTone: aggregateQuote.isTwoTone,
        colorClarity: DEFAULT_COLOR_CLARITY,
        cadCost,
        customerMarginPct
      });

      const totalCost = breakdown.subtotal + breakdown.customerMarginAmount;
      const tierResult = calculateTierPrice(totalCost, pricingTier);
      return {
        costBreakdown: breakdown,
        estimatedSellingPrice: tierResult.estimatedSellingPrice
      };
    } catch {
      return { costBreakdown: null, estimatedSellingPrice: 0 };
    }
  }, [aggregateQuote, cadCost, customerMarginPct, pricingTier]);

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

  async function sendAnalysisRequest(file: File, metal: MetalType, description?: string) {
    const formData = new FormData();
    formData.append("image", file);
    formData.append("metalType", metal);
    if (description) {
      formData.append("description", description);
    }

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
      const response = await sendAnalysisRequest(facet.file, metalType, facet.description || customerNotes);
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
          centerShape: result.centerShape ?? "round",
          centerClarity: DEFAULT_COLOR_CLARITY,
          settingType: result.settingType ?? "prong",
          metalWeightGrams: result.metalWeightGrams,
          centerDiamondCarats: result.centerDiamondCarats,
          sideDiamondCarats: result.sideDiamondCarats,
          sideDiamondQuantity: result.sideDiamondQuantity,
          hasWeddingBand: result.hasWeddingBand ?? false,
          isTwoTone: result.isTwoTone ?? false,
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
    if (!aggregateQuote || !costBreakdown) {
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
    setStatus("Creating quote and realistic presentation rendering...");

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
        centerShape: aggregateQuote.centerShape ?? "round",
        centerClarity: DEFAULT_COLOR_CLARITY,
        settingType: aggregateQuote.settingType ?? "prong",
        customerNotes,
        notes: customerNotes,
        hasWeddingBand: aggregateQuote.hasWeddingBand,
        isTwoTone: aggregateQuote.isTwoTone
      })
    });

    const result = (await response.json().catch(() => ({}))) as {
      id?: string;
      quoteNumber?: string;
      error?: string;
      renderingStatus?: "COMPLETED" | "FAILED";
      renderingError?: string;
    };
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
      const renderingFailed = result.renderingStatus === "FAILED";
      setStatus(
        renderingFailed
          ? `Quote ${result.quoteNumber} saved, but its rendering could not be created. You can still download the quote.`
          : `Quote ${result.quoteNumber} and its realistic rendering are ready. You can download the PDF or open the public view.`
      );
      showToast({
        message: renderingFailed
          ? `Quote ${result.quoteNumber} saved without a rendering.`
          : `Quote ${result.quoteNumber} and rendering created successfully.`,
        variant: renderingFailed ? "warning" : "success",
        autoDismiss: !renderingFailed
      });
      if (options?.resetDraftAfterSave) {
        setDraftIsFresh(true);
      }
    }

    setSaving(false);
  }

  function updateFacetOutput(id: string, field: keyof FacetOutput, value: string | number | boolean) {
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

  const PROMPT_SUGGESTIONS = [
    "14K White Gold Oval Solitaire with Hidden Halo",
    "18K Yellow Gold Cushion Pavé Halo with Split Shank",
    "Platinum 3-Stone Emerald Cut with Tapered Baguettes",
    "14K Rose Gold Vintage Bezel-Set Oval Ring",
    "18K Two-Tone Radiant Cut with Diamond Pavé Band"
  ];

  return (
    <div className={showroomMode ? "estimateWorkspace showroomMode" : "estimateWorkspace"}>
      <div className="workspaceActionBar">
        <div className="consultationPill">
          <span className="consultationDot" aria-hidden="true" />
          <span>{showroomMode ? "WOW Showroom Consultation Active" : "In-Store Quoting Station"}</span>
        </div>
        <button
          type="button"
          className={`button ${showroomMode ? "primary" : "secondary"} button--sm`}
          onClick={() => setShowroomMode((prev) => !prev)}
        >
          {showroomMode ? "✓ Showroom Kiosk Mode" : "📺 Enable Showroom Mode"}
        </button>
      </div>

      <section className="statGrid quoteStepGrid" aria-label="Quote creation steps">
        <article className="statCard">
          <span className="eyebrow">Step 1</span>
          <strong>{inputMode === "photos" ? "Upload Photos" : "Describe Concept"}</strong>
          <p className="muted small">
            {inputMode === "photos"
              ? "Add jewelry photos or snap with tablet camera."
              : "Describe customer dream ring for instant AI synthesis."}
          </p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Step 2</span>
          <strong>AI Analysis &amp; 3D Render</strong>
          <p className="muted small">Extracted specifications with real-time jewelry parameters.</p>
        </article>
        <article className="statCard">
          <span className="eyebrow">Step 3</span>
          <strong>Live Retail Quote</strong>
          <p className="muted small">Spot precious metal rates + store margin computed instantly.</p>
        </article>
      </section>

      <div className="twoColumnLayout">
        <section className="card formCard">
          <div className="sectionHeader">
            <div>
              <h2>Step 1 · {inputMode === "photos" ? "Reference Photos" : "Describe Design Concept"}</h2>
              <p className="muted">
                {inputMode === "photos"
                  ? "Drop photos here or use tablet camera. JPG, PNG, or WEBP up to 10 MB."
                  : "Type what your customer wants and AI will create a 3D visualization and extract specs."}
              </p>
            </div>
            {inputMode === "photos" ? (
              <div className="buttonRow">
                <button className="button secondary button--sm" type="button" disabled={!canEdit || !facets.length} onClick={clearAllFacets}>
                  Clear all
                </button>
                <button className="button primary button--sm" type="button" disabled={!canAnalyse} onClick={analyseAll}>
                  Analyse Photos
                </button>
              </div>
            ) : null}
          </div>

          <div className="inputModeTabs" role="tablist" aria-label="Input mode selection">
            <button
              type="button"
              className={`inputModeTab${inputMode === "photos" ? " isActive" : ""}`}
              onClick={() => setInputMode("photos")}
              role="tab"
              aria-selected={inputMode === "photos"}
            >
              📷 Reference Photos
            </button>
            <button
              type="button"
              className={`inputModeTab${inputMode === "prompt" ? " isActive" : ""}`}
              onClick={() => setInputMode("prompt")}
              role="tab"
              aria-selected={inputMode === "prompt"}
            >
              ✨ Describe Design Idea
            </button>
          </div>

          {inputMode === "prompt" ? (
            <div className="conceptPromptBox">
              <label htmlFor="conceptPromptInput" className="conceptPromptLabel">
                Describe the custom jewelry piece
              </label>
              <textarea
                id="conceptPromptInput"
                className="conceptPromptTextarea"
                rows={3}
                value={conceptPrompt}
                onChange={(e) => setConceptPrompt(e.target.value)}
                placeholder="e.g., 14K White Gold Oval 1.5ct Solitaire with Hidden Halo and thin Pavé diamond band..."
                disabled={generatingConcept || !canEdit}
              />
              <div className="conceptSuggestions">
                <span className="conceptSuggestionsTitle">Inspiration presets:</span>
                <div className="conceptChips">
                  {PROMPT_SUGGESTIONS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="conceptChip"
                      onClick={() => {
                        setConceptPrompt(preset);
                        generateConcept(preset);
                      }}
                      disabled={generatingConcept || !canEdit}
                    >
                      + {preset}
                    </button>
                  ))}
                </div>
              </div>
              <div className="conceptActionRow">
                <button
                  type="button"
                  className="button primary button--lg fitContent"
                  disabled={generatingConcept || !conceptPrompt.trim() || !canEdit}
                  onClick={() => generateConcept()}
                >
                  {generatingConcept ? "✨ Synthesizing 3D Concept & Quote..." : "✨ Synthesize Concept & Live Quote"}
                </button>
              </div>
            </div>
          ) : (
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
              <div className="dropzoneContent">
                <svg className="dropzoneIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
                </svg>
                <strong>Drag &amp; drop jewelry photos</strong>
                <span className="muted small">Take a new photo or select JPG, PNG, or WEBP files up to 10 MB.</span>
              </div>
              <div className="dropzoneActions">
                <label className="button primary button--sm">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    disabled={!canEdit}
                    onChange={(event) => handleFiles(Array.from(event.target.files ?? []))}
                  />
                  Take photo
                </label>
                <label className="button secondary button--sm">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    disabled={!canEdit}
                    onChange={(event) => handleFiles(Array.from(event.target.files ?? []))}
                  />
                  Choose from files
                </label>
              </div>
            </div>
          )}

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
                    <img src={facet.previewUrl} alt={`${facet.title} preview`} className="facetThumbImage" />
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
                placeholder="e.g. Eleanor Vance (Optional)"
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
              <div className="charCountHeader">
                <label htmlFor="customerNotes">
                  Photo description &amp; special instructions <span className="muted small font-normal">(Optional)</span>
                </label>
                <span className="charCountBadge">
                  {customerNotes.length} / 1000
                </span>
              </div>
              <textarea
                id="customerNotes"
                rows={3}
                maxLength={1000}
                value={customerNotes}
                onChange={(event) => setCustomerNotes(event.target.value)}
                placeholder="Optional: Detail styling preferences, stone requests, custom engravings, or sizing..."
                disabled={!canEdit}
              />
              <p className="muted small">
                Help the AI and team understand key design details for this quote.
              </p>
            </div>
          </div>

          <div className="sectionHeader quoteSectionHeader">
            <div>
              <h3>Step 2 · Facet Analysis</h3>
              <p className="muted">Each uploaded image is broken down below. Values update real-time pricing automatically.</p>
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
                          {facet.showDescription ? "Hide description" : (facet.description ? "Edit photo description" : "+ Add photo description")}
                        </button>
                        <button className="textLink destructive" type="button" onClick={() => removeFacet(facet.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>

                  {facet.showDescription || facet.description ? (
                    <div className="facetDescPanel">
                      <div className="charCountHeader">
                        <span className="fieldLabel">
                          Photo explanation <span className="muted small font-normal">(Optional)</span>
                        </span>
                        <span className="charCountBadge">
                          {facet.description.length} / 1000
                        </span>
                      </div>
                      <textarea
                        className="facetDescription"
                        rows={2}
                        maxLength={1000}
                        value={facet.description}
                        onChange={(event) =>
                          updateFacet(facet.id, (current) => ({ ...current, description: event.target.value }))
                        }
                        placeholder="Optional description explaining this specific photo (max 1000 characters)..."
                        disabled={!canEdit}
                      />
                    </div>
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
                        <span>Center shape</span>
                        <input
                          value={facet.output.centerShape ?? ""}
                          onChange={(event) => updateFacetOutput(facet.id, "centerShape", event.target.value)}
                          disabled={!canEdit}
                          placeholder="e.g. Oval, Round, Cushion"
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
                        <span>Setting type</span>
                        <input
                          value={facet.output.settingType ?? ""}
                          onChange={(event) => updateFacetOutput(facet.id, "settingType", event.target.value)}
                          disabled={!canEdit}
                          placeholder="e.g. Prong, Bezel, Pavé"
                        />
                      </label>

                      {/* Color / Clarity: Fixed read-only display */}
                      <div
                        className="facetResolvedField"
                        title="Color and clarity are standardised to E VS1 for all quotes"
                      >
                        <span>Color / Clarity</span>
                        <input
                          value="E VS1 (standard)"
                          readOnly
                          disabled
                          className="facetReadOnlyInput"
                        />
                      </div>

                      {/* Piece configuration toggles */}
                      <div className="facetCheckboxGroup">
                        <label className="facetCheckboxLabel">
                          <input
                            type="checkbox"
                            checked={facet.output.hasWeddingBand ?? false}
                            onChange={(event) =>
                              updateFacetOutput(facet.id, "hasWeddingBand", event.target.checked)
                            }
                            disabled={!canEdit}
                          />
                          <span>Ring + wedding band (2 pieces)</span>
                        </label>
                        <label className="facetCheckboxLabel">
                          <input
                            type="checkbox"
                            checked={facet.output.isTwoTone ?? false}
                            onChange={(event) =>
                              updateFacetOutput(facet.id, "isTwoTone", event.target.checked)
                            }
                            disabled={!canEdit}
                          />
                          <span>Two-tone gold (2 pieces)</span>
                        </label>
                      </div>

                      <div className="facetResolvedNotes facetFullWidth">
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
              <h2>Step 3 · Review &amp; Generate</h2>
              <p className="muted">Approve the estimated price and save to company records.</p>
            </div>
          </div>

          <div className="quotePreview">
            <p className="eyebrow">Quote Price</p>
            <div className="quotePrice">{formatCurrency(estimatedSellingPrice)}</div>
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
                <span>Facets</span>
                <strong>{completedFacets.length} analysed</strong>
              </div>
            </div>
            {aggregateQuote?.notes ? <p className="muted small quoteSummaryNotes">{aggregateQuote.notes}</p> : null}
            <p className="disclaimer">
              Final pricing is an approved estimate, not a manufacturing invoice. Production review may change the
              quote after CAD, stone verification, or metal confirmation.
            </p>
          </div>

          <div className="buttonRow quoteActionButtons">
            <button
              className="button primary"
              type="button"
              disabled={!canEdit || saving || !aggregateQuote || draftIsFresh}
              onClick={() => persistQuote({ resetDraftAfterSave: false })}
            >
              {saving ? "Creating quote and rendering..." : "Get the quote"}
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
