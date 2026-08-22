"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { convertMetalWeight, type MetalType, type PricingProfileInput } from "@/lib/pricing";
import { mergeConfidence, median } from "@/lib/statistics";
import { validateEmail } from "@/lib/email-validation";
import { useToast } from "@/components/toast-provider";
import { QuoteCreationLayout, QuoteStepCard, QuoteBuilderPreview } from "@/components/QuoteCreationLayout";
import {
  calculateMakingPrice as calculateProductionCost,
  calculateTierPrice,
  DEFAULT_COLOR_CLARITY
} from "@/src/services/pricing";
import { getCenterStonePricePerCarat } from "@/src/services/diamond-pricing";
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
  renderingImageUrl?: string | null;
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
    customerEmail?: string | null;
    customerPhone?: string | null;
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
  assignedCompanyId?: string;
  companyLogoUrl?: string | null;
  canShareQuoteLink?: boolean;
  canPlaceManufacturingOrder?: boolean;
  canDownloadPdf?: boolean;
};

const ANALYSIS_STAGES = [
  "Analysing metal & piece composition...",
  "Estimating diamond specs & settings...",
  "Calculating weight..."
] as const;

const LAB_COLOR_CLARITIES = ["D", "E", "F", "G/H"].flatMap((color) =>
  ["VVS1", "VVS2", "VS1", "VS2", "SI1"].map((clarity) => `${color} ${clarity}`)
);
const NATURAL_COLOR_CLARITIES = ["D", "E", "F", "G", "H", "I", "J", "K", "L", "M"].flatMap((color) =>
  ["IF", "VVS1", "VVS2", "VS1", "VS2", "SI1"].map((clarity) => `${color} ${clarity}`)
);

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

