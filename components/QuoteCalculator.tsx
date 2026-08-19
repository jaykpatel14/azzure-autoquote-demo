"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type MetalType, type PricingProfileInput } from "@/lib/pricing";
import { mergeConfidence, median } from "@/lib/statistics";
import { useToast } from "@/components/toast-provider";
import { QuoteCreationLayout, QuoteStepCard, QuoteBuilderPreview } from "@/components/QuoteCreationLayout";
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
  companyName?: string;
  companyLogoUrl?: string | null;
  canShareQuoteLink?: boolean;
  canPlaceManufacturingOrder?: boolean;
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
    label: "Full jewelry piece",
    description: "Includes metal, center stone, and side stones."
  },
  {
    value: "without-center",
    label: "Semi-mount (no center)",
    description: "Calculates metal and side stones; center stone is supplied by customer."
  },
  {
    value: "without-center-and-side",
    label: "Mounting only (no stones)",
    description: "Calculates metal casting and labor only; all stones supplied by customer."
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
  pricingProfile,
  initialQuote,
  companyName,
  companyLogoUrl,
  canShareQuoteLink = false,
  canPlaceManufacturingOrder = false
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
  const [savingProgress, setSavingProgress] = useState(0);
  const [savedQuote, setSavedQuote] = useState<{ id: string; quoteNumber: string } | null>(null);
  const [renderingImageUrl, setRenderingImageUrl] = useState<string | null>(null);
  const [draftIsFresh, setDraftIsFresh] = useState(!initialQuote);
  const [generatingConcept, setGeneratingConcept] = useState(false);
  const [showroomMode, setShowroomMode] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const { showToast } = useToast();

  const facetsRef = useRef<FacetDraft[]>([]);
  const showroomFileInputRef = useRef<HTMLInputElement | null>(null);
  const lastAnalysedDescriptionRef = useRef("");

  function toggleNotes(id: string) {
    setExpandedNotes((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
    const textToUse = customText || customerNotes;
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
    setRenderingImageUrl(null);

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
        metalType,
        metalWeightGrams: aggregateQuote.metalWeightGrams,
        goldSpotPerOz: pricingProfile?.goldSpotPerOz ?? 4500,
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
  }, [aggregateQuote, cadCost, customerMarginPct, pricingTier, metalType, pricingProfile?.goldSpotPerOz]);

  const canAnalyse = canEdit && facets.some((facet) => facet.status === "pending" || facet.status === "error");

  function updateFacet(id: string, updater: (facet: FacetDraft) => FacetDraft) {
    setFacets((current) => current.map((facet) => (facet.id === id ? updater(facet) : facet)));
  }

  function handleFiles(selectedFiles: File[]) {
    if (!selectedFiles.length) return;

    setSavedQuote(null);
    setRenderingImageUrl(null);
    setDraftIsFresh(false);
    const nextFacets = selectedFiles.map((file, index) => ({
      id: uid(),
      file,
      previewUrl: URL.createObjectURL(file),
      isObjectUrl: true,
      title: `Photo ${facetsRef.current.length + index + 1}`,
      description: "",
      showDescription: false,
      status: "pending" as FacetStatus,
      stageIndex: 0,
      output: null,
      error: ""
    }));

    setFacets((current) => [...current, ...nextFacets]);
    setActiveFacetId((current) => current ?? nextFacets[0].id);
    setStatus("Analysing photos with AI...");

    // Auto-trigger analysis for all new photos
    Promise.all(nextFacets.map((facet) => analyseFacet(facet))).then(() => {
      setStatus("AI analysis complete. Adjust parameters below to refine the quote.");
    });
  }


  async function handleShowroomPhotoSelect(fileList: FileList | File[] | null) {
    if (!fileList || !fileList.length) return;
    const file = fileList[0];
    if (!file.type.startsWith("image/")) {
      showToast({
        message: "Please select an image file (JPG, PNG, or WEBP).",
        variant: "error"
      });
      return;
    }

    setSavedQuote(null);
    setRenderingImageUrl(null);
    setDraftIsFresh(false);
    const newFacet: FacetDraft = {
      id: uid(),
      file,
      previewUrl: URL.createObjectURL(file),
      isObjectUrl: true,
      title: "Showroom Reference",
      description: "",
      showDescription: false,
      status: "pending" as FacetStatus,
      stageIndex: 0,
      output: null,
      error: ""
    };

    setFacets([newFacet]);
    setActiveFacetId(newFacet.id);
    setStatus("Analyzing reference photo for live showroom quote...");
    showToast({
      message: "Analyzing photo for live showroom quote...",
      variant: "info"
    });
    await analyseFacet(newFacet);
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
    setRenderingImageUrl(null);
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
    setRenderingImageUrl(null);

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

  async function refreshAnalysisFromDescription() {
    const description = customerNotes.trim();
    if (!description || description === lastAnalysedDescriptionRef.current || !facetsRef.current.length) return;

    lastAnalysedDescriptionRef.current = description;
    setSavedQuote(null);
    setRenderingImageUrl(null);
    setStatus("Updating the AI analysis from the customer description...");
    await Promise.all(facetsRef.current.filter((facet) => facet.file).map((facet) => analyseFacet(facet)));
    setStatus("AI analysis and live quote updated automatically.");
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
    setSavingProgress(0);
    setStatus("Creating quote and realistic presentation rendering...");

    const progressTimer = window.setInterval(() => {
      setSavingProgress((current) => Math.min(90, current + 6));
    }, 1600);

    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId: aggregateQuote.analysisId,
          analysisIds: completedFacets.map((facet) => facet.output?.analysisId).filter(Boolean),
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
        renderingImageUrl?: string | null;
      };
      setSavingProgress(100);
      if (!response.ok) {
        setStatus(result.error || "Unable to save quote.");
        showToast({
          message: result.error || "Unable to save quote.",
          variant: "error",
          autoDismiss: false
        });
        return;
      }

      if (result.id && result.quoteNumber) {
        setSavedQuote({ id: result.id, quoteNumber: result.quoteNumber });
        setRenderingImageUrl(result.renderingImageUrl ?? null);
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
    } finally {
      window.clearInterval(progressTimer);
      setSaving(false);
    }
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

  return (
    <div className={`estimateWorkspace${showroomMode ? " showroomUnifiedWorkspace" : ""}`}>
      <div className="quoteWorkspaceModeBar">
        <div>
          <span className="eyebrow">{showroomMode ? "Showroom consultation" : "Jeweler workspace"}</span>
          <p className="muted small">Upload and describe once. Analysis, visualization, and pricing update automatically.</p>
        </div>
        <button
          type="button"
          className="button secondary button--sm"
          onClick={() => setShowroomMode((current) => !current)}
        >
          {showroomMode ? "Return to jeweler view" : "Open showroom view"}
        </button>
      </div>
      {/* Two-column layout: left steps / right preview */}
      <QuoteCreationLayout
        steps={
          <>
          {/* ── Step 1: Upload Reference Photos + Description ── */}
          <QuoteStepCard
            number="01"
            title="Reference Photos & Description"
            description="Upload inspiration photos and describe what your customer wants."
          >
            <div className="field quoteDesignDescription">
              <div className="charCountHeader">
                <label htmlFor="customerNotes">Describe the requested design <span className="muted small" style={{ fontWeight: 400 }}>(Optional)</span></label>
                <span className="charCountBadge">{customerNotes.length} / 1000</span>
              </div>
              <textarea
                id="customerNotes"
                rows={3}
                maxLength={1000}
                value={customerNotes}
                onChange={(event) => setCustomerNotes(event.target.value)}
                onBlur={() => {
                  if (facetsRef.current.length) void refreshAnalysisFromDescription();
                }}
                placeholder="Describe the piece, stone preferences, sizing, engravings, or changes you want..."
                disabled={!canEdit}
              />
              <p className="muted small">Add the description first, then upload the reference photos. AI uses both together automatically.</p>
            </div>

            <div
              className="dropzone dropzone--multi"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (!canEdit) return;
                handleFiles(Array.from(event.dataTransfer.files).filter(Boolean));
              }}
            >
              <div className="dropzoneContent">
                <div className="dropzoneIcon">
                  <span className="material-symbols-outlined" style={{ fontSize: 28, color: "var(--color-primary)" }}>cloud_upload</span>
                </div>
                <strong>Add customer reference photos</strong>
                <span className="muted small">JPG, PNG, or WEBP · up to 10 MB each</span>
              </div>
              <div className="dropzoneActions">
                <label className="button primary button--sm">
                  <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={!canEdit} onChange={(event) => handleFiles(Array.from(event.target.files ?? []))} />
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>photo_camera</span>
                  Take photo
                </label>
                <label className="button secondary button--sm">
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={!canEdit} onChange={(event) => handleFiles(Array.from(event.target.files ?? []))} />
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>folder_open</span>
                  Choose files
                </label>
              </div>
            </div>

            {/* Photo thumbnail strip */}
            {facets.length > 0 ? (
              <div className="facetThumbRail" aria-label="Uploaded photos">
                {facets.map((facet, index) => (
                  <button
                    key={facet.id}
                    type="button"
                    className={activeFacet?.id === facet.id ? "facetThumb isActive" : "facetThumb"}
                    onClick={() => setActiveFacetId(facet.id)}
                  >
                    {facet.previewUrl ? (
                      <img src={facet.previewUrl} alt={`Photo ${index + 1}`} className="facetThumbImage" />
                    ) : (
                      <div className="facetThumbImage facetThumbImage--fallback"><span>{index + 1}</span></div>
                    )}
                    <span className="facetThumbBadge">#{index + 1}</span>
                  </button>
                ))}
              </div>
            ) : null}

            {/* Customer info fields */}
            <div className="fields" style={{ marginTop: 16 }}>
              <div className="field">
                <label htmlFor="customerName">Customer name <span className="muted small" style={{ fontWeight: 400 }}>(Optional)</span></label>
                <input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Eleanor Vance"
                  disabled={!canEdit}
                />
              </div>
            </div>
          </QuoteStepCard>

          {/* ── Step 2: AI Analysis Results ── */}
          {facets.length > 0 ? (
            <QuoteStepCard
              number="02"
              title="AI Analysis"
              description="What the AI identified from your photos and description."
            >
              <div className="facetGrid">
                {facets.map((facet, index) => (
                  <article
                    key={facet.id}
                    className={facet.id === activeFacet?.id ? "facetCard facetCard--active" : "facetCard"}
                  >
                    <div className="facetCardHeader">
                      {facet.previewUrl ? (
                        <img src={facet.previewUrl} alt={`Photo ${index + 1} preview`} className="facetCardImage" />
                      ) : (
                        <div className="facetCardImage facetCardImage--fallback"><span>{facet.title}</span></div>
                      )}
                      <div className="facetCardHeading">
                        <div className="facetCardTitleRow">
                          <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{facet.title}</span>
                          <span className={`statusPill statusPill--${facet.status}`}>{facet.status}</span>
                        </div>
                        <div className="facetCardMeta">
                          <span className="monoCell">#{index + 1}</span>
                          <button className="textLink destructive" type="button" onClick={() => removeFacet(facet.id)}>
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Processing indicator */}
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

                    {/* AI analysis output — shown when done, notes hidden by default */}
                    {facet.status === "done" && facet.output ? (
                      <div className="facetResolvedGrid">
                        {/* AI type + key parameters — always visible */}
                        <label className="facetResolvedField">
                          <span>Jewelry type</span>
                          <input value={facet.output.jewelryType} readOnly disabled className="facetReadOnlyInput" />
                        </label>
                        <label className="facetResolvedField">
                          <span>Setting</span>
                          <input value={facet.output.settingType ?? ""} readOnly disabled className="facetReadOnlyInput" />
                        </label>
                        <label className="facetResolvedField">
                          <span>Center shape</span>
                          <input value={facet.output.centerShape ?? ""} readOnly disabled className="facetReadOnlyInput" />
                        </label>
                        <label className="facetResolvedField">
                          <span>Metal weight (g)</span>
                          <input value={facet.output.metalWeightGrams} readOnly disabled className="facetReadOnlyInput" />
                        </label>
                        <label className="facetResolvedField">
                          <span>Center stone (ct)</span>
                          <input value={facet.output.centerDiamondCarats} readOnly disabled className="facetReadOnlyInput" />
                        </label>
                        <label className="facetResolvedField">
                          <span>Side stones (ct)</span>
                          <input value={facet.output.sideDiamondCarats} readOnly disabled className="facetReadOnlyInput" />
                        </label>

                        {/* AI Notes — hidden by default, collapsible */}
                        {facet.output.notes ? (
                          <div className="facetFullWidth">
                            <button
                              type="button"
                              className="textLink"
                              style={{ fontSize: "var(--text-xs)", gap: 4 }}
                              onClick={() => toggleNotes(facet.id)}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                                {expandedNotes.has(facet.id) ? "expand_less" : "expand_more"}
                              </span>
                              {expandedNotes.has(facet.id) ? "Hide AI notes" : "Show AI notes"}
                            </button>
                            {expandedNotes.has(facet.id) ? (
                              <div className="facetResolvedNotes" style={{ marginTop: 8 }}>
                                <p className="muted small">{facet.output.notes}</p>
                                {facet.output.assumptions && facet.output.assumptions.length > 0 ? (
                                  <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: "var(--text-xs)", color: "var(--color-on-surface-variant)" }}>
                                    {facet.output.assumptions.map((a) => <li key={a}>{a}</li>)}
                                  </ul>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : facet.status === "pending" ? (
                      <div className="emptyState emptyState--compact">
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span className="material-symbols-outlined ai-pulse" style={{ fontSize: 20, color: "var(--color-primary)" }}>psychology</span>
                          <span className="muted small">AI is preparing to analyse this photo…</span>
                        </div>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </QuoteStepCard>
          ) : null}

          {/* ── Step 3: Customer Tweaks (auto-updates quote) ── */}
          {completedFacets.length > 0 ? (
            <QuoteStepCard
              number="03"
              title="Adjust Parameters"
              description="Tweak any value — the quote on the right updates automatically."
            >
              <div className="fields">
                <div className="field">
                  <label htmlFor="metalType">Metal type</label>
                  <select
                    id="metalType"
                    value={metalType}
                    disabled={!canEdit}
                    onChange={(e) => setMetalType(e.target.value as MetalType)}
                  >
                    {["10K", "14K", "18K", "Platinum", "Silver"].map((metal) => (
                      <option key={metal} value={metal}>{metal}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="quoteMode">Quote mode</label>
                  <select
                    id="quoteMode"
                    value={quoteMode}
                    disabled={!canEdit}
                    onChange={(e) => setQuoteMode(e.target.value as QuoteMode)}
                  >
                    {QUOTE_MODE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <p className="muted small">{QUOTE_MODE_OPTIONS.find((o) => o.value === quoteMode)?.description}</p>
                </div>
              </div>

              {/* Per-photo editable parameters */}
              <div className="facetGrid" style={{ marginTop: 16 }}>
                {facets.filter((f) => f.status === "done" && f.output).map((facet, index) => (
                  <article key={facet.id} className="facetCard">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      {facet.previewUrl ? (
                        <img src={facet.previewUrl} alt={`Photo ${index + 1}`} style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", objectFit: "cover", border: "1px solid var(--color-outline-variant)" }} />
                      ) : null}
                      <strong style={{ fontSize: "var(--text-sm)" }}>{facet.title}</strong>
                    </div>
                    <div className="facetResolvedGrid">
                      <label className="facetResolvedField">
                        <span>Metal weight (g)</span>
                        <input
                          type="number" min={0} step={0.01}
                          value={facet.output!.metalWeightGrams}
                          onChange={(e) => updateFacetOutput(facet.id, "metalWeightGrams", Number(e.target.value) || 0)}
                          disabled={!canEdit}
                        />
                      </label>
                      <label className="facetResolvedField">
                        <span>Center stone (ct)</span>
                        <input
                          type="number" min={0} step={0.01}
                          value={facet.output!.centerDiamondCarats}
                          onChange={(e) => updateFacetOutput(facet.id, "centerDiamondCarats", Number(e.target.value) || 0)}
                          disabled={!canEdit}
                        />
                      </label>
                      <label className="facetResolvedField">
                        <span>Center shape</span>
                        <input
                          value={facet.output!.centerShape ?? ""}
                          onChange={(e) => updateFacetOutput(facet.id, "centerShape", e.target.value)}
                          disabled={!canEdit}
                          placeholder="e.g. Oval, Round"
                        />
                      </label>
                      <label className="facetResolvedField">
                        <span>Side stones (ct)</span>
                        <input
                          type="number" min={0} step={0.01}
                          value={facet.output!.sideDiamondCarats}
                          onChange={(e) => updateFacetOutput(facet.id, "sideDiamondCarats", Number(e.target.value) || 0)}
                          disabled={!canEdit}
                        />
                      </label>
                      <label className="facetResolvedField">
                        <span>Side stone qty</span>
                        <input
                          type="number" min={0} step={1}
                          value={facet.output!.sideDiamondQuantity}
                          onChange={(e) => updateFacetOutput(facet.id, "sideDiamondQuantity", Number(e.target.value) || 0)}
                          disabled={!canEdit}
                        />
                      </label>
                      <label className="facetResolvedField">
                        <span>Setting type</span>
                        <input
                          value={facet.output!.settingType ?? ""}
                          onChange={(e) => updateFacetOutput(facet.id, "settingType", e.target.value)}
                          disabled={!canEdit}
                          placeholder="e.g. Prong, Bezel"
                        />
                      </label>
                      <div className="facetCheckboxGroup facetFullWidth">
                        <label className="facetCheckboxLabel">
                          <input
                            type="checkbox"
                            checked={facet.output!.hasWeddingBand ?? false}
                            onChange={(e) => updateFacetOutput(facet.id, "hasWeddingBand", e.target.checked)}
                            disabled={!canEdit}
                          />
                          <span>Ring + wedding band (2 pieces)</span>
                        </label>
                        <label className="facetCheckboxLabel">
                          <input
                            type="checkbox"
                            checked={facet.output!.isTwoTone ?? false}
                            onChange={(e) => updateFacetOutput(facet.id, "isTwoTone", e.target.checked)}
                            disabled={!canEdit}
                          />
                          <span>Two-tone gold</span>
                        </label>
                      </div>
                    </div>
                  </article>
                ))}
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
                <p className="muted small">Updates automatically as the design changes.</p>
              </div>
            </div>

            {/* AI Generated Image */}
            <div className="quotePreviewImageFrame">
              {renderingImageUrl || activeFacet?.previewUrl ? (
                <img
                  src={renderingImageUrl ?? activeFacet?.previewUrl ?? ""}
                  alt="AI generated jewelry visualization"
                  className="quotePreviewImage"
                />
              ) : (
                <div className="quotePreviewImagePlaceholder">
                  <span className="material-symbols-outlined" style={{ fontSize: 40, color: "var(--color-outline-variant)" }}>diamond</span>
                  <p className="muted small" style={{ margin: "8px 0 0", textAlign: "center" }}>Upload photos or describe a design to see the AI visualization here</p>
                </div>
              )}
              {activeFacet?.status === "processing" ? (
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

            {/* Live Quote Price */}
            <div className="quotePreviewPriceBlock">
              <p className="eyebrow" style={{ marginBottom: 4 }}>Live Estimate</p>
              <div className="quotePrice" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>
                {formatCurrency(estimatedSellingPrice)}
              </div>
              <div className="quoteMeta" style={{ marginTop: 12 }}>
                <div>
                  <span>Customer</span>
                  <strong>{customerName || "Unassigned"}</strong>
                </div>
                <div>
                  <span>Metal</span>
                  <strong>{metalType}</strong>
                </div>
                <div>
                  <span>Mode</span>
                  <strong>{QUOTE_MODE_OPTIONS.find((o) => o.value === quoteMode)?.label ?? quoteMode}</strong>
                </div>
                <div>
                  <span>Photos</span>
                  <strong>{completedFacets.length} analysed</strong>
                </div>
              </div>
              <p className="disclaimer" style={{ marginTop: 12 }}>
                Final pricing is an approved estimate. Production review may adjust after CAD and stone verification.
              </p>
            </div>

            {/* Save + PDF actions */}
            <div className="quotePreviewActions">
              <button
                className="button primary"
                style={{ width: "100%" }}
                type="button"
                disabled={!canEdit || saving || !aggregateQuote || draftIsFresh}
                onClick={() => persistQuote({ resetDraftAfterSave: false })}
              >
                {saving ? (
                  <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>hourglass_top</span> Saving…</>
                ) : (
                  <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span> Save Quote</>
                )}
              </button>
              {savedQuote ? (
                <a
                  className="button secondary"
                  style={{ width: "100%" }}
                  href={`/api/quotes/${savedQuote.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
                  Download PDF
                </a>
              ) : null}
              {savedQuote && canShareQuoteLink ? (
                <a className="button secondary" style={{ width: "100%" }} href={`/quotes/${savedQuote.id}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>ios_share</span>
                  Share with Customer
                </a>
              ) : null}
              {savedQuote && canPlaceManufacturingOrder ? (
                <a className="button secondary" style={{ width: "100%" }} href={`/quotes/${savedQuote.id}`}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>precision_manufacturing</span>
                  Send to Manufacturing
                </a>
              ) : null}
            </div>

            {/* Status message */}
            {status ? (
              <div className="status" role="status" aria-live="polite" style={{ marginTop: 8 }}>
                {status}
              </div>
            ) : null}
          </QuoteBuilderPreview>
        }
      />
    </div>
  );
}
