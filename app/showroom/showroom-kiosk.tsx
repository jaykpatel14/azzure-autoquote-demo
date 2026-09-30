"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type SyntheticEvent, type TouchEvent } from "react";
import QRCode from "qrcode";
import { QuoteCreationLayout, QuoteStepCard, QuoteBuilderPreview } from "@/components/QuoteCreationLayout";
import {
  calculateMakingPrice as calculateProductionCost,
  calculateTierPrice,
  DEFAULT_COLOR_CLARITY
} from "@/src/services/pricing";
import { convertMetalWeight, type MetalType, type PricingProfileInput } from "@/lib/pricing";
import { validateEmail } from "@/lib/email-validation";
import type { PricingTier } from "@prisma/client";
import KioskStaffPinModal from "@/components/kiosk-staff-pin-modal";
import KioskStaffView from "@/components/kiosk-staff-view";
import LiveCameraModal from "@/components/live-camera-modal";
import { useShowroomDevice } from "@/components/showroom-device-provider";
import { CurrencySelector } from "@/components/currency-selector";
import { formatMoneyWithFx, type SupportedCurrency } from "@/lib/currency";

type Branding = { companyName: string; logoUrl: string | null; primaryColor: string | null; backgroundColor: string | null; backgroundMediaUrl: string | null; backgroundMediaType: string | null; overlayColor: string | null; overlayOpacity: number | null; textColor: string | null; backgroundFit: string | null; backgroundPosition: string | null; panelOpacity: number | null; aboutUs: string | null; marketingImages: string[] };
type Pricing = { cadCost: number; customerMarginPct: number; pricingTier: PricingTier | null; pricingProfile: PricingProfileInput; defaultCurrency?: SupportedCurrency };
type AccentStoneEstimate = {
  tier: "commercial";
  caratWeightEach: number;
  lineItems: Array<{
    stone: string;
    count: number;
    caratWeightEach: number;
    totalCarats: number;
    lowTotal: number;
    highTotal: number;
  }>;
  lowTotal: number;
  highTotal: number;
  disclaimer: string;
};

type Analysis = {
  analysisId: string;
  jewelryType: string;
  selectedMetal: string;
  metalColor?: string | null;
  metalWeightGrams: number;
  centerDiamondCarats: number;
  sideDiamondCarats: number;
  sideDiamondQuantity: number;
  centerShape?: string;
  centerStoneColor?: string | null;
  centerClarity?: string;
  settingType?: string;
  hasWeddingBand?: boolean;
  isTwoTone?: boolean;
  assumptions?: string[];
  accentColorStones?: Array<{ stone: string; color: string; count: number; clarity: string }>;
  accentStonePriceEstimate?: AccentStoneEstimate | null;
  renderingImageUrl?: string | null;
  renderingStatus?: string;
};

const KIOSK_ANALYSIS_STAGES = [
  "Scanning precious metal alloy & piece architecture…",
  "Estimating center & side stone dimensions…",
  "Analyzing facet geometry, settings & prongs…",
  "Calculating live metal spot pricing & 3D render…"
] as const;

type JewelryFactItem = {
  category: string;
  icon: string;
  headline: string;
  fact: string;
  sourceOrTrend?: string | null;
  trivia?: { question: string; answer: string };
};

const JEWELRY_FACTS_COLLECTION: JewelryFactItem[] = [
  {
    category: "Precious Metals",
    icon: "award_star",
    headline: "Platinum is 30x Rarer Than Gold",
    fact: "If all the platinum ever mined in history were poured into an Olympic pool, it would barely cover your ankles. It is naturally hypoallergenic and develops a velvety patina that lasts generations.",
    trivia: {
      question: "Why does platinum feel so heavy in hand?",
      answer: "Platinum is 60% denser than 14K gold, giving it that unmistakable luxury heirloom heft."
    }
  },
  {
    category: "Diamond Cuts",
    icon: "diamond",
    headline: "The Optical Fire of the Oval Cut",
    fact: "Engineered with 57–58 precision facets, the Oval brilliant cut maximizes internal light return while creating an optical illusion that makes fingers appear longer and stones look up to 10% larger than round cuts.",
    trivia: {
      question: "Which cut reflects the most total light?",
      answer: "The Round Brilliant cut, mathematically proportioned for 100% total internal reflection."
    }
  },
  {
    category: "Custom Craftsmanship",
    icon: "engineering",
    headline: "The Lost-Wax 3D Casting Secret",
    fact: "Your ring is first sculpted in high-resolution 3D CAD, printed in castable wax resin, and cast under high vacuum. Master jewelers use 25% excess molten gold reservoir volume to prevent microscopic porosity.",
    trivia: {
      question: "What is porosity in fine jewelry?",
      answer: "Microscopic air pockets. Vacuum casting ensures dense, glass-smooth metal integrity."
    }
  },
  {
    category: "Gold Metallurgy",
    icon: "savings",
    headline: "Why 14K vs 18K Gold Matters",
    fact: "14K Gold contains 58.5% pure gold alloyed with copper and silver, creating the ultimate durability for daily active wear. 18K contains 75% pure gold for a richer European heirloom luster.",
    trivia: {
      question: "Why is 24K gold rarely used for rings?",
      answer: "Pure 24K gold is too soft and can bend or lose diamonds with everyday wear."
    }
  },
  {
    category: "Anatomy of a Ring",
    icon: "visibility",
    headline: "The Secret of the Hidden Halo",
    fact: "A hidden halo wraps microscopic pavé diamonds underneath the center stone's gallery prongs, providing 360° side fire and sparkle without changing the classic top silhouette.",
    trivia: {
      question: "How small are pavé side diamonds?",
      answer: "Often under 1 millimeter, hand-beaded under high-power 80x gemological microscopes."
    }
  },
  {
    category: "Ancient Earth History",
    icon: "auto_awesome",
    headline: "Formed 100 Miles Inside the Earth",
    fact: "Natural diamonds formed 1 to 3.5 billion years ago under colossal heat and pressure 100 miles below the earth's crust, carried upward by ancient volcanic magma pipes called kimberlites.",
    trivia: {
      question: "How old is a natural diamond?",
      answer: "Most natural diamonds are older than dinosaurs and nearly a quarter the age of the universe!"
    }
  }
];

/**
 * Bug 1 fix — karat detection:
 * Parse the customer's free-text description for an explicit metal / karat mention
 * so the FormData metalType field is set correctly before the API call.
 * The API route defaults to "14K" when no metalType is sent — which biases the AI
 * prompt and causes 18K requests to always be stored as 14K.
 */
function detectMetalFromDescription(text: string): string {
  const normalized = text.toLowerCase();
  if (/platinum/.test(normalized)) return "Platinum";
  if (/sterling|silver/.test(normalized)) return "Silver";
  if (/18\s*k(?:arat)?|18-karat/.test(normalized)) return "18K";
  if (/10\s*k(?:arat)?|10-karat/.test(normalized)) return "10K";
  if (/14\s*k(?:arat)?|14-karat/.test(normalized)) return "14K";
  return "14K"; // safe default when no karat is mentioned
}

const METAL_OPTIONS = ["10K", "14K", "18K", "Platinum", "Silver"];

function formatMetalDisplay(metal: string, metalColor?: string | null) {
  if (metal === "Platinum" || metal === "Silver") return metal;
  if (!metalColor) return metal;
  const suffix = metalColor === "rose" ? "rose gold" : `${metalColor} gold`;
  return `${metal} ${suffix}`;
}

function formatStoneColor(color?: string | null) {
  if (!color) return "";
  return color.trim();
}