const MANUAL_PRESETS: Array<{
  name: string;
  jewelryType: string;
  metalType: MetalType;
  metalWeight: number;
  centerShape: string;
  centerCarats: number;
  settingType: string;
  sideCount: number;
  sideCarats: number;
  hasWeddingBand: boolean;
}> = [
  {
    name: "1.0ct Solitaire Ring",
    jewelryType: "Ring",
    metalType: "14K",
    metalWeight: 4.2,
    centerShape: "round",
    centerCarats: 1.0,
    settingType: "prong",
    sideCount: 0,
    sideCarats: 0,
    hasWeddingBand: false
  },
  {
    name: "1.5ct Oval Halo Ring",
    jewelryType: "Engagement Ring",
    metalType: "18K",
    metalWeight: 4.8,
    centerShape: "oval",
    centerCarats: 1.5,
    settingType: "pave",
    sideCount: 24,
    sideCarats: 0.36,
    hasWeddingBand: false
  },
  {
    name: "Three-Stone Emerald Ring",
    jewelryType: "Ring",
    metalType: "Platinum",
    metalWeight: 5.4,
    centerShape: "emerald",
    centerCarats: 1.25,
    settingType: "prong",
    sideCount: 2,
    sideCarats: 0.4,
    hasWeddingBand: false
  },
  {
    name: "Pavé Diamond Band",
    jewelryType: "Wedding Band",
    metalType: "14K",
    metalWeight: 3.6,
    centerShape: "round",
    centerCarats: 0,
    settingType: "pave",
    sideCount: 26,
    sideCarats: 0.39,
    hasWeddingBand: false
  },
  {
    name: "Diamond Tennis Bracelet",
    jewelryType: "Bracelet",
    metalType: "18K",
    metalWeight: 12.0,
    centerShape: "round",
    centerCarats: 0,
    settingType: "prong",
    sideCount: 48,
    sideCarats: 4.0,
    hasWeddingBand: false
  },
  {
    name: "Classic Wedding Band",
    jewelryType: "Wedding Band",
    metalType: "14K",
    metalWeight: 5.0,
    centerShape: "round",
    centerCarats: 0,
    settingType: "flush",
    sideCount: 0,
    sideCarats: 0,
    hasWeddingBand: false
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
  assignedCompanyId,
  canShareQuoteLink = false,
  canPlaceManufacturingOrder = false,
  canDownloadPdf = false
}: QuoteCalculatorProps) {

  const [metalType, setMetalType] = useState<MetalType>(initialQuote?.metalType ?? "14K");
  const [quoteMode, setQuoteMode] = useState<QuoteMode>("normal");
  const [customerName, setCustomerName] = useState(initialQuote?.customerName ?? "");
  const [customerEmail, setCustomerEmail] = useState(initialQuote?.customerEmail ?? "");
  const [customerPhone, setCustomerPhone] = useState(initialQuote?.customerPhone ?? "");
  const [customerNotes, setCustomerNotes] = useState("");

  // Creation Mode: AI Photo Analysis vs. Manual Spec Direct Quoting
  type CreationMode = "ai" | "manual";
  const [creationMode, setCreationMode] = useState<CreationMode>("ai");

  // Manual direct quote specific states
  const [manualJewelryType, setManualJewelryType] = useState<string>(initialQuote?.jewelryType ?? "Ring");
  const [manualMetalWeight, setManualMetalWeight] = useState<number>(initialQuote?.metalWeightGrams ?? 4.5);
  const [quantity, setQuantity] = useState<number>(1);
  const [stoneOrigin, setStoneOrigin] = useState<"lab" | "natural" | "gemstone">("lab");
  const [manualCenterShape, setManualCenterShape] = useState<string>(initialQuote?.centerShape ?? "round");
  const [manualCenterCarats, setManualCenterCarats] = useState<number>(initialQuote?.centerDiamondCarats ?? 1.0);
  const [manualCenterClarity, setManualCenterClarity] = useState<string>(DEFAULT_COLOR_CLARITY);
  const [manualSideCount, setManualSideCount] = useState<number>(initialQuote?.sideDiamondQuantity ?? 0);
  const [manualSideCarats, setManualSideCarats] = useState<number>(initialQuote?.sideDiamondCarats ?? 0);
  const [manualRoundSideCount, setManualRoundSideCount] = useState<number>(initialQuote?.sideDiamondQuantity ?? 0);
  const [manualRoundSideCarats, setManualRoundSideCarats] = useState<number>(initialQuote?.sideDiamondCarats ?? 0);
  const [manualFancySideCount, setManualFancySideCount] = useState<number>(0);
  const [manualFancySideCarats, setManualFancySideCarats] = useState<number>(0);
  const [manualSideShapes, setManualSideShapes] = useState<Array<"round" | "fancy">>(["round"]);
  const [manualRoundSideSettings, setManualRoundSideSettings] = useState<string[]>(["prong"]);
  const [manualFancySideSettings, setManualFancySideSettings] = useState<string[]>(["prong"]);
  const [manualSettingType, setManualSettingType] = useState<string>(initialQuote?.settingType ?? "prong");
  const [manualHasWeddingBand, setManualHasWeddingBand] = useState<boolean>(false);
  const [manualIsTwoTone, setManualIsTwoTone] = useState<boolean>(false);
  const [manualImageFile, setManualImageFile] = useState<File | null>(null);
  const [manualImagePreview, setManualImagePreview] = useState<string | null>(initialQuote?.imageDataUrl ?? null);

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
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [savedQuote, setSavedQuote] = useState<{ id: string; quoteNumber: string } | null>(null);
  const [renderingImageUrl, setRenderingImageUrl] = useState<string | null>(null);
  const [draftIsFresh, setDraftIsFresh] = useState(!initialQuote);
  const [generatingConcept, setGeneratingConcept] = useState(false);
  const [showroomMode, setShowroomMode] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  // Mobile Photo Upload QR Bridge States
  const [showMobileUploadModal, setShowMobileUploadModal] = useState(false);
  const [mobileUploadSessionId, setMobileUploadSessionId] = useState<string>("");
  const [mobileUploadQrDataUrl, setMobileUploadQrDataUrl] = useState<string | null>(null);

  const { showToast } = useToast();

  const facetsRef = useRef<FacetDraft[]>([]);
  const showroomFileInputRef = useRef<HTMLInputElement | null>(null);
  const lastAnalysedDescriptionRef = useRef("");

  async function openMobileUploadQr() {
    const sessionId = `jeweler_up_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setMobileUploadSessionId(sessionId);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const uploadLink = `${origin}/showroom/mobile-upload?sessionId=${sessionId}`;
    try {
      const qr = await QRCode.toDataURL(uploadLink, { width: 320, margin: 2 });
      setMobileUploadQrDataUrl(qr);
      setShowMobileUploadModal(true);
    } catch {
      showToast({ message: "Failed to generate QR code.", variant: "error" });
    }
  }

  // Poll for mobile phone uploads when QR modal is open
  useEffect(() => {
    if (!showMobileUploadModal || !mobileUploadSessionId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/showroom/mobile-upload?sessionId=${mobileUploadSessionId}`);
        const data = await res.json();
        if (data.files && data.files.length > 0) {
          const convertedFiles: File[] = await Promise.all(
            data.files.map(async (f: { name: string; type: string; dataUrl: string }, idx: number) => {
              const fetchRes = await fetch(f.dataUrl);
              const blob = await fetchRes.blob();
              return new File([blob], f.name || `phone_photo_${idx + 1}.jpg`, { type: f.type || "image/jpeg" });
            })
          );
          handleFiles(convertedFiles);
          setShowMobileUploadModal(false);
          showToast({ message: `Received ${convertedFiles.length} photo(s) from phone!`, variant: "success" });
        }
      } catch {
        // ignore polling errors
      }
    }, 1800);

    return () => clearInterval(interval);
  }, [showMobileUploadModal, mobileUploadSessionId]);

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
        assignedCompanyId,
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
    if (creationMode === "manual") {
      return {
        jewelryType: manualJewelryType || "Jewelry",
        centerShape: manualCenterShape || "round",
        centerClarity: manualCenterClarity || DEFAULT_COLOR_CLARITY,
        settingType: manualSettingType || "prong",
        metalWeightGrams: Number(manualMetalWeight) || 0,
        centerDiamondCarats:
          quoteMode === "without-center" || quoteMode === "without-center-and-side"
            ? 0
            : Number(manualCenterCarats) || 0,
        sideDiamondCarats: quoteMode === "without-center-and-side" ? 0 : manualRoundSideCarats + manualFancySideCarats,
        sideDiamondQuantity: quoteMode === "without-center-and-side" ? 0 : manualRoundSideCount + manualFancySideCount,
        hasWeddingBand: manualHasWeddingBand,
        isTwoTone: manualIsTwoTone,
        confidence: "high",
        assumptions: ["Manual spec entry with live market spot prices & jeweler margin settings."],
        notes: customerNotes || "Manual spec quotation",
        analysisId: undefined
      };
    }

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
  }, [
    creationMode,
    manualJewelryType,
    manualCenterShape,
    manualCenterClarity,
    manualSettingType,
    manualMetalWeight,
    manualCenterCarats,
    manualSideCarats,
    manualSideCount,
    manualRoundSideCarats,
    manualRoundSideCount,
    manualFancySideCarats,
    manualFancySideCount,
    manualHasWeddingBand,
    manualIsTwoTone,
    customerNotes,
    completedFacets,
    quoteMode
  ]);

  // Recalculate production cost & end customer price client-side in real-time
  const { costBreakdown, estimatedSellingPrice } = useMemo<{
    costBreakdown: unknown;
    estimatedSellingPrice: number;
  }>(() => {
    if (!aggregateQuote) return { costBreakdown: null, estimatedSellingPrice: 0 };

    const centerCarat = Math.max(aggregateQuote.centerDiamondCarats, 0.0001);
    const detectedSideShape = (aggregateQuote.centerShape && ["emerald", "radiant", "cushion", "oval", "pear", "princess"].includes(aggregateQuote.centerShape.toLowerCase()) && aggregateQuote.sideDiamondQuantity <= 4)
      ? "fancy"
      : "round";

    const manualGroups = creationMode === "manual" ? [
      ...(manualSideShapes.includes("round") && manualRoundSideCount > 0 && manualRoundSideCarats > 0 ? [{ shape: "round", caratWeightEach: manualRoundSideCarats / manualRoundSideCount, count: manualRoundSideCount, settingType: manualRoundSideSettings.join(", ") }] : []),
      ...(manualSideShapes.includes("fancy") && manualFancySideCount > 0 && manualFancySideCarats > 0 ? [{ shape: "fancy", caratWeightEach: manualFancySideCarats / manualFancySideCount, count: manualFancySideCount, settingType: manualFancySideSettings.join(", ") }] : [])
    ] : null;
    const sideStones = manualGroups ?? (
      aggregateQuote.sideDiamondQuantity > 0 && aggregateQuote.sideDiamondCarats > 0
        ? [
            {
              shape: detectedSideShape,
              caratWeightEach: aggregateQuote.sideDiamondCarats / aggregateQuote.sideDiamondQuantity,
              count: aggregateQuote.sideDiamondQuantity,
              settingType: aggregateQuote.settingType || "prong"
            }
          ]
        : []);

    try {
      const breakdown = calculateProductionCost({
        pricingProfile,
        quantity,
        stoneOrigin,
        metalType,
        metalWeightGrams: aggregateQuote.metalWeightGrams,
        goldSpotPerOz: pricingProfile?.goldSpotPerOz ?? 4500,
        platinumSpotPerOz: pricingProfile?.platinumSpotPerOz ?? 2000,
        silverSpotPerOz: pricingProfile?.silverSpotPerOz ?? 100,
        centerStone: {
          shape: aggregateQuote.centerShape || "round",
          caratWeight: centerCarat
        },
        sideStones,
        hasWeddingBand: aggregateQuote.hasWeddingBand,
        isTwoTone: aggregateQuote.isTwoTone,
        colorClarity: manualCenterClarity,
        cadCost: cadCost && cadCost > 0 ? cadCost : 20,
        pricingTier,
        customerMarginPct
      });

      return {
        costBreakdown: breakdown,
        estimatedSellingPrice: breakdown.estimatedSellingPrice
      };
    } catch {
      return { costBreakdown: null, estimatedSellingPrice: 0 };
    }
  }, [
    aggregateQuote,
    cadCost,
    customerMarginPct,
    pricingTier,
    metalType,
    pricingProfile,
    quantity,
    stoneOrigin,
    manualCenterClarity,
    creationMode,
    manualSideShapes,
    manualRoundSideCount,
    manualRoundSideCarats,
    manualFancySideCount,
    manualFancySideCarats,
    manualRoundSideSettings,
    manualFancySideSettings
  ]);

  const canAnalyse = canEdit && facets.some((facet) => facet.status === "pending" || facet.status === "error");
  const selectedCenterRate = useMemo(() => {
    const shape = creationMode === "manual" ? manualCenterShape : aggregateQuote?.centerShape ?? "round";
    const caratWeight = creationMode === "manual" ? manualCenterCarats : aggregateQuote?.centerDiamondCarats ?? 0;
    if (caratWeight <= 0) return null;
    return getCenterStonePricePerCarat({
      origin: stoneOrigin,
      shape,
      colorClarity: manualCenterClarity,
      caratWeight,
      gemstonePerCarat: Number(pricingProfile?.gemstonePerCarat ?? 40)
    });
  }, [aggregateQuote?.centerDiamondCarats, aggregateQuote?.centerShape, creationMode, manualCenterCarats, manualCenterClarity, manualCenterShape, pricingProfile?.gemstonePerCarat, stoneOrigin]);

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
    setStatus("Photos uploaded. Click 'Analyze with AI' to start.");
    showToast({
      message: `${selectedFiles.length} photo(s) added. Click 'Analyze with AI' to run analysis.`,
      variant: "info",
      autoDismiss: true
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
    setStatus("Reference photo added. Click 'Analyze with AI' to start.");
    showToast({
      message: "Photo added. Click 'Analyze with AI' to run analysis.",
      variant: "info",
      autoDismiss: true
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
      if (assignedCompanyId) formData.append("assignedCompanyId", assignedCompanyId);
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
          centerClarity: manualCenterClarity,
          settingType: result.settingType ?? "prong",
          metalWeightGrams: result.metalWeightGrams,
          centerDiamondCarats: result.centerDiamondCarats,
          sideDiamondCarats: result.sideDiamondCarats,
          sideDiamondQuantity: result.sideDiamondQuantity,
          hasWeddingBand: result.hasWeddingBand ?? false,
          isTwoTone: result.isTwoTone ?? false,
          confidence: result.confidence,
          notes: result.notes,
          assumptions: result.assumptions,
          renderingImageUrl: result.renderingImageUrl ?? null
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
    if (!canEdit) return;

    if (!facetsRef.current.length) {
      const description = customerNotes.trim();
      if (!description) {
        setStatus("Please add a reference photo or describe your custom design.");
        showToast({
          message: "Please add a reference photo or describe your custom design to analyze.",
          variant: "warning",
          autoDismiss: false
        });
        return;
      }

      const textFacetId = uid();
      const textFacet: FacetDraft = {
        id: textFacetId,
        file: undefined,
        previewUrl: null,
        isObjectUrl: false,
        title: "Design Concept",
        description,
        showDescription: false,
        status: "processing",
        stageIndex: 0,
        output: null,
        error: ""
      };
      setFacets([textFacet]);
      setActiveFacetId(textFacetId);
      setStatus("Analyzing design description with AI...");
      setSavedQuote(null);
      setRenderingImageUrl(null);

      const pulser = window.setInterval(() => {
        setFacets((current) =>
          current.map((f) =>
            f.id === textFacetId ? { ...f, stageIndex: (f.stageIndex + 1) % ANALYSIS_STAGES.length } : f
          )
        );
      }, 800);

      try {
        const formData = new FormData();
        formData.append("metalType", metalType);
        formData.append("description", description);
      if (assignedCompanyId) formData.append("assignedCompanyId", assignedCompanyId);
        const response = await fetch("/api/analyze", { method: "POST", body: formData });
        const responseText = await response.text();
        const result = (responseText ? JSON.parse(responseText) : {}) as FacetOutput;
        if (!response.ok) {
          throw new Error((result as unknown as { error?: string }).error || "Analysis failed.");
        }

        setFacets([
          {
            ...textFacet,
            status: "done",
            previewUrl: result.renderingImageUrl || null,
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
              assumptions: result.assumptions,
              renderingImageUrl: result.renderingImageUrl ?? null
            }
          }
        ]);
        if (result.renderingImageUrl) {
          setRenderingImageUrl(result.renderingImageUrl);
        }
        setStatus("Analysis and 3D visual concept generated.");
        setDraftIsFresh(false);
      } catch (error) {
        setFacets([
          {
            ...textFacet,
            status: "error",
            error: error instanceof Error ? error.message : "Analysis failed."
          }
        ]);
        showToast({
          message: error instanceof Error ? error.message : "Analysis failed.",
          variant: "error"
        });
      } finally {
        window.clearInterval(pulser);
      }
      return;
    }

    const files = facetsRef.current.map((f) => f.file).filter((f): f is File => Boolean(f));
    const description = customerNotes.trim();

    setFacets((current) =>
      current.map((f) => ({ ...f, status: "processing", stageIndex: 0, error: "" }))
    );
    setStatus("Analyzing all reference photos together with AI...");
    setSavedQuote(null);
    setRenderingImageUrl(null);

    const pulser = window.setInterval(() => {
      setFacets((current) =>
        current.map((f) => ({ ...f, stageIndex: (f.stageIndex + 1) % ANALYSIS_STAGES.length }))
      );
    }, 800);

    try {
      const formData = new FormData();
      formData.append("metalType", metalType);
      if (description) formData.append("description", description);
      if (assignedCompanyId) formData.append("assignedCompanyId", assignedCompanyId);
      if (assignedCompanyId) formData.append("assignedCompanyId", assignedCompanyId);
      files.forEach((file) => formData.append("images", file));

      const response = await fetch("/api/analyze", { method: "POST", body: formData });
      const responseText = await response.text();
      const result = (responseText ? JSON.parse(responseText) : {}) as FacetOutput;
      if (!response.ok) {
        throw new Error((result as unknown as { error?: string }).error || "Analysis failed.");
      }

      const unifiedOutput = {
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
        assumptions: result.assumptions,
        renderingImageUrl: result.renderingImageUrl ?? null
      };

      setFacets((current) =>
        current.map((f) => ({
          ...f,
          status: "done",
          output: unifiedOutput
        }))
      );

      if (result.renderingImageUrl) {
        setRenderingImageUrl(result.renderingImageUrl);
      }

      setStatus("Unified analysis and 3D visual concept generated.");
      setDraftIsFresh(false);
      showToast({
        message: "Analysis complete. Combined all views into one unified estimate.",
        variant: "success"
      });
    } catch (error) {
      setFacets((current) =>
        current.map((f) => ({
          ...f,
          status: "error",
          error: error instanceof Error ? error.message : "Analysis failed."
        }))
      );
      showToast({
        message: error instanceof Error ? error.message : "Analysis failed.",
        variant: "error"
      });
    } finally {
      window.clearInterval(pulser);
    }
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
      const msg = creationMode === "manual" ? "Please fill in valid piece specifications before saving." : "Analyse the photos before saving the quote.";
      setStatus(msg);
      showToast({
        message: msg,
        variant: "warning",
        autoDismiss: false
      });
      return;
    }

    if (!window.confirm("Save this approved quote to company history?")) {
      return;
    }

    if (customerEmail.trim()) {
      const emailCheck = validateEmail(customerEmail.trim());
      if (!emailCheck.valid) {
        setStatus(emailCheck.error || "Please enter a valid customer email address.");
        showToast({
          message: emailCheck.error || "Please enter a valid customer email address.",
          variant: "error",
          autoDismiss: false
        });
        return;
      }
    }

    setSaving(true);
    setSavingProgress(0);
    setStatus("Creating quote and realistic presentation rendering...");

    const progressTimer = window.setInterval(() => {
      setSavingProgress((current) => Math.min(90, current + 6));
    }, 1600);

    let manualImageDataUrl: string | undefined = manualImagePreview || undefined;
    if (manualImageFile) {
      manualImageDataUrl = await new Promise<string | undefined>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(undefined);
        reader.readAsDataURL(manualImageFile);
      });
    }

    try {
      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        assignedCompanyId,
          analysisId: aggregateQuote.analysisId,
          analysisIds: completedFacets.map((facet) => facet.output?.analysisId).filter(Boolean),
          customerName,
          customerEmail,
          customerPhone,
          quoteMode,
          quantity,
          stoneOrigin,
          metalType,
          metalWeightGrams: aggregateQuote.metalWeightGrams,
          centerDiamondCarats: aggregateQuote.centerDiamondCarats,
          sideDiamondCarats: aggregateQuote.sideDiamondCarats,
          sideDiamondQuantity: aggregateQuote.sideDiamondQuantity,
          centerShape: aggregateQuote.centerShape ?? "round",
          centerClarity: manualCenterClarity,
          settingType: aggregateQuote.settingType ?? "prong",
          jewelryType: aggregateQuote.jewelryType ?? "Ring",
          imageDataUrl: manualImageDataUrl,
          customerNotes,
          notes: customerNotes,
          hasWeddingBand: aggregateQuote.hasWeddingBand,
          isTwoTone: aggregateQuote.isTwoTone,
          sideStones: creationMode === "manual" ? [
            ...(manualSideShapes.includes("round") && manualRoundSideCount > 0 ? [{ shape: "round", caratWeightEach: manualRoundSideCarats / manualRoundSideCount, count: manualRoundSideCount, settingType: manualRoundSideSettings.join(", ") }] : []),
            ...(manualSideShapes.includes("fancy") && manualFancySideCount > 0 ? [{ shape: "fancy", caratWeightEach: manualFancySideCarats / manualFancySideCount, count: manualFancySideCount, settingType: manualFancySideSettings.join(", ") }] : [])
          ] : undefined
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
        const message = result.error || "Unable to save quote.";
        setStatus(`${message} You can still print or download a PDF of this quote below.`);
        showToast({
          message: `${message} Use "Print / Download PDF" below to keep a copy.`,
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
    } catch {
      setSavingProgress(100);
      setStatus("Unable to reach the server to save this quote. You can still print or download a PDF of this quote below.");
      showToast({
        message: 'Could not reach the server to save this quote. Use "Print / Download PDF" below to keep a copy.',
        variant: "error",
        autoDismiss: false
      });
    } finally {
      window.clearInterval(progressTimer);
      setSaving(false);
    }
  }

  async function downloadDraftPdf() {
    if (savedQuote) {
      window.open(`/api/quotes/${savedQuote.id}/pdf`, "_blank", "noopener,noreferrer");
      return;
    }

    if (!aggregateQuote || !costBreakdown) return;

    setDownloadingPdf(true);
    try {
      const response = await fetch("/api/quotes/pdf-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        assignedCompanyId,
          analysisId: aggregateQuote.analysisId,
          customerName,
          customerEmail,
          customerPhone,
          quoteMode,
          quantity,
          stoneOrigin,
          metalType,
          metalWeightGrams: aggregateQuote.metalWeightGrams,
          centerDiamondCarats: aggregateQuote.centerDiamondCarats,
          sideDiamondCarats: aggregateQuote.sideDiamondCarats,
          sideDiamondQuantity: aggregateQuote.sideDiamondQuantity,
          centerShape: aggregateQuote.centerShape ?? "round",
          centerClarity: manualCenterClarity,
          settingType: aggregateQuote.settingType ?? "prong",
          jewelryType: aggregateQuote.jewelryType ?? "Ring",
          imageDataUrl: manualImagePreview || undefined,
          customerNotes,
          notes: customerNotes,
          hasWeddingBand: aggregateQuote.hasWeddingBand,
          isTwoTone: aggregateQuote.isTwoTone,
          sideStones: creationMode === "manual" ? [
            ...(manualSideShapes.includes("round") && manualRoundSideCount > 0 ? [{ shape: "round", caratWeightEach: manualRoundSideCarats / manualRoundSideCount, count: manualRoundSideCount, settingType: manualRoundSideSettings.join(", ") }] : []),
            ...(manualSideShapes.includes("fancy") && manualFancySideCount > 0 ? [{ shape: "fancy", caratWeightEach: manualFancySideCarats / manualFancySideCount, count: manualFancySideCount, settingType: manualFancySideSettings.join(", ") }] : [])
          ] : undefined
        })
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        throw new Error(errorPayload.error || "Unable to generate PDF.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : "Unable to generate PDF.",
        variant: "error",
        autoDismiss: false
      });
    } finally {
      setDownloadingPdf(false);
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
  // Prefer the saved-quote rendering once saved; otherwise show the AI rendering generated during analysis.
  const displayRenderingImageUrl = renderingImageUrl ?? activeFacet?.output?.renderingImageUrl ?? null;

  return (
    <div className={`estimateWorkspace${showroomMode ? " showroomUnifiedWorkspace" : ""}`}>
      <div className="quoteWorkspaceModeBar">
        <div>
          <span className="eyebrow">{showroomMode ? "Showroom consultation" : "Jeweler workspace"}</span>
          <p className="muted small">
            {creationMode === "manual"
              ? "Direct manual spec entry with live market spot prices & jeweler margin."
              : "Upload and describe once. Analysis, visualization, and pricing update automatically."}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {!showroomMode && (
            <div className="quoteCreationModeSwitcher">
              <button
                type="button"
                className={`quoteCreationModeBtn ${creationMode === "ai" ? "isActive" : ""}`}
                onClick={() => {
                  setCreationMode("ai");
                  setSavedQuote(null);
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
                ✨ AI Photo Analysis
              </button>
              <button
                type="button"
                className={`quoteCreationModeBtn ${creationMode === "manual" ? "isActive" : ""}`}
                onClick={() => {
                  setCreationMode("manual");
                  setSavedQuote(null);
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>tune</span>
                ⚡ Manual Spec Entry
              </button>
            </div>
          )}

          <button
            type="button"
            className="button secondary button--sm"
            onClick={() => setShowroomMode((current) => !current)}
          >
            {showroomMode ? "Return to jeweler view" : "Open showroom view"}
          </button>
        </div>
      </div>

      {/* Two-column layout: left steps / right preview */}
      <QuoteCreationLayout
        steps={
          creationMode === "manual" ? (
            <>
              {/* ── Manual Step 1: Customer Details & Reference Image ── */}
              <QuoteStepCard
                number="01"
                title="Customer & Design Reference"
                description="Add optional customer details and attach a reference photo (bypasses AI analysis)."
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                    gap: 12,
                    marginBottom: 18,
                    padding: "12px 14px",
                    background: "var(--color-surface-container-low, rgba(0,0,0,0.02))",
                    borderRadius: "var(--radius-md, 10px)",
                    border: "1px solid var(--color-outline-variant, #e2e8f0)"
                  }}
                >
                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor="manualCustomerName" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                      Customer Name <span className="muted small" style={{ fontWeight: 400 }}>(Optional)</span>
                    </label>
                    <input
                      id="manualCustomerName"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Eleanor Vance"
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor="manualCustomerEmail" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                      Customer Email <span className="muted small" style={{ fontWeight: 400 }}>(Optional)</span>
                    </label>
                    <input
                      id="manualCustomerEmail"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="e.g. eleanor@example.com"
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor="manualCustomerPhone" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                      Phone Number <span className="muted small" style={{ fontWeight: 400 }}>(Optional)</span>
                    </label>
                    <input
                      id="manualCustomerPhone"
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="e.g. (212) 555-0198"
                      disabled={!canEdit}
                    />
                  </div>
                </div>

                <div className="field quoteDesignDescription">
                  <div className="charCountHeader">
                    <label htmlFor="manualCustomerNotes">Design Notes &amp; Instructions <span className="muted small" style={{ fontWeight: 400 }}>(Optional)</span></label>
                    <span className="charCountBadge">{customerNotes.length} / 1000</span>
                  </div>
                  <textarea
                    id="manualCustomerNotes"
                    rows={2}
                    maxLength={1000}
                    value={customerNotes}
                    onChange={(event) => setCustomerNotes(event.target.value)}
                    placeholder="e.g. Ring size 6.5, high-polish shank, flush comfort fit..."
                    disabled={!canEdit}
                  />
                </div>

                {/* Reference Photo Attachment */}
                <div style={{ marginTop: 14 }}>
                  <label style={{ fontSize: "0.8125rem", fontWeight: 600, display: "block", marginBottom: 6 }}>
                    Reference Photo / Sketch <span className="muted small" style={{ fontWeight: 400 }}>(Optional — included in PDF proposal)</span>
                  </label>
                  {manualImagePreview ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 14px", background: "var(--color-surface-container-low, #f8fafc)", borderRadius: "var(--radius-md, 8px)", border: "1px solid var(--color-outline-variant, #e2e8f0)" }}>
                      <img src={manualImagePreview} alt="Reference Preview" style={{ width: 54, height: 54, borderRadius: 6, objectFit: "cover" }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600 }}>{manualImageFile?.name || "Reference Photo"}</p>
                        <span className="muted small">Direct preview (ready for PDF generation)</span>
                      </div>
                      <button
                        type="button"
                        className="button secondary button--sm"
                        onClick={() => {
                          setManualImageFile(null);
                          setManualImagePreview(null);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div
                      className="dropzone"
                      style={{ padding: "16px 20px" }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files?.[0]) {
                          const file = e.dataTransfer.files[0];
                          setManualImageFile(file);
                          setManualImagePreview(URL.createObjectURL(file));
                        }
                      }}
                    >
                      <div className="dropzoneContent" style={{ gap: 4 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 24, color: "var(--color-primary)" }}>add_photo_alternate</span>
                        <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Attach reference photo (Optional)</span>
                        <span className="muted small">JPG, PNG, or WEBP · direct preview without AI processing</span>
                      </div>
                      <label className="button secondary button--sm" style={{ marginTop: 8 }}>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={!canEdit}
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              const file = e.target.files[0];
                              setManualImageFile(file);
                              setManualImagePreview(URL.createObjectURL(file));
                            }
                          }}
                        />
                        Choose Image
                      </label>
                    </div>
                  )}
                </div>
              </QuoteStepCard>

              {/* ── Manual Step 2: Piece Specifications (Live Pricing) ── */}
              <QuoteStepCard
                number="02"
                title="Piece Specifications & Live Pricing"
                description="Direct specification entry. Live spot metal rates and stone pricing update the estimate in real-time."
              >
                {/* Quick Presets */}
                <div>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-primary)", display: "block", marginBottom: 8 }}>
                    Quick Presets
                  </span>
                  <div className="presetChipsBar">
                    {MANUAL_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        className="presetChip"
                        onClick={() => {
                          setManualJewelryType(preset.jewelryType);
                          setMetalType(preset.metalType);
                          setManualMetalWeight(preset.metalWeight);
                          setManualCenterShape(preset.centerShape);
                          setManualCenterCarats(preset.centerCarats);
                          setManualSettingType(preset.settingType);
                          setManualSideCount(preset.sideCount);
                          setManualSideCarats(preset.sideCarats);
                          setManualHasWeddingBand(preset.hasWeddingBand);
                          setSavedQuote(null);
                          showToast({ message: `Loaded ${preset.name} specs!`, variant: "info", autoDismiss: true });
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>bolt</span>
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "grid", gap: 16 }}>
                  {/* Metal & Jewelry Type Row */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
                    <div className="field">
                      <label htmlFor="manualQuantity">Quantity</label>
                      <select id="manualQuantity" value={quantity} disabled={!canEdit} onChange={(e) => setQuantity(Number(e.target.value))}>
                        {[1, 2, 3].map((value) => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="manualJewelryType">Jewelry Type</label>
                      <select
                        id="manualJewelryType"
                        value={manualJewelryType}
                        disabled={!canEdit}
                        onChange={(e) => setManualJewelryType(e.target.value)}
                      >
                        {["Ring", "Engagement Ring", "Wedding Band", "Pendant", "Earrings", "Bracelet", "Necklace"].map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label htmlFor="manualMetalType">Metal Alloy</label>
                      <select
                        id="manualMetalType"
                        value={metalType}
                        disabled={!canEdit}
                        onChange={(e) => setMetalType(e.target.value as MetalType)}
                      >
                        {["10K", "14K", "18K", "Platinum", "Silver"].map((m) => (
                          <option key={m} value={m}>{m} Gold / Metal</option>
                        ))}
                      </select>
                    </div>

                    <div className="field">
                      <label htmlFor="manualMetalWeight">
                        Total Metal Weight (grams, all pieces)
                      </label>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                          id="manualMetalWeight"
                          type="number"
                          min={0.5}
                          max={20}
                          step={0.1}
                          value={manualMetalWeight}
                          disabled={!canEdit}
                          onChange={(e) => setManualMetalWeight(Number(e.target.value) || 0)}
                          style={{ width: 90 }}
                        />
                        <input
                          type="range"
                          min={0.5}
                          max={20}
                          step={0.1}
                          value={manualMetalWeight}
                          disabled={!canEdit}
                          onChange={(e) => setManualMetalWeight(Number(e.target.value) || 0)}
                          style={{ flex: 1 }}
                        />
                        <span style={{ fontSize: "0.875rem", fontWeight: 600, minWidth: 36 }}>{manualMetalWeight}g</span>
                      </div>
                    </div>
                  </div>

                  {/* Center Stone Section */}
                  <div style={{ padding: "14px 16px", background: "var(--color-surface-container-low, #f8fafc)", borderRadius: "var(--radius-md, 8px)", border: "1px solid var(--color-outline-variant, #e2e8f0)" }}>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0F172A", display: "block", marginBottom: 12 }}>
                      💎 Center Diamond
                    </span>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                      <div className="field" style={{ margin: 0 }}>
                        <label htmlFor="manualStoneOrigin">Stone Origin</label>
                        <select
                          id="manualStoneOrigin"
                          value={stoneOrigin}
                          disabled={!canEdit}
                          onChange={(e) => {
                            const value = e.target.value as "lab" | "natural" | "gemstone";
                            setStoneOrigin(value);
                            setManualCenterClarity(value === "gemstone" ? "Gemstone / Color Stone" : DEFAULT_COLOR_CLARITY);
                            if (value === "gemstone") window.alert("Color stones / gemstones must be bigger than 3 mm. Below 3 mm, only natural stones are available and this calculator cannot provide a price.");
                          }}
                        >
                          <option value="lab">Lab Diamond</option>
                          <option value="natural">Natural Diamond</option>
                          <option value="gemstone">Color Stone / Gemstone (Lab)</option>
                        </select>
                      </div>
                      <div className="field" style={{ margin: 0 }}>
                        <label htmlFor="manualCenterShape">Center Shape</label>
                        <select
                          id="manualCenterShape"
                          value={manualCenterShape}
                          disabled={!canEdit}
                          onChange={(e) => setManualCenterShape(e.target.value)}
                        >
                          {["round", "oval", "cushion", "emerald", "pear", "princess", "radiant", "marquise", "asscher", "heart"].map((s) => (
                            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                          ))}
                        </select>
                      </div>

                      <div className="field" style={{ margin: 0 }}>
                        <label htmlFor="manualCenterCarats">Carat Weight (ct)</label>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input
                            id="manualCenterCarats"
                            type="number"
                            min={0}
                            max={15}
                            step={0.05}
                            value={manualCenterCarats}
                            disabled={!canEdit}
                            onChange={(e) => setManualCenterCarats(Number(e.target.value) || 0)}
                          />
                          <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>ct</span>
                        </div>
                      </div>

                      <div className="field" style={{ margin: 0 }}>
                        <label htmlFor="manualCenterClarity">Color &amp; Clarity</label>
                        <select
                          id="manualCenterClarity"
                          value={manualCenterClarity}
                          disabled={!canEdit}
                          onChange={(e) => setManualCenterClarity(e.target.value)}
                        >
                          {(stoneOrigin === "lab"
                            ? LAB_COLOR_CLARITIES
                            : stoneOrigin === "natural"
                              ? NATURAL_COLOR_CLARITIES
                              : ["Gemstone / Color Stone — $40 per ct"]).map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <p className="muted small" style={{ margin: "5px 0 0" }}>
                          {selectedCenterRate?.error ?? (selectedCenterRate ? `${formatCurrency(selectedCenterRate.pricePerCarat)} per carat from the supplied ${stoneOrigin === "gemstone" ? "gemstone" : stoneOrigin} pricing table` : "Enter a center-stone weight to resolve its price band.")}
                        </p>
                      </div>

                    </div>
                  </div>

                  {/* Side Stones & Accents Section */}
                  <div style={{ padding: "14px 16px", background: "var(--color-surface-container-low, #f8fafc)", borderRadius: "var(--radius-md, 8px)", border: "1px solid var(--color-outline-variant, #e2e8f0)" }}>
                    <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0F172A", display: "block", marginBottom: 12 }}>
                      ✨ Side Stones &amp; Accents
                    </span>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                      <div className="field" style={{ margin: 0 }}>
                        <label>Side Stone Shapes (select both when applicable)</label>
                        <div style={{ display: "flex", gap: 14, minHeight: 42, alignItems: "center" }}>
                          {(["round", "fancy"] as const).map((shape) => <label key={shape} style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={manualSideShapes.includes(shape)} disabled={!canEdit} onChange={(e) => setManualSideShapes((current) => e.target.checked ? [...current, shape] : current.filter((item) => item !== shape))} />{shape === "round" ? "Round" : "Fancy"}</label>)}
                        </div>
                      </div>

                      <div className="field" style={{ margin: 0 }}>
                        <label htmlFor="quoteModeManual">Quote Mode</label>
                        <select
                          id="quoteModeManual"
                          value={quoteMode}
                          disabled={!canEdit}
                          onChange={(e) => setQuoteMode(e.target.value as QuoteMode)}
                        >
                          {QUOTE_MODE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {manualSideShapes.map((shape) => {
                      const isRound = shape === "round";
                      const count = isRound ? manualRoundSideCount : manualFancySideCount;
                      const carats = isRound ? manualRoundSideCarats : manualFancySideCarats;
                      return <div key={shape} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 12 }}>
                        <div className="field" style={{ margin: 0 }}><label>{isRound ? "Round" : "Fancy"} Side Stone Count</label><input type="number" min={0} max={150} step={1} value={count} disabled={!canEdit} onChange={(e) => isRound ? setManualRoundSideCount(Number(e.target.value) || 0) : setManualFancySideCount(Number(e.target.value) || 0)} /></div>
                        <div className="field" style={{ margin: 0 }}><label>Total {isRound ? "Round" : "Fancy"} Side Stone Weight (ct)</label><input type="number" min={0} max={20} step={0.01} value={carats} disabled={!canEdit} onChange={(e) => isRound ? setManualRoundSideCarats(Number(e.target.value) || 0) : setManualFancySideCarats(Number(e.target.value) || 0)} /></div>
                        <div className="field" style={{ margin: 0 }}>
                          <label>{isRound ? "Round" : "Fancy"} Side Stone Setting Type</label>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {["prong", "bezel", "pave", "channel", "flush", "bar", "shared prong", "micro-pave"].map((setting) => {
                              const selected = isRound ? manualRoundSideSettings : manualFancySideSettings;
                              const update = isRound ? setManualRoundSideSettings : setManualFancySideSettings;
                              return <label key={setting} style={{ display: "flex", gap: 5, alignItems: "center" }}><input type="checkbox" checked={selected.includes(setting)} disabled={!canEdit} onChange={(e) => update((current) => e.target.checked ? [...current, setting] : current.filter((item) => item !== setting))} />{setting}</label>;
                            })}
                          </div>
                        </div>
                      </div>;
                    })}

                    {/* Additional Options */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 20, marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--color-outline-variant, #e2e8f0)" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.875rem" }}>
                        <input
                          type="checkbox"
                          checked={manualHasWeddingBand}
                          disabled={!canEdit}
                          onChange={(e) => setManualHasWeddingBand(e.target.checked)}
                        />
                        <span>Include Matching Wedding Band (2 pieces)</span>
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: "0.875rem" }}>
                        <input
                          type="checkbox"
                          checked={manualIsTwoTone}
                          disabled={!canEdit}
                          onChange={(e) => setManualIsTwoTone(e.target.checked)}
                        />
                        <span>Two-Tone Metal Casting</span>
                      </label>
                    </div>
                  </div>
                </div>
              </QuoteStepCard>
            </>
          ) : (
            <>
          {/* ── Step 1: Customer Info, Upload Reference Photos & Description ── */}
          <QuoteStepCard
            number="01"
            title="Customer & Design Details"
            description="Add customer contact details (optional) and reference design photos."
          >
            {/* Customer Contact Details (Optional on Jeweler Dashboard) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 12,
                marginBottom: 18,
                padding: "12px 14px",
                background: "var(--color-surface-container-low, rgba(0,0,0,0.02))",
                borderRadius: "var(--radius-md, 10px)",
                border: "1px solid var(--color-outline-variant, #e2e8f0)"
              }}
            >
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="customerName" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                  Customer Name <span className="muted small" style={{ fontWeight: 400 }}>(Optional)</span>
                </label>
                <input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Eleanor Vance"
                  disabled={!canEdit}
                />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="customerEmail" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                  Customer Email <span className="muted small" style={{ fontWeight: 400 }}>(Optional)</span>
                </label>
                <input
                  id="customerEmail"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="e.g. eleanor@example.com"
                  disabled={!canEdit}
                />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="customerPhone" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                  Phone Number <span className="muted small" style={{ fontWeight: 400 }}>(Optional)</span>
                </label>
                <input
                  id="customerPhone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="e.g. (212) 555-0198"
                  disabled={!canEdit}
                />
              </div>
            </div>

          </QuoteStepCard>

          <QuoteStepCard
            number="02"
            title="Upload Pictures & Description"
            description="Upload reference pictures and add an optional description for the AI review."
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
              <div className="dropzoneActions" style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
                <label className="button primary button--sm">
                  <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={!canEdit} onChange={(event) => handleFiles(Array.from(event.target.files ?? []))} />
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>photo_camera</span>
                  Take photo
                </label>
                <label className="button secondary button--sm">
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={!canEdit} onChange={(event) => handleFiles(Array.from(event.target.files ?? []))} />
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>folder_open</span>
                  Choose files
                </label>
                <button
                  type="button"
                  className="button secondary button--sm"
                  onClick={openMobileUploadQr}
                  disabled={!canEdit}
                  style={{
                    background: "rgba(201, 168, 76, 0.12)",
                    borderColor: "rgba(201, 168, 76, 0.35)",
                    color: "var(--color-primary, #b8933b)",
                    fontWeight: 600
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>qr_code_scanner</span>
                  Upload from Phone (QR)
                </button>
              </div>
            </div>

            {/* Photo thumbnail strip & Action Buttons */}
            <div style={{ marginTop: 16 }}>
              {facets.length > 0 ? (
                <div className="facetThumbRail" aria-label="Uploaded photos" style={{ marginBottom: 16 }}>
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

              {/* Explicit Analyze Button */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <button
                  type="button"
                  className="button primary button--md"
                  onClick={analyseAll}
                  disabled={!canEdit || facets.some((f) => f.status === "processing") || (!facets.length && !customerNotes.trim())}
                >
                  <span
                    className={`material-symbols-outlined${facets.some((f) => f.status === "processing") ? " ai-pulse" : ""}`}
                    style={{ fontSize: 18 }}
                  >
                    auto_awesome
                  </span>
                  {facets.some((f) => f.status === "processing")
                    ? "Analyzing with AI…"
                    : facets.some((f) => f.status === "done")
                    ? "Re-analyze with AI"
                    : "Analyze with AI"}
                </button>

                {facets.length > 0 ? (
                  <button
                    type="button"
                    className="button secondary button--sm"
                    onClick={clearAllFacets}
                    disabled={facets.some((f) => f.status === "processing")}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                    Clear Photos
                  </button>
                ) : null}
              </div>
            </div>
          </QuoteStepCard>

          <QuoteStepCard
            number="03"
            title="Stone Origin & Quality"
            description="Select the diamond origin and color/clarity quality used for pricing."
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="aiStoneOrigin">Stone Origin</label>
                <select id="aiStoneOrigin" value={stoneOrigin} disabled={!canEdit} onChange={(e) => {
                  const value = e.target.value as "lab" | "natural" | "gemstone";
                  setStoneOrigin(value);
                  setManualCenterClarity(value === "gemstone" ? "Gemstone / Color Stone" : DEFAULT_COLOR_CLARITY);
                  if (value === "gemstone") window.alert("Color stones / gemstones must be bigger than 3 mm. Below 3 mm, only natural stones are available and this calculator cannot provide a price.");
                }}>
                  <option value="lab">Lab Diamond</option>
                  <option value="natural">Natural Diamond</option>
                  <option value="gemstone">Color Stone / Gemstone (Lab)</option>
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="aiColorClarity">Color &amp; Clarity (Quality)</label>
                <select id="aiColorClarity" value={manualCenterClarity} disabled={!canEdit || stoneOrigin === "gemstone"} onChange={(e) => setManualCenterClarity(e.target.value)}>
                  {(stoneOrigin === "lab" ? LAB_COLOR_CLARITIES : NATURAL_COLOR_CLARITIES).map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <p className="muted small" style={{ margin: "5px 0 0" }}>
                  {selectedCenterRate?.error ?? (selectedCenterRate ? `${formatCurrency(selectedCenterRate.pricePerCarat)} per carat from the supplied ${stoneOrigin === "gemstone" ? "gemstone" : stoneOrigin} pricing table` : "The rate will appear after AI estimates the center-stone weight.")}
                </p>
              </div>
            </div>
          </QuoteStepCard>

          {/* ── Step 2: AI Analysis Results ── */}
          {facets.length > 0 ? (
            <QuoteStepCard
              number="04"
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

                    {/* Pending state with individual Analyze button */}
                    {facet.status === "pending" ? (
                      <div style={{ marginTop: 12 }}>
                        <button
                          type="button"
                          className="button primary button--sm"
                          onClick={() => analyseFacet(facet)}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
                          Analyze this photo
                        </button>
                      </div>
                    ) : null}

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
                    onChange={(e) => {
                      const newMetal = e.target.value as MetalType;
                      const oldMetal = metalType;
                      setMetalType(newMetal);
                      setFacets((current) =>
                        current.map((facet) => {
                          if (!facet.output) return facet;
                          return {
                            ...facet,
                            output: {
                              ...facet.output,
                              metalWeightGrams: Number(convertMetalWeight(facet.output.metalWeightGrams, oldMetal, newMetal).toFixed(2))
                            }
                          };
                        })
                      );
                    }}
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
          )
        }
        preview={
          <QuoteBuilderPreview>
            <div className="quotePreviewHeader">
              <span className="quoteStepNumber">{creationMode === "manual" ? "03" : "04"}</span>
              <div>
                <p className="eyebrow">{creationMode === "manual" ? "Live estimate & quote" : "AI visualization & quote"}</p>
                <p className="muted small">Updates automatically as specifications change.</p>
              </div>
            </div>

            {/* Visual Preview Frame */}
            <div className="quotePreviewImageFrame">
              {displayRenderingImageUrl || manualImagePreview || activeFacet?.previewUrl ? (
                <img
                  src={displayRenderingImageUrl ?? manualImagePreview ?? activeFacet?.previewUrl ?? ""}
                  alt="Jewelry quote reference preview"
                  className="quotePreviewImage"
                />
              ) : (
                <div className="quotePreviewImagePlaceholder">
                  <span className="material-symbols-outlined" style={{ fontSize: 40, color: "var(--color-primary)" }}>diamond</span>
                  <p className="muted small" style={{ margin: "8px 0 0", textAlign: "center" }}>
                    {creationMode === "manual"
                      ? "Direct spec pricing is active. Attach a reference photo or save directly."
                      : "Upload photos or describe a design to see the AI visualization here"}
                  </p>
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
                  <span style={{ color: "white", fontSize: "var(--text-sm)", fontWeight: 600, marginTop: 8 }}>Creating your quote…</span>
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
              {aggregateQuote ? (
                <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-primary)", margin: "8px 0", background: "var(--color-surface-container)", padding: "6px 12px", borderRadius: "var(--radius-sm)", borderLeft: "3px solid var(--color-primary)" }}>
                  {metalType} · {aggregateQuote.centerDiamondCarats > 0 ? `${aggregateQuote.centerDiamondCarats.toFixed(2)}ct ${aggregateQuote.centerShape || "Diamond"}` : "No Center Stone"}{aggregateQuote.sideDiamondQuantity > 0 ? ` · ${aggregateQuote.sideDiamondCarats.toFixed(2)}ct Side (${aggregateQuote.sideDiamondQuantity}×)` : ""}{aggregateQuote.hasWeddingBand ? " + Band" : ""}{aggregateQuote.isTwoTone ? " (Two-Tone)" : ""} {aggregateQuote.jewelryType || "Ring"}
                </div>
              ) : null}
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
                  <strong>{creationMode === "manual" ? "Manual Direct" : (QUOTE_MODE_OPTIONS.find((o) => o.value === quoteMode)?.label ?? quoteMode)}</strong>
                </div>
                <div>
                  <span>Input</span>
                  <strong>{creationMode === "manual" ? `${manualMetalWeight}g Specs` : `${completedFacets.length} analysed`}</strong>
                </div>
              </div>
              <p className="disclaimer" style={{ marginTop: 12 }}>
                Final pricing is an approved estimate based on live spot metal rates and configured markup divisor.
              </p>
            </div>

            {/* Save + PDF actions */}
            <div className="quotePreviewActions">
              <button
                className="button primary"
                style={{ width: "100%" }}
                type="button"
                disabled={!canEdit || saving || !aggregateQuote || (creationMode === "ai" && draftIsFresh)}
                onClick={() => persistQuote({ resetDraftAfterSave: false })}
              >
                {saving ? (
                  <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>hourglass_top</span> Saving…</>
                ) : (
                  <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span> Save Quote</>
                )}
              </button>
              {canDownloadPdf && aggregateQuote && costBreakdown ? (
                <button
                  className="button secondary"
                  style={{ width: "100%" }}
                  type="button"
                  disabled={downloadingPdf}
                  onClick={downloadDraftPdf}
                  title={
                    savedQuote
                      ? "Download the saved quote's PDF"
                      : "Print or download a PDF of this quote — works even if Save Quote fails"
                  }
                >
                  {downloadingPdf ? (
                    <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>hourglass_top</span> Preparing…</>
                  ) : (
                    <><span className="material-symbols-outlined" style={{ fontSize: 16 }}>print</span> {savedQuote ? "Download PDF" : "Print / Download PDF"}</>
                  )}
                </button>
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

      {/* Mobile Photo Upload QR Modal */}
      {showMobileUploadModal ? (
        <div className="showroomModalBackdrop" onClick={() => setShowMobileUploadModal(false)}>
          <div className="showroomQrCard" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <button className="showroomCloseBtn" type="button" onClick={() => setShowMobileUploadModal(false)}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
            </button>

            <div className="showroomModalIcon" style={{ width: 56, height: 56, marginBottom: 12 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 28 }}>smartphone</span>
            </div>
            <h3 style={{ fontSize: "1.375rem", margin: "0 0 8px" }}>Upload Photos from Your Phone</h3>
            <p style={{ margin: "0 0 16px", fontSize: "0.875rem", color: "#cbd5e1" }}>
              Scan this QR code with your phone camera to snap live photos or select reference images from your gallery to send directly into this quote.
            </p>

            {mobileUploadQrDataUrl ? (
              <div className="showroomQrWrap" style={{ padding: 14 }}>
                <img src={mobileUploadQrDataUrl} alt="Scan Mobile Upload QR Code" />
              </div>
            ) : null}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 18, color: "#e6cb78" }}>
              <span className="material-symbols-outlined ai-pulse" style={{ fontSize: 20 }}>sync</span>
              <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Waiting for photos from phone…</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