function getRingSpecTitle(analysis: Analysis | null): string {
  if (!analysis) return "Custom Jewelry Design";
  const metal = formatMetalDisplay(analysis.selectedMetal || "14K", analysis.metalColor);
  const centerCarat = Number(analysis.centerDiamondCarats || 0).toFixed(2);
  const centerShape = analysis.centerShape ? `${formatStoneColor(analysis.centerStoneColor) ? `${formatStoneColor(analysis.centerStoneColor)} ` : ""}${analysis.centerShape}` : "Diamond";
  const sideCarat = Number(analysis.sideDiamondCarats || 0);
  const sideQty = analysis.sideDiamondQuantity || 0;
  
  const sideText = sideQty > 0 && sideCarat > 0
    ? ` · ${sideCarat.toFixed(2)}ct Side Diamonds (${sideQty}×)`
    : "";

  const bandText = analysis.hasWeddingBand ? " + Matching Band" : "";
  const twoToneText = analysis.isTwoTone ? " (Two-Tone)" : "";

  return `${metal} · ${centerCarat}ct ${centerShape}${sideText}${bandText}${twoToneText} ${analysis.jewelryType || "Ring"}`;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

const ANGLE_SLOTS = [
  { id: "top_face" as const, title: "Top / Face View", badge: "Primary Anchor", desc: "Anchors shape & ct weight", icon: "diamond" },
  { id: "side_profile" as const, title: "Side Profile", badge: "Under-Gallery", desc: "Basket, prongs & gallery", icon: "filter_hdr" },
  { id: "angle_view" as const, title: "Angle 3/4 View", badge: "Perspective", desc: "Shank & shoulder stones", icon: "view_in_ar" },
  { id: "tag_receipt" as const, title: "Tag / Receipt", badge: "Ground Truth", desc: "Printed ct & quality codes", icon: "receipt_long" }
];

type AngleSlotKey = (typeof ANGLE_SLOTS)[number]["id"];

export default function ShowroomKiosk({ token, branding, pricing }: { token: string; branding: Branding; pricing: Pricing }) {
  const { deviceToken } = useShowroomDevice();
  const brandStyle = useMemo(() => {
    const brandColor = branding.primaryColor || "#c9a84c";
    const backgroundColor = branding.backgroundColor || "#08090b";
    const red = Number.parseInt(brandColor.slice(1, 3), 16);
    const green = Number.parseInt(brandColor.slice(3, 5), 16);
    const blue = Number.parseInt(brandColor.slice(5, 7), 16);
    const lighten = (channel: number) => Math.round(channel + (255 - channel) * 0.28);

    return {
      "--color-brand": brandColor,
      "--color-brand-light": `rgb(${lighten(red)}, ${lighten(green)}, ${lighten(blue)})`,
      "--color-brand-glow": `rgba(${red}, ${green}, ${blue}, 0.3)`,
      "--showroom-background": backgroundColor,
      "--showroom-overlay-color": branding.overlayColor || "#000000",
      "--showroom-overlay-opacity": String((branding.overlayOpacity ?? 58) / 100),
      "--showroom-text": branding.textColor || "#ffffff",
      "--showroom-background-fit": branding.backgroundFit === "contain" ? "contain" : "cover",
      "--showroom-background-position": branding.backgroundPosition || "center",
      "--showroom-panel-opacity": `${branding.panelOpacity ?? 34}%`
    } as CSSProperties;
  }, [branding]);

  const [currency, setCurrency] = useState<SupportedCurrency>(pricing.defaultCurrency || "USD");
  const [started, setStarted] = useState(false);
  const [slotFiles, setSlotFiles] = useState<Record<AngleSlotKey, File | null>>({
    top_face: null,
    side_profile: null,
    angle_view: null,
    tag_receipt: null
  });
  const [activeUploadSlot, setActiveUploadSlot] = useState<AngleSlotKey | null>(null);
  const files = useMemo(() => {
    return [slotFiles.top_face, slotFiles.side_profile, slotFiles.angle_view, slotFiles.tag_receipt].filter(Boolean) as File[];
  }, [slotFiles]);
  const [description, setDescription] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [jewelryFacts, setJewelryFacts] = useState<JewelryFactItem[]>(JEWELRY_FACTS_COLLECTION);
  const [factOrder, setFactOrder] = useState<number[]>(JEWELRY_FACTS_COLLECTION.map((_, index) => index));
  const [factIndex, setFactIndex] = useState(0);
  const [showTriviaAnswer, setShowTriviaAnswer] = useState(false);
  const factSwipeStartXRef = useRef<number | null>(null);
  const factOrderSeedRef = useRef(0);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisIds, setAnalysisIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingProgress, setSavingProgress] = useState(0);
  const [renderingImageUrl, setRenderingImageUrl] = useState<string | null>(null);
  const [generatingConcept, setGeneratingConcept] = useState(false);
  const [renderFeedback, setRenderFeedback] = useState("");
  const [appliedRenderFeedback, setAppliedRenderFeedback] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [shareToken, setShareToken] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState(false);
  const [saved, setSaved] = useState(false);

  // Customer Contact Details (Mandatory on Showroom)
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [contactErrors, setContactErrors] = useState<{ name?: string; email?: string; phone?: string }>({});

  // QR Code Share Modal States
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [qrShareUrl, setQrShareUrl] = useState<string>("");
  const [sharing, setSharing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Mobile Photo Upload QR Bridge States
  const [showMobileUploadModal, setShowMobileUploadModal] = useState(false);
  const [mobileUploadSessionId, setMobileUploadSessionId] = useState<string>("");
  const [mobileUploadQrDataUrl, setMobileUploadQrDataUrl] = useState<string | null>(null);

  // Live In-App Camera Modal State
  const [showLiveCamera, setShowLiveCamera] = useState(false);

  // Staff Mode States
  const [showStaffPinModal, setShowStaffPinModal] = useState(false);
  const [staffSession, setStaffSession] = useState<{ staffName: string; staffId: string; sessionToken: string } | null>(null);
  const [marketingIndex, setMarketingIndex] = useState(0);
  const [imageAspectRatios, setImageAspectRatios] = useState<Record<string, string>>({});
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [displayMode, setDisplayMode] = useState<"showroom" | "marketing">(() => {
    if (typeof window === "undefined") return "showroom";
    try {
      const storedMode = window.localStorage.getItem("azzure_showroom_display_mode");
      return storedMode === "marketing" || storedMode === "showroom" ? storedMode : "showroom";
    } catch {
      return "showroom";
    }
  });

  const slotPreviews = useMemo(() => {
    const map: Record<AngleSlotKey, string | null> = {
      top_face: slotFiles.top_face ? URL.createObjectURL(slotFiles.top_face) : null,
      side_profile: slotFiles.side_profile ? URL.createObjectURL(slotFiles.side_profile) : null,
      angle_view: slotFiles.angle_view ? URL.createObjectURL(slotFiles.angle_view) : null,
      tag_receipt: slotFiles.tag_receipt ? URL.createObjectURL(slotFiles.tag_receipt) : null
    };
    return map;
  }, [slotFiles]);

  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  const debouncedAnalysis = useDebouncedValue(analysis, 300);
  const showroomHeaders = useMemo(
    () => (deviceToken ? { "X-Device-Token": deviceToken } : undefined),
    [deviceToken]
  );

  const reset = useCallback(() => {
    setStarted(false);
    setSlotFiles({ top_face: null, side_profile: null, angle_view: null, tag_receipt: null });
    setDescription("");
    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");
    setContactErrors({});
    setAnalyzing(false);
    setStageIndex(0);
    setAnalysis(null);
    setAnalysisIds([]);
    setSaving(false);
    setSavingProgress(0);
    setRenderingImageUrl(null);
    setGeneratingConcept(false);
    setRenderFeedback("");
    setAppliedRenderFeedback([]);
    setCode("");
    setPrice(null);
    setError("");
    setWarning(false);
    setSaved(false);
    setShowQrModal(false);
    setQrCodeDataUrl(null);
    setQrShareUrl("");
    setShowMobileUploadModal(false);
    setMobileUploadSessionId("");
    setMobileUploadQrDataUrl(null);
  }, []);

  const addReferenceFiles = useCallback((incomingFiles: File[], targetSlot?: AngleSlotKey) => {
    if (incomingFiles.length === 0) return;
    setSlotFiles((current) => {
      if (targetSlot) {
        return { ...current, [targetSlot]: incomingFiles[0] };
      }
      const next = { ...current };
      const allSlots: AngleSlotKey[] = ["top_face", "side_profile", "angle_view", "tag_receipt"];
      const remainingSlots = allSlots.filter((s) => !next[s]);
      const unassignedFiles: File[] = [];

      // Step 1: Match files with explicit name hints
      for (const file of incomingFiles) {
        const name = file.name.toLowerCase();
        let matchedSlot: AngleSlotKey | null = null;

        if (name.includes("tag") || name.includes("receipt") || name.includes("label") || name.includes("price") || name.includes("sku")) {
          matchedSlot = "tag_receipt";
        } else if (name.includes("top") || name.includes("face") || name.includes("front") || name.includes("main") || name.includes("primary")) {
          matchedSlot = "top_face";
        } else if (name.includes("side") || name.includes("profile") || name.includes("gallery") || name.includes("shank")) {
          matchedSlot = "side_profile";
        } else if (name.includes("angle") || name.includes("34") || name.includes("persp") || name.includes("tilt")) {
          matchedSlot = "angle_view";
        }

        if (matchedSlot && !next[matchedSlot]) {
          next[matchedSlot] = file;
          const idx = remainingSlots.indexOf(matchedSlot);
          if (idx !== -1) remainingSlots.splice(idx, 1);
        } else {
          unassignedFiles.push(file);
        }
      }

      // Step 2: Fill remaining empty slots in order
      for (const file of unassignedFiles) {
        if (remainingSlots.length > 0) {
          const slot = remainingSlots.shift()!;
          next[slot] = file;
        }
      }

      // Step 3: If all slots were already full, overwrite starting from top_face
      if (incomingFiles.length > 0 && remainingSlots.length === 0 && unassignedFiles.length === incomingFiles.length) {
        incomingFiles.slice(0, 4).forEach((file, idx) => {
          if (allSlots[idx]) next[allSlots[idx]] = file;
        });
      }

      return next;
    });
    setAnalysis(null);
    setRenderingImageUrl(null);
    setRenderFeedback("");
    setAppliedRenderFeedback([]);
    setError("");
  }, []);

  const swapSlots = useCallback((slotA: AngleSlotKey, slotB: AngleSlotKey) => {
    if (slotA === slotB) return;
    setSlotFiles((current) => {
      const next = { ...current };
      const temp = next[slotA];
      next[slotA] = next[slotB];
      next[slotB] = temp;
      return next;
    });
    setAnalysis(null);
    setRenderingImageUrl(null);
    setRenderFeedback("");
    setAppliedRenderFeedback([]);
  }, []);

  const removeSlotFile = useCallback((slot: AngleSlotKey) => {
    setSlotFiles((current) => ({ ...current, [slot]: null }));
    setAnalysis(null);
    setRenderingImageUrl(null);
    setRenderFeedback("");
    setAppliedRenderFeedback([]);
  }, []);

  const registerImageAspectRatio = useCallback((src: string, width: number, height: number) => {
    if (!src || width <= 0 || height <= 0) return;
    const nextAspectRatio = `${width} / ${height}`;
    setImageAspectRatios((current) => (current[src] === nextAspectRatio ? current : { ...current, [src]: nextAspectRatio }));
  }, []);

  const handleImageLoad = useCallback(
    (src: string) =>
      (event: SyntheticEvent<HTMLImageElement>) => {
        registerImageAspectRatio(src, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight);
      },
    [registerImageAspectRatio]
  );

  const getImageAspectRatio = useCallback(
    (src: string | null | undefined, fallback = "1 / 1") => {
      if (!src) return fallback;
      return imageAspectRatios[src] || fallback;
    },
    [imageAspectRatios]
  );

  // Fetch dynamic AI web-searched fine jewelry facts
  const refreshAIJewelryFacts = useCallback(async () => {
    try {
      const res = await fetch("/api/showroom/facts", {
        headers: showroomHeaders
      });
      if (res.ok) {
        const data = await res.json();
        if (data.facts && Array.isArray(data.facts) && data.facts.length > 0) {
          setJewelryFacts(data.facts);
        }
      }
    } catch {
      // Retain fallback collection on error
    }
  }, [showroomHeaders]);

  const buildFactOrder = useCallback((total: number, seed: number) => {
    if (total <= 1) {
      return Array.from({ length: total }, (_, index) => index);
    }

    const indices = Array.from({ length: total }, (_, index) => index);
    const offset = Math.abs(seed) % total;
    return [...indices.slice(offset), ...indices.slice(0, offset)];
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshAIJewelryFacts();
    }, 0);
    return () => clearTimeout(timer);
  }, [refreshAIJewelryFacts]);

  useEffect(() => {
    const total = jewelryFacts.length || JEWELRY_FACTS_COLLECTION.length;
    setFactOrder(buildFactOrder(total, factOrderSeedRef.current));
    setFactIndex(0);
  }, [buildFactOrder, jewelryFacts.length]);

  useEffect(() => {
    // The idle clock only used to reset on touch/pointer activity, so it kept
    // counting down through an in-flight AI analysis/save/share — a slow
    // response (or the customer just watching the screen without touching it)
    // could fire the reset right as results came back, dumping the kiosk back
    // to the landing screen. Pause the countdown entirely while any of that
    // work is active, and restart the full window the moment it finishes.
    const busy = analyzing || saving || sharing || generatingConcept;
    let warn: ReturnType<typeof setTimeout>;
    let clear: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(warn);
      clearTimeout(clear);
      setWarning(false);
      if (busy) return;
      warn = setTimeout(() => setWarning(true), 110_000);
      clear = setTimeout(reset, 120_000);
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
  }, [reset, analyzing, saving, sharing, generatingConcept]);

  const totalFacts = jewelryFacts.length || JEWELRY_FACTS_COLLECTION.length;
  const marketingImages = branding.marketingImages || [];
  const hasMarketingSlider = marketingImages.length > 1;
  const currentMarketingIndex = marketingImages.length > 0 ? marketingIndex % marketingImages.length : 0;
  const marketingIsImmersive = displayMode === "marketing";
  const currentMarketingImage = marketingImages[currentMarketingIndex] || null;
  const currentMarketingAspectRatio = getImageAspectRatio(currentMarketingImage, marketingIsImmersive ? "16 / 9" : "16 / 10");
  const marketingPanelMaxWidth = marketingIsImmersive ? 1440 : 760;
  const marketingPanelPadding = marketingIsImmersive ? 0 : 14;
  const marketingImageMinHeight = marketingIsImmersive ? "100vh" : 280;
  const marketingImageMaxHeight = marketingIsImmersive ? "100vh" : "none";
  const marketingImageAspectRatio = currentMarketingAspectRatio;
  const viewportAspectRatio = viewportSize.height > 0 ? viewportSize.width / viewportSize.height : 0;
  const marketingImageRatio = useMemo(() => {
    const [widthPart, heightPart] = currentMarketingAspectRatio.split("/").map((part) => Number.parseFloat(part.trim()));
    if (!Number.isFinite(widthPart) || !Number.isFinite(heightPart) || widthPart <= 0 || heightPart <= 0) {
      return 0;
    }

    return widthPart / heightPart;
  }, [currentMarketingAspectRatio]);
  const marketingImageFit = useMemo(() => {
    if (!marketingIsImmersive) return "contain";
    if (!viewportAspectRatio || !marketingImageRatio) return "cover";

    const ratioDelta = Math.abs(marketingImageRatio - viewportAspectRatio) / viewportAspectRatio;
    return ratioDelta > 0.12 ? "contain" : "cover";
  }, [marketingImageRatio, marketingIsImmersive, viewportAspectRatio]);

  useEffect(() => {
    const updateViewportSize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };

    updateViewportSize();
    window.addEventListener("resize", updateViewportSize);
    window.addEventListener("orientationchange", updateViewportSize);
    return () => {
      window.removeEventListener("resize", updateViewportSize);
      window.removeEventListener("orientationchange", updateViewportSize);
    };
  }, []);

  // Background remote telemetry & command execution for store owners
  useEffect(() => {
    let timer: number | undefined;

    const runHeartbeat = async () => {
      const storedDeviceToken = typeof window !== "undefined" ? localStorage.getItem("azzure_showroom_device_token") : null;
      if (!storedDeviceToken || !token) return;

      try {
        const res = await fetch("/api/showroom/devices/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            deviceToken: storedDeviceToken,
            showroomToken: token,
            screenResolution: `${window.innerWidth}x${window.innerHeight}`,
            currentMode: displayMode,
            lastError: error || null,
            appVersion: "1.0.0"
          })
        });

        if (!res.ok) return;
        const data = await res.json();

        // Process remote commands dispatched by store owner / admin
        if (Array.isArray(data?.commands)) {
          for (const cmd of data.commands) {
            if (cmd.command === "reload") {
              window.location.reload();
            } else if (cmd.command === "clear_cache") {
              try {
                localStorage.removeItem("azzure_showroom_draft");
                sessionStorage.clear();
                reset();
              } catch {}
            } else if (cmd.command === "set_mode_marketing") {
              setDisplayMode("marketing");
            } else if (cmd.command === "set_mode_quoting") {
              setDisplayMode("showroom");
            } else if (cmd.command === "reset_draft") {
              reset();
            }
          }
        }
      } catch {
        // Silently ignore background polling errors
      }
    };

    runHeartbeat();
    timer = window.setInterval(runHeartbeat, 15000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [token, displayMode, error, reset]);
  const modeToggle = (
    <button
      type="button"
      title="Switch to Marketing Mode"
      aria-label="Switch to Marketing Mode"
      onClick={() => {
        setDisplayMode("marketing");
        if (marketingImages.length > 1) {
          setMarketingIndex(0);
        }
      }}
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 80,
        width: 44,
        height: 44,
        padding: 0,
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        border: "1px solid rgba(255, 255, 255, 0.16)",
        background: "rgba(0, 0, 0, 0.45)",
        color: "#7dd3fc",
        backdropFilter: "blur(14px)",
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.35)",
        transition: "all 0.2s ease"
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    </button>
  );

  useEffect(() => {
    try {
      window.localStorage.setItem("azzure_showroom_display_mode", displayMode);
    } catch {}
  }, [displayMode]);

  useEffect(() => {
    if (!hasMarketingSlider) return;
    if (displayMode !== "marketing" && started) return;
    const timer = window.setInterval(() => {
      setMarketingIndex((current) => (current + 1) % marketingImages.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [displayMode, hasMarketingSlider, marketingImages.length, started]);

  useEffect(() => {
    if (displayMode !== "marketing") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDisplayMode("showroom");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [displayMode]);

  const goToPreviousFact = useCallback(() => {
    setFactIndex((current) => (current - 1 + totalFacts) % totalFacts);
    setShowTriviaAnswer(false);
  }, [totalFacts]);

  const goToNextFact = useCallback(() => {
    setFactIndex((current) => (current + 1) % totalFacts);
    setShowTriviaAnswer(false);
  }, [totalFacts]);

  const handleFactTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    factSwipeStartXRef.current = event.touches[0]?.clientX ?? null;
  }, []);

  const handleFactTouchEnd = useCallback((event: TouchEvent<HTMLDivElement>) => {
    const startX = factSwipeStartXRef.current;
    const endX = event.changedTouches[0]?.clientX ?? null;
    factSwipeStartXRef.current = null;

    if (startX === null || endX === null) return;
    const deltaX = endX - startX;
    if (Math.abs(deltaX) < 40) return;

    if (deltaX < 0) {
      goToNextFact();
    } else {
      goToPreviousFact();
    }
  }, [goToNextFact, goToPreviousFact]);

  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);

  async function openMobileUploadQr() {
    const sessionId = crypto.randomUUID();
    setMobileUploadSessionId(sessionId);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const uploadLink = `${origin}/showroom/mobile-upload?sessionId=${sessionId}&token=${encodeURIComponent(token)}`;
    try {
      const qr = await QRCode.toDataURL(uploadLink, { width: 320, margin: 2 });
      setMobileUploadQrDataUrl(qr);
      setShowMobileUploadModal(true);
    } catch {
      setError("Failed to generate mobile upload QR code.");
    }
  }

  // Poll for mobile phone uploads when QR modal is open
  useEffect(() => {
    if (!showMobileUploadModal || !mobileUploadSessionId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/showroom/mobile-upload?sessionId=${mobileUploadSessionId}&token=${encodeURIComponent(token)}`, {
          headers: showroomHeaders
        });
        const data = await res.json();
          if (data.files && data.files.length > 0) {
            const convertedFiles: File[] = await Promise.all(
              data.files.map(async (f: { name: string; type: string; dataUrl: string }, idx: number) => {
                const fetchRes = await fetch(f.dataUrl);
                const blob = await fetchRes.blob();
                return new File([blob], f.name || `phone_photo_${idx + 1}.jpg`, { type: f.type || "image/jpeg" });
              })
            );
            addReferenceFiles(convertedFiles);
          setShowMobileUploadModal(false);
        }
      } catch {
        // ignore background poll errors
      }
    }, 1800);

    return () => clearInterval(interval);
  }, [showMobileUploadModal, mobileUploadSessionId, token, showroomHeaders, addReferenceFiles]);

  const estimatedSellingPrice = useMemo(() => {
    if (!debouncedAnalysis || !pricing.pricingTier) return 0;

    const centerCarat = debouncedAnalysis.centerDiamondCarats || 0;
    const centerShape = debouncedAnalysis.centerShape && debouncedAnalysis.centerShape.toLowerCase() !== "none" ? debouncedAnalysis.centerShape : "round";
    const detectedSideShape = (centerShape && ["emerald", "radiant", "cushion", "oval", "pear", "princess"].includes(centerShape.toLowerCase()) && debouncedAnalysis.sideDiamondQuantity <= 4)
      ? "fancy"
      : "round";

    const sideStones =
      debouncedAnalysis.sideDiamondQuantity > 0 && debouncedAnalysis.sideDiamondCarats > 0
        ? [
            {
              shape: detectedSideShape,
              caratWeightEach: debouncedAnalysis.sideDiamondCarats / debouncedAnalysis.sideDiamondQuantity,
              count: debouncedAnalysis.sideDiamondQuantity,
              settingType: debouncedAnalysis.settingType || "prong"
            }
          ]
        : [];

    try {
      const breakdown = calculateProductionCost({
        pricingProfile: pricing.pricingProfile,
        metalType: debouncedAnalysis.selectedMetal || "14K",
        metalWeightGrams: debouncedAnalysis.metalWeightGrams || 6,
        centerStone: { shape: centerShape, caratWeight: centerCarat },
        sideStones,
        hasWeddingBand: Boolean(debouncedAnalysis.hasWeddingBand),
        isTwoTone: Boolean(debouncedAnalysis.isTwoTone),
        colorClarity: DEFAULT_COLOR_CLARITY,
        cadCost: pricing.cadCost && pricing.cadCost > 0 ? pricing.cadCost : 20,
        pricingTier: pricing.pricingTier,
        customerMarginPct: pricing.customerMarginPct
      });
      return breakdown.estimatedSellingPrice;
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

  const analysisAbortControllerRef = useRef<AbortController | null>(null);

  function stopAnalysis() {
    if (analysisAbortControllerRef.current) {
      analysisAbortControllerRef.current.abort();
      analysisAbortControllerRef.current = null;
    }
    setAnalyzing(false);
    setError("Analysis was stopped.");
  }

  async function runAnalysis(selectedFiles?: File[]) {
    const hasFiles = files.length > 0 || (selectedFiles && selectedFiles.length > 0);
    const hasDesc = description.trim().length > 0;
    if ((!hasFiles && !hasDesc) || analyzing) {
      if (!hasFiles && !hasDesc) {
        setError("Please upload a reference photo or describe your custom design.");
      }
      return;
    }

    setAnalyzing(true);
    setStageIndex(0);
    setError("");
    setAnalysis(null);
    setRenderingImageUrl(null);
    setRenderFeedback("");
    setAppliedRenderFeedback([]);

    const controller = new AbortController();
    analysisAbortControllerRef.current = controller;

    const pulser = window.setInterval(() => {
      setStageIndex((current) => (current + 1) % KIOSK_ANALYSIS_STAGES.length);
    }, 900);

    factOrderSeedRef.current += 1;
    setFactOrder(buildFactOrder(jewelryFacts.length || JEWELRY_FACTS_COLLECTION.length, factOrderSeedRef.current));
    setFactIndex(0);
    setShowTriviaAnswer(false);

    try {
      const detectedMetal = detectMetalFromDescription(description);

      const form = new FormData();
      form.set("token", token);
      form.set("metalType", detectedMetal);
      if (hasDesc) form.set("description", description.trim());

      ANGLE_SLOTS.forEach((slot) => {
        const file = slotFiles[slot.id];
        if (file) {
          form.append("images", file);
          form.append("angles", slot.id);
        }
      });

      const response = await fetch("/api/showroom/analyze", {
        method: "POST",
        headers: showroomHeaders,
        body: form,
        signal: controller.signal
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Analysis failed. Please try again.");
      if (!body) throw new Error("The server is momentarily busy or updating. Please try again.");
      setAnalysisIds([body.analysisId]);
      setAnalysis(body);
      if (body.renderingImageUrl) {
        setRenderingImageUrl(body.renderingImageUrl);
      } else {
        // Automatically trigger 3D studio render in background if initial analyze omitted it
        triggerRender3D(body);
      }
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setError("Analysis was stopped.");
      } else {
        setError(e instanceof Error ? e.message : "Analysis failed.");
      }
    } finally {
      window.clearInterval(pulser);
      setAnalyzing(false);
      analysisAbortControllerRef.current = null;
    }
  }

  async function triggerRender3D(overrideAnalysis?: Analysis | null, refinementPrompt?: string, feedbackEntry?: string) {
    const target = overrideAnalysis ?? analysis;
    if (generatingConcept) return;

    setGeneratingConcept(true);
    setError("");

    try {
      const response = await fetch("/api/showroom/render", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...showroomHeaders },
        body: JSON.stringify({
          token,
          jewelryType: target?.jewelryType || "Ring",
          metalType: target?.selectedMetal || "14K",
          metalColor: target?.metalColor || null,
          metalWeightGrams: target?.metalWeightGrams || 5,
          centerShape: target?.centerShape || "Pear",
          centerCarats: target?.centerDiamondCarats || 1.0,
          sideDiamondQuantity: target?.sideDiamondQuantity || 0,
          sideDiamondCarats: target?.sideDiamondCarats || 0,
          settingType: target?.settingType || null,
          centerClarity: target?.centerClarity || "VS1",
          description: description.trim(),
          refinementPrompt
        })
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Failed to generate 3D render.");
      if (data?.renderingImageUrl) {
        setRenderingImageUrl(data.renderingImageUrl);
        if (data.revisedSpecs) {
          setAnalysis((current) => current ? { ...current, ...data.revisedSpecs } : current);
        }
        if (refinementPrompt) {
          setAppliedRenderFeedback((current) => [...current, feedbackEntry || refinementPrompt]);
          setRenderFeedback("");
        }
      }
    } catch (err) {
      console.warn("[triggerRender3D] Rendering warning:", err);
      setError(err instanceof Error ? err.message : "3D rendering failed.");
    } finally {
      setGeneratingConcept(false);
    }
  }

  async function generateAiConcept() {
    if (!description.trim() || generatingConcept) return;

    setGeneratingConcept(true);
    setError("");
    try {
      const response = await fetch("/api/concept/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: description.trim(),
          jewelryType: analysis?.jewelryType || "Ring",
          selectedMetal: analysis?.selectedMetal || "14K",
          aspectRatio: "1:1"
        })
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error || "Failed to generate AI 3D concept.");
      }
      if (!body) {
        throw new Error("The server is momentarily busy. Please try again.");
      }

      if (body.imageUrl) {
        setRenderingImageUrl(body.imageUrl);
      }
      if (body.analysis && !analysis) {
        setAnalysis(body.analysis);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate AI concept.");
    } finally {
      setGeneratingConcept(false);
    }
  }

  function validateContactInfo(): boolean {
    const errors: { name?: string; email?: string; phone?: string } = {};
    if (!customerName.trim()) {
      errors.name = "Please enter your full name.";
    }
    if (!customerEmail.trim()) {
      errors.email = "Please enter your email address.";
    } else {
      const emailCheck = validateEmail(customerEmail.trim());
      if (!emailCheck.valid) {
        errors.email = emailCheck.error || "Please enter a valid email address.";
      }
    }
    if (!customerPhone.trim()) {
      errors.phone = "Please enter your phone number.";
    } else if (customerPhone.trim().replace(/\D/g, "").length < 7) {
      errors.phone = "Please enter a valid phone number (at least 7 digits).";
    }

    if (Object.keys(errors).length > 0) {
      setContactErrors(errors);
      setError(errors.email || errors.phone || errors.name || "Please fill in valid contact information.");
      return false;
    }
    setContactErrors({});
    return true;
  }

  async function save() {
    if (!analysis) return;
    if (!validateContactInfo()) return;
    setError("");
    setSaving(true);
    setSavingProgress(0);

    const progressTimer = window.setInterval(() => {
      setSavingProgress((current) => Math.min(90, current + 6));
    }, 1600);

    try {
      const response = await fetch("/api/showroom/quotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(showroomHeaders || {})
        },
        body: JSON.stringify({
          token,
          description,
          customerNotes: description,
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim(),
          customerPhone: customerPhone.trim(),
          analysisIds,
          primaryAnalysisId: analysis.analysisId,
          metalType: analysis.selectedMetal,
          selectedMetal: analysis.selectedMetal,
          metalWeightGrams: analysis.metalWeightGrams,
          centerDiamondCarats: analysis.centerDiamondCarats,
          centerCarats: analysis.centerDiamondCarats,
          sideDiamondCarats: analysis.sideDiamondCarats,
          sideCarats: analysis.sideDiamondCarats,
          sideDiamondQuantity: analysis.sideDiamondQuantity,
          centerShape: analysis.centerShape,
          settingType: analysis.settingType,
          hasWeddingBand: analysis.hasWeddingBand ?? false,
          isTwoTone: analysis.isTwoTone ?? false,
          estimatedPrice: estimatedSellingPrice,
          renderingImageUrl: renderingImageUrl || null
        })
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Failed to save quote.");
      if (!body) throw new Error("Server was momentarily busy. Please try again.");

      const savedCode = body.code || body.displayCode || "";
      const savedPrice = body.estimatedPrice ?? body.estimatedSellingPrice ?? 0;
      setCode(savedCode);
      setShareToken(body.shareToken || "");
      setPrice(savedPrice);
      if (body.renderingImageUrl) {
        setRenderingImageUrl(body.renderingImageUrl);
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save quote.");
    } finally {
      window.clearInterval(progressTimer);
      setSaving(false);
    }
  }

  async function handleShareQr() {
    if (sharing) return;
    setSharing(true);
    setError("");
    let currentCode = code;
    let currentShareToken = shareToken;

    try {
      if (!saved || !currentCode) {
        if (!analysis) {
          throw new Error("Please upload a design and run analysis before sharing.");
        }
        if (!validateContactInfo()) {
          setSharing(false);
          return;
        }
        setSaving(true);
        setSavingProgress(0);
        const progressTimer = window.setInterval(() => {
          setSavingProgress((curr) => Math.min(90, curr + 8));
        }, 300);

        const response = await fetch("/api/showroom/quotes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(showroomHeaders || {})
          },
          body: JSON.stringify({
            token,
            description,
            customerNotes: description,
            customerName: customerName.trim(),
            customerEmail: customerEmail.trim(),
            customerPhone: customerPhone.trim(),
            analysisIds,
            primaryAnalysisId: analysis.analysisId,
            metalType: analysis.selectedMetal,
            selectedMetal: analysis.selectedMetal,
            metalWeightGrams: analysis.metalWeightGrams,
            centerDiamondCarats: analysis.centerDiamondCarats,
            centerCarats: analysis.centerDiamondCarats,
            sideDiamondCarats: analysis.sideDiamondCarats,
            sideCarats: analysis.sideDiamondCarats,
            sideDiamondQuantity: analysis.sideDiamondQuantity,
            centerShape: analysis.centerShape,
            settingType: analysis.settingType,
            hasWeddingBand: analysis.hasWeddingBand ?? false,
            isTwoTone: analysis.isTwoTone ?? false,
            estimatedPrice: estimatedSellingPrice,
            renderingImageUrl: renderingImageUrl || null
          })
        });

        window.clearInterval(progressTimer);
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Failed to save quote for sharing.");
        if (!data) throw new Error("Server was momentarily busy. Please try again.");
        currentCode = data.code || data.displayCode || "";
        currentShareToken = data.shareToken || "";
        setCode(currentCode);
        setShareToken(currentShareToken);
        setPrice(data.estimatedPrice ?? data.estimatedSellingPrice ?? 0);
        if (data.renderingImageUrl) setRenderingImageUrl(data.renderingImageUrl);
        setSaved(true);
        setSaving(false);
      }

      if (!currentShareToken) {
        throw new Error("Unable to generate a shareable link for this quote. Please try again.");
      }

      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const shareUrl = `${origin}/q/${currentShareToken}/pdf`;
      setQrShareUrl(shareUrl);

      const qrDataUrl = await QRCode.toDataURL(shareUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: "#08090b",
          light: "#ffffff"
        }
      });
      setQrCodeDataUrl(qrDataUrl);
      setShowQrModal(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate QR Code for sharing.");
    } finally {
      setSharing(false);
      setSaving(false);
    }
  }

  const activeImage = renderingImageUrl || (previews.length > 0 ? previews[0] : null);

  if (staffSession) {
    return (
      <KioskStaffView
        staffName={staffSession.staffName}
        sessionToken={staffSession.sessionToken}
        brandColor={branding.primaryColor || "#c9a84c"}
        onExit={() => setStaffSession(null)}
      />
    );
  }

  if (false) {
    return (
      <div
        className="showroom"
        style={{
          ...brandStyle,
          width: "100vw",
          height: "100vh",
          minHeight: "100vh",
          overflow: "hidden",
          position: "relative",
          background: branding.backgroundColor || "#030304"
        }}
      >
        {branding.backgroundMediaUrl ? (
          branding.backgroundMediaType?.startsWith("video/") ? (
            <video className="showroomBackgroundMedia" src={branding.backgroundMediaUrl ?? undefined} autoPlay muted loop playsInline aria-hidden="true" />
          ) : (
            <img className="showroomBackgroundMedia" src={branding.backgroundMediaUrl ?? undefined} alt="" aria-hidden="true" />
          )
        ) : null}
        {branding.backgroundMediaUrl ? <div className="showroomBackgroundOverlay" aria-hidden="true" /> : null}
        {modeToggle}

        <section
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "clamp(18px, 2vw, 32px)",
            boxSizing: "border-box"
          }}
        >
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 18,
              position: "relative",
              zIndex: 2
            }}
          >
            <div className="showroomBrandIdentity">
              {branding.logoUrl ? (
                <div className="showroomBrandLogoWrapper">
                  <img src={branding.logoUrl ?? undefined} alt={branding.companyName || "Store logo"} className="showroomBrandLogo" />
                </div>
              ) : null}
              <strong>{branding.companyName || "Azzure Custom Studio"}</strong>
            </div>
            <div className="showroomBadge">
              <span className="showroomBadgeDot" />
              Marketing Mode
            </div>
          </header>

          {marketingImages.length > 0 ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "stretch",
                marginTop: "clamp(14px, 2vw, 28px)",
                marginBottom: "clamp(14px, 2vw, 28px)",
                position: "relative",
                zIndex: 2
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  borderRadius: 0,
                  overflow: "hidden",
                  background: "#000"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: "100%",
                    height: "100%",
                    transform: `translateX(-${currentMarketingIndex * 100}%)`,
                    transition: "transform 760ms cubic-bezier(0.22, 1, 0.36, 1)",
                    willChange: "transform"
                  }}
                >
                  {marketingImages.map((image, index) => (
                    <div
                      key={image}
                      style={{
                        minWidth: "100%",
                        minHeight: "100%",
                        height: "100%",
                        position: "relative"
                      }}
                    >
                      <img
                        src={image}
                        alt={`Marketing piece ${index + 1}`}
                        onLoad={handleImageLoad(image)}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          objectPosition: "center center",
                          display: "block"
                        }}
                      />
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background:
                            "linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.12) 28%, rgba(0,0,0,0.08) 72%, rgba(0,0,0,0.35) 100%)"
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    position: "absolute",
                    left: "clamp(18px, 2vw, 32px)",
                    top: "clamp(18px, 2vw, 32px)",
                    zIndex: 3,
                    maxWidth: "min(40vw, 520px)",
                    color: "#fff",
                    textShadow: "0 8px 30px rgba(0,0,0,0.55)"
                  }}
                >
                  <div style={{ color: "#7dd3fc", letterSpacing: "0.22em", fontSize: "0.72rem", fontWeight: 700, marginBottom: 8 }}>
                    FEATURED COLLECTION
                  </div>
                  <h1 style={{ fontFamily: "var(--font-display, Georgia, serif)", fontSize: "clamp(2.8rem, 5vw, 5.6rem)", lineHeight: 0.92, margin: 0 }}>
                    Show your latest offer in full width
                  </h1>
                  <p style={{ marginTop: 14, maxWidth: 460, fontSize: "clamp(0.98rem, 1.5vw, 1.2rem)", lineHeight: 1.55, color: "rgba(255,255,255,0.88)" }}>
                    Run your marketing deal, collection drop, or seasonal promotion on the kiosk without any showroom controls on screen.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {hasMarketingSlider ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                position: "relative",
                zIndex: 2
              }}
            >
              <div style={{ color: "rgba(255,255,255,0.72)", fontSize: "0.9rem", fontWeight: 600 }}>
                {currentMarketingIndex + 1} of {marketingImages.length}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                {marketingImages.map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => setMarketingIndex(index)}
                    aria-label={`View marketing image ${index + 1}`}
                    style={{
                      width: 64,
                      height: 64,
                      padding: 0,
                      borderRadius: 14,
                      overflow: "hidden",
                      border: index === marketingIndex ? "2px solid var(--color-brand)" : "1px solid rgba(255,255,255,0.14)",
                      background: "rgba(255,255,255,0.04)",
                      cursor: "pointer"
                    }}
                  >
                    <img src={image} alt="" onLoad={handleImageLoad(image)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  if (displayMode === "marketing") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          background: "#000000",
          zIndex: 99999,
          margin: 0,
          padding: 0
        }}
      >
        <button
          type="button"
          onClick={() => setDisplayMode("showroom")}
          aria-label="Return to Showroom Mode"
          title="Return to Showroom Mode"
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            zIndex: 100000,
            width: 48,
            height: 48,
            padding: 0,
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            background: "rgba(0, 0, 0, 0.55)",
            color: "#f6e09e",
            backdropFilter: "blur(16px)",
            boxShadow: "0 6px 24px rgba(0, 0, 0, 0.6)",
            transition: "all 0.2s ease"
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="6 3 18 3 22 9 12 22 2 9" />
          </svg>
        </button>

        {marketingImages.length > 0 ? (
          hasMarketingSlider ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                width: `${marketingImages.length * 100}%`,
                height: "100%",
                transform: `translateX(-${currentMarketingIndex * (100 / marketingImages.length)}%)`,
                transition: "transform 820ms cubic-bezier(0.22, 1, 0.36, 1)",
                willChange: "transform"
              }}
            >
              {marketingImages.map((image, index) => (
                <div
                  key={image}
                  style={{
                    position: "relative",
                    width: `${100 / marketingImages.length}%`,
                    height: "100%",
                    flex: "0 0 auto",
                    margin: 0,
                    padding: 0,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  {/* Ambient luxury backdrop glow fills full screen */}
                  <img
                    src={image}
                    alt=""
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      inset: -30,
                      width: "calc(100% + 60px)",
                      height: "calc(100% + 60px)",
                      objectFit: "cover",
                      filter: "blur(45px) brightness(0.35) saturate(1.3)",
                      transform: "scale(1.15)",
                      pointerEvents: "none"
                    }}
                  />
                  {/* Foreground artwork: 100% uncropped with full text, logos, and borders visible on every device */}
                  <img
                    src={image}
                    alt={`Marketing piece ${index + 1}`}
                    style={{
                      position: "relative",
                      maxWidth: "100%",
                      maxHeight: "100%",
                      width: "auto",
                      height: "auto",
                      objectFit: "contain",
                      display: "block",
                      zIndex: 1,
                      boxShadow: "0 0 60px rgba(0, 0, 0, 0.75)"
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden"
              }}
            >
              {/* Ambient luxury backdrop glow fills full screen */}
              <img
                src={marketingImages[0]}
                alt=""
                aria-hidden="true"
                style={{
                  position: "absolute",
                  inset: -30,
                  width: "calc(100% + 60px)",
                  height: "calc(100% + 60px)",
                  objectFit: "cover",
                  filter: "blur(45px) brightness(0.35) saturate(1.3)",
                  transform: "scale(1.15)",
                  pointerEvents: "none"
                }}
              />
              {/* Foreground artwork: 100% uncropped with full text, logos, and borders visible on every device */}
              <img
                src={marketingImages[0]}
                alt="Marketing piece"
                style={{
                  position: "relative",
                  maxWidth: "100%",
                  maxHeight: "100%",
                  width: "auto",
                  height: "auto",
                  objectFit: "contain",
                  display: "block",
                  zIndex: 1,
                  boxShadow: "0 0 60px rgba(0, 0, 0, 0.75)"
                }}
              />
            </div>
          )
        ) : null}
      </div>
    );
  }

  return (
    <div className="showroom" style={brandStyle}>
      {branding.backgroundMediaUrl ? (
        branding.backgroundMediaType?.startsWith("video/") ? (
          <video className="showroomBackgroundMedia" src={branding.backgroundMediaUrl ?? undefined} autoPlay muted loop playsInline aria-hidden="true" />
        ) : (
          <img className="showroomBackgroundMedia" src={branding.backgroundMediaUrl ?? undefined} alt="" aria-hidden="true" />
        )
      ) : null}
      {branding.backgroundMediaUrl ? <div className="showroomBackgroundOverlay" aria-hidden="true" /> : null}
      {modeToggle}
      <button
        type="button"
        onClick={() => setShowStaffPinModal(true)}
        style={{
          position: "fixed",
          left: 16,
          bottom: 16,
          zIndex: 81,
          background: "rgba(0, 0, 0, 0.38)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          color: "rgba(255, 255, 255, 0.78)",
          fontSize: "13px",
          fontWeight: 600,
          letterSpacing: "0.04em",
          cursor: "pointer",
          padding: "10px 16px",
          borderRadius: 999,
          backdropFilter: "blur(14px)",
          textTransform: "none"
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255, 255, 255, 1)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255, 255, 255, 0.78)")}
      >
        Staff Access
      </button>
      <header className="showroomBrand">
        <div className="showroomBrandIdentity">
          {branding.logoUrl ? (
            <div className="showroomBrandLogoWrapper">
              <img src={branding.logoUrl ?? undefined} alt={branding.companyName || "Store logo"} className="showroomBrandLogo" />
            </div>
          ) : null}
          <strong>{branding.companyName || "Azzure Custom Studio"}</strong>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="showroomBadge">
            <span className="showroomBadgeDot" />
            Live Showroom Pricing
          </div>
          {started && !saved ? (
            <button
              className="button secondary button--sm"
              type="button"
              onClick={reset}
              style={{ padding: "6px 14px" }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
              Start Over
            </button>
          ) : null}
        </div>
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
            <div className="showroomRingSpecTitle" style={{ textAlign: "center", maxWidth: 460, margin: "0 auto 16px" }}>
              {getRingSpecTitle(analysis)}
            </div>
            <p className="muted" style={{ margin: "16px 0 0", fontSize: 16, lineHeight: 1.5, color: "#cbd5e1" }}>
              Show this code to your jeweler. They can see your design, adjust anything you want, and place the order.
            </p>
            
            <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 28 }}>
              <button className="showroomButton" type="button" onClick={handleShareQr} style={{ width: "auto", padding: "0 28px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>qr_code_2</span>
                Scan QR / Share PDF
              </button>
              <button className="button secondary button--lg" type="button" onClick={reset} style={{ padding: "0 28px" }}>
                Done
              </button>
            </div>
          </div>
        </section>
      ) : !started ? (
        /* ── 2. WELCOME / STANDBY SCREEN: Inspiration Product Catalog ── */
        <section className="showroomPanel">
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 24, alignItems: "center" }}>
            <div>
              <p className="showroomEyebrow">Bespoke Jewelry Studio &amp; Instant AI Estimator</p>
              <h1 className="showroomHeroTitle">
                Design &amp; Price Your Custom Fine Jewelry <em>in Real Time</em>
              </h1>
              <p className="showroomSubtext">
                Snap or upload an inspiration photo, or explore our signature showcase below. Get an instant gemological analysis, diamond grading breakdown, and transparent quote tailored to your exact specifications.
              </p>

              <button
                className="showroomButton"
                type="button"
                onClick={() => setStarted(true)}
                style={{ marginBottom: 8 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 24 }}>diamond</span>
                Create Your Custom Piece
              </button>
            </div>
          </div>

          {marketingImages.length > 0 ? (
            <section
              style={{
                marginTop: 36,
                width: "100%",
                boxSizing: "border-box"
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "clamp(280px, 48vh, 600px)",
                  borderRadius: 20,
                  overflow: "hidden",
                  border: "1.5px solid rgba(201, 168, 76, 0.35)",
                  boxShadow: "0 20px 60px rgba(0, 0, 0, 0.65)",
                  background: "#050608",
                  margin: "0 auto",
                  boxSizing: "border-box"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    width: "100%",
                    height: "100%",
                    transform: `translateX(-${currentMarketingIndex * 100}%)`,
                    transition: "transform 650ms cubic-bezier(0.22, 1, 0.36, 1)",
                    willChange: "transform"
                  }}
                >
                  {marketingImages.map((image, index) => (
                    <div
                      key={image}
                      style={{
                        minWidth: "100%",
                        height: "100%",
                        position: "relative",
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      {/* Ambient background glow to softly fill wide/tall areas */}
                      <img
                        src={image}
                        alt=""
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          inset: -25,
                          width: "calc(100% + 50px)",
                          height: "calc(100% + 50px)",
                          objectFit: "cover",
                          filter: "blur(35px) brightness(0.3) saturate(1.25)",
                          transform: "scale(1.1)",
                          pointerEvents: "none"
                        }}
                      />
                      {/* Foreground: 100% complete, uncropped full marketing artwork */}
                      <img
                        src={image}
                        alt={`Showroom marketing piece ${index + 1}`}
                        onLoad={handleImageLoad(image)}
                        style={{
                          position: "relative",
                          maxWidth: "100%",
                          maxHeight: "100%",
                          width: "auto",
                          height: "auto",
                          objectFit: "contain",
                          objectPosition: "center center",
                          display: "block",
                          zIndex: 1,
                          boxShadow: "0 4px 30px rgba(0, 0, 0, 0.5)"
                        }}
                      />
                    </div>
                  ))}
                </div>

                {hasMarketingSlider ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setMarketingIndex((current) => (current - 1 + marketingImages.length) % marketingImages.length)}
                      aria-label="Previous marketing image"
                      style={{
                        position: "absolute",
                        left: 16,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                        background: "rgba(0, 0, 0, 0.55)",
                        color: "#ffffff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 4,
                        backdropFilter: "blur(12px)",
                        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.5)"
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 24 }}>chevron_left</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMarketingIndex((current) => (current + 1) % marketingImages.length)}
                      aria-label="Next marketing image"
                      style={{
                        position: "absolute",
                        right: 16,
                        top: "50%",
                        transform: "translateY(-50%)",
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        border: "1px solid rgba(255, 255, 255, 0.3)",
                        background: "rgba(0, 0, 0, 0.55)",
                        color: "#ffffff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        zIndex: 4,
                        backdropFilter: "blur(12px)",
                        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.5)"
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 24 }}>chevron_right</span>
                    </button>

                    {/* Centered Overlay Pagination Dots */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: 16,
                        left: "50%",
                        transform: "translateX(-50%)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 14px",
                        borderRadius: 999,
                        background: "rgba(0, 0, 0, 0.55)",
                        backdropFilter: "blur(12px)",
                        border: "1px solid rgba(255, 255, 255, 0.15)",
                        zIndex: 4
                      }}
                    >
                      {marketingImages.map((image, index) => (
                        <button
                          key={image}
                          type="button"
                          onClick={() => setMarketingIndex(index)}
                          aria-label={`View image ${index + 1}`}
                          style={{
                            width: index === currentMarketingIndex ? 24 : 8,
                            height: 8,
                            borderRadius: 999,
                            border: "none",
                            background: index === currentMarketingIndex ? "var(--color-brand, #c9a84c)" : "rgba(255, 255, 255, 0.4)",
                            cursor: "pointer",
                            padding: 0,
                            transition: "all 0.3s ease"
                          }}
                        />
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            </section>
          ) : null}

        </section>
      ) : (
        /* ── 3. WORKSPACE SCREEN: 3-Step Layout + Photorealistic AI Render ── */
        <section className="showroomStage">
          <QuoteCreationLayout
            steps={
              <>
                <QuoteStepCard
                  number="01"
                  title="Your Details & Design Inspiration"
                  description="Start with the design details first. Contact details are captured when you save or share the quote."
                >
                  {/* Mandatory Customer Contact Section for Showroom */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: 12,
                      marginBottom: 18,
                      padding: "14px 16px",
                      background: "rgba(248, 250, 252, 0.95)",
                      borderRadius: 12,
                      border: Object.keys(contactErrors).length > 0 ? "1px solid #fca5a5" : "1px solid #e2e8f0"
                    }}
                  >
                    <div className="field" style={{ margin: 0 }}>
                      <label htmlFor="showroomCustomerName" style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0f172a" }}>
                        Your Full Name <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input
                        id="showroomCustomerName"
                        autoComplete="name"
                        inputMode="text"
                        value={customerName}
                        onChange={(e) => {
                          setCustomerName(e.target.value);
                          if (contactErrors.name) setContactErrors((prev) => ({ ...prev, name: undefined }));
                        }}
                        placeholder="e.g. Eleanor Vance"
                        style={{
                          borderColor: contactErrors.name ? "#ef4444" : undefined,
                          color: "#0f172a"
                        }}
                      />
                      {contactErrors.name ? (
                        <p style={{ color: "#ef4444", fontSize: "0.75rem", margin: "4px 0 0" }}>{contactErrors.name}</p>
                      ) : null}
                    </div>

                    <div className="field" style={{ margin: 0 }}>
                      <label htmlFor="showroomCustomerEmail" style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0f172a" }}>
                        Email Address <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input
                        id="showroomCustomerEmail"
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        value={customerEmail}
                        onChange={(e) => {
                          setCustomerEmail(e.target.value);
                          if (contactErrors.email) setContactErrors((prev) => ({ ...prev, email: undefined }));
                        }}
                        placeholder="e.g. eleanor@example.com"
                        style={{
                          borderColor: contactErrors.email ? "#ef4444" : undefined,
                          color: "#0f172a"
                        }}
                      />
                      {contactErrors.email ? (
                        <p style={{ color: "#ef4444", fontSize: "0.75rem", margin: "4px 0 0" }}>{contactErrors.email}</p>
                      ) : null}
                    </div>

                    <div className="field" style={{ margin: 0 }}>
                      <label htmlFor="showroomCustomerPhone" style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0f172a" }}>
                        Phone Number <span style={{ color: "#ef4444" }}>*</span>
                      </label>
                      <input
                        id="showroomCustomerPhone"
                        type="tel"
                        autoComplete="tel"
                        inputMode="tel"
                        value={customerPhone}
                        onChange={(e) => {
                          setCustomerPhone(e.target.value);
                          if (contactErrors.phone) setContactErrors((prev) => ({ ...prev, phone: undefined }));
                        }}
                        placeholder="e.g. (212) 555-0198"
                        style={{
                          borderColor: contactErrors.phone ? "#ef4444" : undefined,
                          color: "#0f172a"
                        }}
                      />
                      {contactErrors.phone ? (
                        <p style={{ color: "#ef4444", fontSize: "0.75rem", margin: "4px 0 0" }}>{contactErrors.phone}</p>
                      ) : null}
                    </div>
                  </div>

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
                  </div>

                  {/* Multi-Angle 4-Slot Upload Grid */}
                  <div style={{ marginTop: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div>
                        <strong style={{ fontSize: "0.95rem", color: "inherit", display: "block" }}>
                          Multi-Angle Reference Photos (Up to 4 Slots)
                        </strong>
                        <span className="muted small" style={{ fontSize: "0.8rem" }}>
                          Tagging canonical angles ensures accurate center diamond and setting detection.
                        </span>
                      </div>
                      <button
                        type="button"
                        className="button primary button--sm"
                        onClick={openMobileUploadQr}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px" }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>qr_code_scanner</span>
                        Phone QR
                      </button>
                    </div>

                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                      gap: 12,
                      marginBottom: 16
                    }}>
                      {ANGLE_SLOTS.map((slot, slotIndex) => {
                        const previewSrc = slotPreviews[slot.id];
                        const prevSlot = slotIndex > 0 ? ANGLE_SLOTS[slotIndex - 1].id : null;
                        const nextSlot = slotIndex < ANGLE_SLOTS.length - 1 ? ANGLE_SLOTS[slotIndex + 1].id : null;

                        return (
                          <div
                            key={slot.id}
                            style={{
                              background: previewSrc ? "rgba(201, 168, 76, 0.1)" : "rgba(100, 116, 139, 0.05)",
                              border: previewSrc ? "2px solid rgba(201, 168, 76, 0.7)" : "1.5px dashed rgba(100, 116, 139, 0.35)",
                              borderRadius: 14,
                              padding: "12px 10px",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              minHeight: 185,
                              position: "relative",
                              transition: "all 0.2s ease"
                            }}
                          >
                            {/* Card Header: High contrast text & badges */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 4, marginBottom: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--color-brand, #c9a84c)" }}>
                                  {slot.icon}
                                </span>
                                <span style={{ fontSize: "0.78125rem", fontWeight: 800, color: "var(--showroom-heading, #0f172a)" }}>
                                  {slot.title}
                                </span>
                              </div>
                              <span
                                style={{
                                  fontSize: "0.625rem",
                                  padding: "2px 6px",
                                  borderRadius: 6,
                                  background: slot.id === "top_face" ? "rgba(201, 168, 76, 0.25)" : "rgba(15, 23, 42, 0.12)",
                                  color: slot.id === "top_face" ? "#855d0f" : "#1e293b",
                                  border: slot.id === "top_face" ? "1.5px solid rgba(201, 168, 76, 0.6)" : "1px solid rgba(15, 23, 42, 0.25)",
                                  fontWeight: 800,
                                  whiteSpace: "nowrap"
                                }}
                              >
                                {slot.badge}
                              </span>
                            </div>

                            {previewSrc ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: "auto" }}>
                                <div style={{ position: "relative", width: "100%", height: 80, borderRadius: 8, overflow: "hidden" }}>
                                  <img
                                    src={previewSrc}
                                    alt={slot.title}
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    onLoad={handleImageLoad(previewSrc)}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeSlotFile(slot.id)}
                                    style={{
                                      position: "absolute",
                                      top: 4,
                                      right: 4,
                                      width: 22,
                                      height: 22,
                                      borderRadius: "50%",
                                      background: "rgba(0, 0, 0, 0.8)",
                                      border: "none",
                                      color: "#ffffff",
                                      fontSize: 12,
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      zIndex: 2
                                    }}
                                    title="Remove photo"
                                  >
                                    ✕
                                  </button>
                                </div>

                                {/* Slot Controls: Quick Move Dropdown & Nudge Arrows */}
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                  {prevSlot ? (
                                    <button
                                      type="button"
                                      onClick={() => swapSlots(slot.id, prevSlot)}
                                      title="Move Left"
                                      style={{
                                        padding: "3px 6px",
                                        borderRadius: 6,
                                        border: "1px solid rgba(100, 116, 139, 0.3)",
                                        background: "rgba(255, 255, 255, 0.9)",
                                        color: "#0f172a",
                                        fontSize: "0.7rem",
                                        fontWeight: 800,
                                        cursor: "pointer"
                                      }}
                                    >
                                      ◀
                                    </button>
                                  ) : null}

                                  <select
                                    value={slot.id}
                                    onChange={(e) => swapSlots(slot.id, e.target.value as AngleSlotKey)}
                                    title="Move this photo to another angle slot"
                                    style={{
                                      flex: 1,
                                      padding: "4px 4px",
                                      borderRadius: 6,
                                      border: "1px solid rgba(201, 168, 76, 0.4)",
                                      background: "rgba(255, 255, 255, 0.95)",
                                      color: "#0f172a",
                                      fontSize: "0.6875rem",
                                      fontWeight: 700,
                                      cursor: "pointer"
                                    }}
                                  >
                                    {ANGLE_SLOTS.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.title}
                                      </option>
                                    ))}
                                  </select>

                                  {nextSlot ? (
                                    <button
                                      type="button"
                                      onClick={() => swapSlots(slot.id, nextSlot)}
                                      title="Move Right"
                                      style={{
                                        padding: "3px 6px",
                                        borderRadius: 6,
                                        border: "1px solid rgba(100, 116, 139, 0.3)",
                                        background: "rgba(255, 255, 255, 0.9)",
                                        color: "#0f172a",
                                        fontSize: "0.7rem",
                                        fontWeight: 800,
                                        cursor: "pointer"
                                      }}
                                    >
                                      ▶
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            ) : (
                              <div style={{ textAlign: "center", marginTop: "auto" }}>
                                <p style={{ fontSize: "0.71875rem", color: "#64748b", margin: "0 0 8px", lineHeight: 1.3 }}>
                                  {slot.desc}
                                </p>
                                <label
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 4,
                                    padding: "6px 8px",
                                    background: "rgba(201, 168, 76, 0.15)",
                                    border: "1.5px solid rgba(201, 168, 76, 0.45)",
                                    borderRadius: 6,
                                    color: "var(--color-brand, #c9a84c)",
                                    fontSize: "0.75rem",
                                    fontWeight: 800,
                                    cursor: "pointer",
                                    width: "100%"
                                  }}
                                >
                                  <input
                                    type="file"
                                    accept="image/*"
                                    style={{ display: "none" }}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) addReferenceFiles([file], slot.id);
                                      e.currentTarget.value = "";
                                    }}
                                  />
                                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add_a_photo</span>
                                  Add Angle
                                </label>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Master Actions Bar */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 12 }}>
                      <button
                        type="button"
                        className="button secondary button--sm"
                        onClick={() => setShowLiveCamera(true)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>photo_camera</span>
                        Take Live Camera Photo
                      </button>

                      <label className="button secondary button--sm" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(event) => {
                            const selected = Array.from(event.target.files || []);
                            if (selected.length) {
                              addReferenceFiles(selected);
                            }
                            event.currentTarget.value = "";
                          }}
                          style={{ display: "none" }}
                        />
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>folder_open</span>
                        Choose Files (Auto-Slot)
                      </label>

                      {files.length > 0 && !analyzing ? (
                        <button
                          className="button secondary button--sm"
                          type="button"
                          onClick={() => {
                            setSlotFiles({ top_face: null, side_profile: null, angle_view: null, tag_receipt: null });
                            setAnalysis(null);
                            setRenderingImageUrl(null);
                            setRenderFeedback("");
                            setAppliedRenderFeedback([]);
                          }}
                          style={{ marginLeft: "auto" }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                          Clear All Photos
                        </button>
                      ) : null}
                    </div>

                    {/* Explicit Analyze & Stop Buttons */}
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
                      {analyzing ? (
                        <button
                          className="button destructive button--md"
                          type="button"
                          onClick={stopAnalysis}
                          style={{ flex: 1, padding: "12px 20px", fontSize: "0.95rem" }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                            stop_circle
                          </span>
                          Stop Analysis ✕
                        </button>
                      ) : (
                        <button
                          className="button primary button--md"
                          type="button"
                          disabled={!files.length && !description.trim()}
                          onClick={() => runAnalysis(files)}
                          style={{ flex: 1, padding: "12px 20px", fontSize: "0.95rem" }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                            auto_awesome
                          </span>
                          {analysis ? "Re-analyze 4 Angles with AI" : "Analyze Design with AI"}
                        </button>
                      )}
                    </div>
                  </div>

                  {error ? <p className="fieldError" style={{ color: "#ef4444", marginTop: 12 }}>{error}</p> : null}
                </QuoteStepCard>

                {analysis ? (
                  <QuoteStepCard
                    number="02"
                    title="Adjust your ring"
                    description="Tweak any value — your price updates automatically."
                  >
                    {/* Validation Gate: Center Stone Warning */}
                    {(!analysis.centerDiamondCarats || analysis.centerDiamondCarats === 0 || !analysis.centerShape || analysis.centerShape.toLowerCase() === "none") ? (
                      <div style={{
                        marginBottom: 16,
                        padding: "14px 16px",
                        background: "rgba(245, 158, 11, 0.12)",
                        border: "1px solid rgba(245, 158, 11, 0.4)",
                        borderRadius: 12,
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12
                      }}>
                        <span className="material-symbols-outlined" style={{ color: "#f59e0b", fontSize: 24, marginTop: 1, flexShrink: 0 }}>warning</span>
                        <div>
                          <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "#f59e0b" }}>Center Stone Not Detected</div>
                          <div style={{ fontSize: "0.8125rem", color: "#cbd5e1", lineHeight: 1.4, marginTop: 2 }}>
                            No central solitaire was identified from the uploaded angles. The quote currently reflects the semi-mount / mounting price. If this piece features a center diamond (e.g. Pear, Oval, Round), enter its shape and carat weight below to recalculate.
                          </div>
                        </div>
                      </div>
                    ) : null}

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
                        <span>Metal color</span>
                        <select
                          value={analysis.metalColor ?? ""}
                          onChange={(event) => updateAnalysisField("metalColor", (event.target.value || null) as Analysis["metalColor"])}
                        >
                          <option value="">Auto / not specified</option>
                          <option value="yellow">Yellow gold</option>
                          <option value="white">White gold</option>
                          <option value="rose">Rose gold</option>
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
                        <span>Center stone color</span>
                        <input
                          value={analysis.centerStoneColor ?? ""}
                          onChange={(event) => updateAnalysisField("centerStoneColor", event.target.value || null)}
                          placeholder="e.g. Green, blue, pink"
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
                    {analysis.assumptions?.length ? (
                      <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 12, background: "rgba(15, 23, 42, 0.04)", border: "1px solid rgba(15, 23, 42, 0.08)" }}>
                        <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>AI assumptions to review</div>
                        <ul style={{ margin: 0, paddingLeft: 18, color: "#334155", fontSize: "0.8rem", lineHeight: 1.5 }}>
                          {analysis.assumptions.slice(0, 4).map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                        <p className="muted small" style={{ margin: "8px 0 0" }}>
                          Side stones and setting type are suggestions unless they were clearly stated or visible.
                        </p>
                      </div>
                    ) : null}
                  </QuoteStepCard>
                ) : null}
              </>
            }
            preview={
              <QuoteBuilderPreview>
                <div className="quotePreviewHeader">
                  <span className="quoteStepNumber">✦</span>
                  <div>
                    <p className="eyebrow">AI visualization &amp; quote</p>
                    <p className="muted small">Updates automatically as you adjust the design.</p>
                  </div>
                </div>

                <div className="quotePreviewImageFrame" style={{ position: "relative" }}>
                  {activeImage ? (
                    <img
                      src={activeImage}
                      alt="AI generated or reference photo"
                      className="quotePreviewImage"
                      onLoad={handleImageLoad(activeImage)}
                      style={{ objectFit: "contain", aspectRatio: getImageAspectRatio(activeImage, renderingImageUrl ? "4 / 5" : "1 / 1") }}
                    />
                  ) : (
                    <div className="quotePreviewImagePlaceholder">
                      <span className="material-symbols-outlined" style={{ fontSize: 40, color: "var(--color-outline-variant)" }}>diamond</span>
                      <p className="muted small" style={{ margin: "8px 0 0", textAlign: "center" }}>Upload a photo or choose a design</p>
                    </div>
                  )}

                  {/* Render Type Status Badge */}
                  {activeImage ? (
                    <div style={{ position: "absolute", top: 10, left: 10, zIndex: 2, display: "flex", gap: 6 }}>
                      {renderingImageUrl ? (
                        <span
                          style={{
                            background: "rgba(0, 0, 0, 0.75)",
                            backdropFilter: "blur(8px)",
                            color: "#f6e09e",
                            border: "1px solid rgba(201, 168, 76, 0.5)",
                            padding: "4px 8px",
                            borderRadius: 6,
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_awesome</span>
                          3D AI Studio Render
                        </span>
                      ) : (
                        <span
                          style={{
                            background: "rgba(0, 0, 0, 0.7)",
                            backdropFilter: "blur(8px)",
                            color: "#ffffff",
                            padding: "4px 8px",
                            borderRadius: 6,
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>photo_camera</span>
                          Reference Photo
                        </span>
                      )}
                    </div>
                  ) : null}

                  {/* Manual Generate/Regenerate 3D Render Button */}
                  {analysis && !generatingConcept ? (
                    <button
                      type="button"
                      onClick={() => triggerRender3D()}
                      style={{
                        position: "absolute",
                        bottom: 10,
                        right: 10,
                        zIndex: 2,
                        background: "rgba(0, 0, 0, 0.8)",
                        backdropFilter: "blur(10px)",
                        color: "#f6e09e",
                        border: "1px solid rgba(201, 168, 76, 0.6)",
                        padding: "6px 12px",
                        borderRadius: 8,
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
                        transition: "all 0.2s ease"
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
                      {renderingImageUrl ? "Regenerate 3D Render" : "Generate 3D AI Render"}
                    </button>
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

                {renderingImageUrl ? (
                  <form
                    className="renderRefinement"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const correction = renderFeedback.trim();
                      if (!correction || generatingConcept) return;
                      void triggerRender3D(null, [...appliedRenderFeedback, correction].join(". ").slice(-1000), correction);
                    }}
                  >
                    <div className="renderRefinement__heading">
                      <span className="material-symbols-outlined" aria-hidden="true">tune</span>
                      <div>
                        <strong>Refine this render{appliedRenderFeedback.length ? ` Â· Revision ${appliedRenderFeedback.length + 1}` : ""}</strong>
                        <span>Tell the studio AI exactly what to change.</span>
                      </div>
                    </div>
                    <div className="renderRefinement__controls">
                      <input
                        aria-label="Render correction"
                        value={renderFeedback}
                        onChange={(event) => setRenderFeedback(event.target.value)}
                        maxLength={1000}
                        placeholder="e.g. Remove the side diamonds"
                        disabled={generatingConcept}
                      />
                      <button className="button secondary button--sm" type="submit" disabled={generatingConcept || renderFeedback.trim().length < 3}>
                        <span className="material-symbols-outlined" aria-hidden="true">refresh</span>
                        Apply changes
                      </button>
                    </div>
                    {appliedRenderFeedback.length ? <p className="renderRefinement__history">Quote recalculated after each revision Â· {appliedRenderFeedback.join(" â†’ ")}</p> : null}
                  </form>
                ) : null}

                <div className="quotePreviewPriceBlock">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <p className="eyebrow" style={{ margin: 0 }}>Live Estimate</p>
                    <CurrencySelector currency={currency} onChange={setCurrency} size="sm" />
                  </div>
                  <div className="quotePrice" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>
                    {analysis
                      ? formatMoneyWithFx(estimatedSellingPrice, currency)
                      : "—"}
                    {currency === "CAD" && analysis ? (
                      <span style={{ fontSize: "0.875rem", fontWeight: 600, marginLeft: 8, color: "var(--color-primary, #005ab7)" }}>
                        CAD
                      </span>
                    ) : null}
                  </div>
                  {analysis && analysis.accentStonePriceEstimate ? (
                    <>
                      <p className="muted small" style={{ marginTop: 4, fontSize: "0.875rem" }}>
                        Accent stones (est.):{" "}
                        <span className="badge" style={{ background: "rgba(201, 168, 76, 0.15)", color: "#e6cb78" }}>
                          {formatMoneyWithFx(analysis.accentStonePriceEstimate.lowTotal, currency)}–
                          {formatMoneyWithFx(analysis.accentStonePriceEstimate.highTotal, currency)}
                        </span>
                      </p>
                    </>
                  ) : null}
                  {analysis ? (
                    <div className="showroomRingSpecTitle">
                      {getRingSpecTitle(analysis)}
                    </div>
                  ) : (
                    <p className="muted small" style={{ marginTop: 4 }}>
                      Upload a photo or pick a design to get started.
                    </p>
                  )}
                </div>

                <div className="quotePreviewActions" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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

                  <button
                    className="button secondary"
                    style={{ width: "100%", justifyContent: "center" }}
                    type="button"
                    disabled={!analysis || saving || sharing}
                    onClick={handleShareQr}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>qr_code_2</span>
                    Share with Others (Scan QR)
                  </button>
                </div>
              </QuoteBuilderPreview>
            }
          />
        </section>
      )}

      {/* ── 4. CENTER ANALYSIS POPUP MODAL: What our AI sees ── */}
      {analyzing ? (
        <div className="showroomModalBackdrop">
          <div className="showroomModalCard">
            <div className="showroomModalIcon">
              <span className="material-symbols-outlined ai-pulse" style={{ fontSize: 36 }}>auto_awesome</span>
            </div>
            <h3>What Our AI Sees</h3>
            <p>Scanning reference design &amp; evaluating precious metal composition</p>

            <div className="showroomModalProgressList">
              {KIOSK_ANALYSIS_STAGES.map((stage, index) => (
                <div
                  key={stage}
                  className={index <= stageIndex ? "showroomModalProgressRow isActive" : "showroomModalProgressRow"}
                >
                  <span className="showroomModalProgressDot" />
                  <span>{stage}</span>
                </div>
              ))}
            </div>

            {/* Interactive Fine Jewelry Facts & Trivia Card */}
            {(() => {
              const factsSource = jewelryFacts.length > 0 ? jewelryFacts : JEWELRY_FACTS_COLLECTION;
              const currentFact = factsSource[factOrder[factIndex] ?? 0] || factsSource[0] || JEWELRY_FACTS_COLLECTION[0];
              const totalFacts = factOrder.length || factsSource.length;
              return (
                <div
                  className="showroomFactsCard"
                  style={{
                    marginTop: 20,
                    background: "linear-gradient(145deg, rgba(201, 168, 76, 0.12), rgba(0, 0, 0, 0.5))",
                    border: "1px solid rgba(201, 168, 76, 0.35)",
                    borderRadius: 18,
                    padding: "18px 20px",
                    textAlign: "left",
                    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
                    position: "relative",
                    overflow: "hidden"
                  }}
                  onTouchStart={handleFactTouchStart}
                  onTouchEnd={handleFactTouchEnd}
                >
                  <style>{`
                    @keyframes factReadingProgress {
                      from { width: 0%; }
                      to { width: 100%; }
                    }
                  `}</style>

                  {/* 10s Reading Timer Progress Bar */}
                  {!showTriviaAnswer ? (
                    <div
                      key={`fact-progress-${factIndex}`}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        height: 3,
                        background: "linear-gradient(90deg, #c9a84c, #f6e09e)",
                        animation: "factReadingProgress 10s linear forwards"
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        height: 3,
                        width: "100%",
                        background: "rgba(134, 239, 172, 0.8)"
                      }}
                    />
                  )}

                  {/* Top Bar: Category Pill, Live AI Badge, Counter, Prev/Next Arrows */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 800,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          padding: "3px 9px",
                          background: "rgba(201, 168, 76, 0.25)",
                          color: "#f6e09e",
                          borderRadius: 6,
                          border: "1px solid rgba(201, 168, 76, 0.4)"
                        }}
                      >
                        {currentFact.category}
                      </span>
                      {currentFact.sourceOrTrend ? (
                        <span
                          style={{
                            fontSize: "0.6875rem",
                            fontWeight: 600,
                            color: "#38bdf8",
                            background: "rgba(56, 189, 248, 0.12)",
                            border: "1px solid rgba(56, 189, 248, 0.25)",
                            padding: "2px 7px",
                            borderRadius: 6
                          }}
                        >
                          ✦ {currentFact.sourceOrTrend}
                        </span>
                      ) : null}
                      <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>
                        {Math.min(factIndex + 1, totalFacts)} of {totalFacts}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={goToPreviousFact}
                        style={{
                          background: "rgba(255, 255, 255, 0.08)",
                          border: "1px solid rgba(255, 255, 255, 0.15)",
                          color: "#e2e8f0",
                          borderRadius: "50%",
                          width: 28,
                          height: 28,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer"
                        }}
                        aria-label="Previous Fact"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
                      </button>
                      <button
                        type="button"
                        onClick={goToNextFact}
                        className="showroomFactNextButton"
                        style={{
                          background: "rgba(255, 255, 255, 0.08)",
                          border: "1px solid rgba(255, 255, 255, 0.15)",
                          color: "#e2e8f0",
                          borderRadius: "50%",
                          width: 28,
                          height: 28,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer"
                        }}
                        aria-label="Next Fact"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
                      </button>
                    </div>
                  </div>

                  {/* Headline */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: "#e6cb78" }}>
                      {currentFact.icon}
                    </span>
                    <strong style={{ fontSize: "0.95rem", color: "#ffffff" }}>
                      {currentFact.headline}
                    </strong>
                  </div>

                  {/* Fact Body */}
                  <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "#cbd5e1", lineHeight: 1.5 }}>
                    {currentFact.fact}
                  </p>

                  {/* Interactive Trivia Question / Reveal Answer */}
                  {currentFact.trivia ? (
                    <div
                      style={{
                        background: "rgba(0, 0, 0, 0.35)",
                        border: "1px dashed rgba(201, 168, 76, 0.3)",
                        borderRadius: 12,
                        padding: "10px 14px",
                        marginTop: 8
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontSize: "0.8125rem", color: "#f8fafc", fontWeight: 600 }}>
                          💡 <span style={{ color: "#e6cb78" }}>Quick Trivia:</span> {currentFact.trivia.question}
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowTriviaAnswer(!showTriviaAnswer)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#e6cb78",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            textDecoration: "underline",
                            padding: "2px 6px",
                            flexShrink: 0
                          }}
                        >
                          {showTriviaAnswer ? "Hide" : "Reveal Answer ▾"}
                        </button>
                      </div>
                      {showTriviaAnswer ? (
                        <p style={{ margin: "8px 0 0", fontSize: "0.8125rem", color: "#86efac", fontWeight: 500 }}>
                          ✓ {currentFact.trivia.answer}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })()}

            <div style={{ marginTop: 24, textAlign: "center" }}>
              <button
                type="button"
                className="button destructive button--md"
                onClick={stopAnalysis}
                style={{ width: "100%", padding: "12px", fontSize: "0.95rem" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>stop_circle</span>
                Stop Analysis
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── 5. QR CODE SHARE & PDF MODAL ── */}
      {showQrModal ? (
        <div className="showroomModalBackdrop" onClick={() => setShowQrModal(false)}>
          <div className="showroomQrCard" onClick={(e) => e.stopPropagation()}>
            <button className="showroomCloseBtn" type="button" onClick={() => setShowQrModal(false)}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
            </button>

            <div className="showroomModalIcon" style={{ width: 56, height: 56, marginBottom: 12 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 28 }}>qr_code_2</span>
            </div>
            <h3 style={{ fontSize: "1.375rem" }}>Scan to View on Your Phone</h3>
            <p style={{ margin: "0 0 16px" }}>Point your camera at this QR code to download the PDF proposal and open the design on your device.</p>

            {qrCodeDataUrl ? (
              <div className="showroomQrWrap">
                <img src={qrCodeDataUrl} alt="Scan Quote QR Code" />
              </div>
            ) : null}

            {code ? (
              <div className="badge" style={{ display: "inline-block", background: "rgba(201, 168, 76, 0.2)", color: "#e6cb78", fontWeight: 700, letterSpacing: "0.08em", padding: "6px 16px", marginBottom: 16 }}>
                CLAIM CODE: {code}
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                className="button primary button--sm"
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined" && qrShareUrl) {
                    window.open(qrShareUrl, "_blank");
                  }
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
                Open PDF Proposal
              </button>
              <button
                className="button secondary button--sm"
                type="button"
                onClick={() => {
                  if (navigator.clipboard && qrShareUrl) {
                    navigator.clipboard.writeText(qrShareUrl);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                  {copiedLink ? "check" : "content_copy"}
                </span>
                {copiedLink ? "Copied!" : "Copy Link"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── 6. MOBILE PHOTO UPLOAD QR MODAL ── */}
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
              Scan this QR code with your smartphone camera. You can snap live photos or select reference images from your gallery to send directly to this screen.
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

      {warning ? <div className="showroomWarning">Still there? This screen will reset in 10 seconds.</div> : null}

      {showStaffPinModal ? (
        <KioskStaffPinModal
          showroomToken={token}
          brandColor={branding.primaryColor || "#c9a84c"}
          onClose={() => setShowStaffPinModal(false)}
          onAuthenticated={(session) => {
            setShowStaffPinModal(false);
            setStaffSession(session);
          }}
        />
      ) : null}

      <LiveCameraModal
        isOpen={showLiveCamera}
        onClose={() => setShowLiveCamera(false)}
        title="Snap Jewelry Reference Photo"
        onCapture={(capturedFile) => addReferenceFiles([capturedFile])}
      />

      <footer style={{ marginTop: "auto", textAlign: "center", color: "var(--color-on-surface-variant)", fontSize: 12, padding: "24px 0" }}>
        Azzure AI Quote · Built by azzuresolutions.com
      </footer>
    </div>
  );
}
