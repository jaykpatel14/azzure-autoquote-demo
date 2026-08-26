"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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

type Branding = { companyName: string; logoUrl: string | null; primaryColor: string | null; backgroundColor: string | null; backgroundMediaUrl: string | null; backgroundMediaType: string | null; overlayColor: string | null; overlayOpacity: number | null; textColor: string | null; backgroundFit: string | null; backgroundPosition: string | null; panelOpacity: number | null; aboutUs: string | null };
type Pricing = { cadCost: number; customerMarginPct: number; pricingTier: PricingTier | null; pricingProfile: PricingProfileInput };
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

const METAL_OPTIONS = ["10K", "14K", "18K", "Platinum", "Silver"];

const SHOWROOM_PRODUCTS = [
  {
    id: "prod-1",
    title: "3.0ct Oval Hidden Halo Solitaire",
    description: "14K White Gold with hidden pavé halo & 1.8mm delicate shank.",
    prompt: "3.0ct Oval solitaire engagement ring in 14K White Gold with hidden diamond halo and delicate plain band",
    metal: "14K",
    metalWeight: 4.5,
    centerCarat: 3.0,
    sideCarat: 0.15,
    sideQty: 16,
    shape: "Oval",
    image: "/images/catalog/oval_solitaire.jpg",
    basePrice: "$2,385"
  },
  {
    id: "prod-2",
    title: "2.5ct Emerald Cut 3-Stone Ring",
    description: "Platinum with tapered trapezoid side diamonds & cathedral prongs.",
    prompt: "2.5ct Emerald cut diamond ring with tapered trapezoid side stones in solid Platinum",
    metal: "Platinum",
    metalWeight: 7.2,
    centerCarat: 2.5,
    sideCarat: 0.6,
    sideQty: 2,
    shape: "Emerald",
    image: "/images/catalog/emerald_3stone.jpg",
    basePrice: "$3,450"
  },
  {
    id: "prod-3",
    title: "2.0ct Pear Cut Micro-Pavé Halo",
    description: "18K Yellow Gold with micro-prong diamond halo & French pavé band.",
    prompt: "2.0ct Pear cut diamond ring in 18K Yellow Gold with micro-prong halo and French pavé band",
    metal: "18K",
    metalWeight: 5.2,
    centerCarat: 2.0,
    sideCarat: 0.35,
    sideQty: 28,
    shape: "Pear",
    image: "/images/catalog/pear_halo.jpg",
    basePrice: "$2,190"
  },
  {
    id: "prod-4",
    title: "2.0ct Cushion Cut Double Split Pavé",
    description: "14K Rose Gold with double split diamond band & hidden under-halo.",
    prompt: "2.0ct Cushion cut solitaire with double split diamond pavé shank in 14K Rose Gold",
    metal: "14K",
    metalWeight: 6.0,
    centerCarat: 2.0,
    sideCarat: 0.5,
    sideQty: 40,
    shape: "Cushion",
    image: "/images/catalog/cushion_pave.jpg",
    basePrice: "$2,280"
  }
];

function getRingSpecTitle(analysis: Analysis | null): string {
  if (!analysis) return "Custom Jewelry Design";
  const metal = analysis.selectedMetal || "14K";
  const centerCarat = Number(analysis.centerDiamondCarats || 0).toFixed(2);
  const centerShape = analysis.centerShape ? `${analysis.centerShape}` : "Diamond";
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

export default function ShowroomKiosk({ token, branding, pricing }: { token: string; branding: Branding; pricing: Pricing }) {
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

  const [started, setStarted] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [factIndex, setFactIndex] = useState(0);
  const [showTriviaAnswer, setShowTriviaAnswer] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisIds, setAnalysisIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingProgress, setSavingProgress] = useState(0);
  const [renderingImageUrl, setRenderingImageUrl] = useState<string | null>(null);
  const [generatingConcept, setGeneratingConcept] = useState(false);
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

  const previews = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  const debouncedAnalysis = useDebouncedValue(analysis, 300);

  const reset = useCallback(() => {
    setStarted(false);
    setFiles([]);
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
        const res = await fetch(`/api/showroom/mobile-upload?sessionId=${mobileUploadSessionId}&token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (data.files && data.files.length > 0) {
          const convertedFiles: File[] = await Promise.all(
            data.files.map(async (f: { name: string; type: string; dataUrl: string }, idx: number) => {
              const fetchRes = await fetch(f.dataUrl);
              const blob = await fetchRes.blob();
              return new File([blob], f.name || `phone_photo_${idx + 1}.jpg`, { type: f.type || "image/jpeg" });
            })
          );
          setFiles(convertedFiles.slice(0, 1));
          setAnalysis(null);
          setRenderingImageUrl(null);
          setError("");
          setShowMobileUploadModal(false);
        }
      } catch {
        // ignore background poll errors
      }
    }, 1800);

    return () => clearInterval(interval);
  }, [showMobileUploadModal, mobileUploadSessionId, token]);

  const estimatedSellingPrice = useMemo(() => {
    if (!debouncedAnalysis || !pricing.pricingTier) return 0;

    const centerCarat = Math.max(debouncedAnalysis.centerDiamondCarats, 0.0001);
    const detectedSideShape = (debouncedAnalysis.centerShape && ["emerald", "radiant", "cushion", "oval", "pear", "princess"].includes(debouncedAnalysis.centerShape.toLowerCase()) && debouncedAnalysis.sideDiamondQuantity <= 4)
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
        centerStone: { shape: debouncedAnalysis.centerShape || "round", caratWeight: centerCarat },
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

  function selectProduct(product: (typeof SHOWROOM_PRODUCTS)[number]) {
    setDescription(product.prompt);
    setRenderingImageUrl(product.image);
    setAnalysis({
      analysisId: `product-${crypto.randomUUID()}`,
      jewelryType: "Ring",
      selectedMetal: product.metal,
      metalWeightGrams: product.metalWeight,
      centerDiamondCarats: product.centerCarat,
      sideDiamondCarats: product.sideCarat,
      sideDiamondQuantity: product.sideQty,
      centerShape: product.shape,
      settingType: "prong",
      hasWeddingBand: false,
      isTwoTone: false
    });
    setStarted(true);
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
    const filesToAnalyze = selectedFiles || files;
    const hasFiles = filesToAnalyze.length > 0;
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

    const controller = new AbortController();
    analysisAbortControllerRef.current = controller;

    const pulser = window.setInterval(() => {
      setStageIndex((current) => (current + 1) % KIOSK_ANALYSIS_STAGES.length);
    }, 900);

    const factTimer = window.setInterval(() => {
      setFactIndex((current) => (current + 1) % JEWELRY_FACTS_COLLECTION.length);
      setShowTriviaAnswer(false);
    }, 4200);

    try {
      const form = new FormData();
      form.set("token", token);
      if (hasDesc) form.set("description", description.trim());
      if (hasFiles) {
        filesToAnalyze.forEach((file) => form.append("images", file));
      }
      const response = await fetch("/api/showroom/analyze", {
        method: "POST",
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
      }
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setError("Analysis was stopped.");
      } else {
        setError(e instanceof Error ? e.message : "Analysis failed.");
      }
    } finally {
      window.clearInterval(pulser);
      window.clearInterval(factTimer);
      setAnalyzing(false);
      analysisAbortControllerRef.current = null;
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
        headers: { "Content-Type": "application/json" },
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
          headers: { "Content-Type": "application/json" },
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

  return (
    <div className="showroom" style={brandStyle}>
      {branding.backgroundMediaUrl ? (
        branding.backgroundMediaType?.startsWith("video/") ? (
          <video className="showroomBackgroundMedia" src={branding.backgroundMediaUrl} autoPlay muted loop playsInline aria-hidden="true" />
        ) : (
          <img className="showroomBackgroundMedia" src={branding.backgroundMediaUrl} alt="" aria-hidden="true" />
        )
      ) : null}
      {branding.backgroundMediaUrl ? <div className="showroomBackgroundOverlay" aria-hidden="true" /> : null}
      <header className="showroomBrand">
        <div className="showroomBrandIdentity">
          {branding.logoUrl ? (
            <div className="showroomBrandLogoWrapper">
              <img src={branding.logoUrl} alt={branding.companyName || "Store logo"} className="showroomBrandLogo" />
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
            style={{ marginBottom: 16 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 24 }}>diamond</span>
            Create Your Custom Piece
          </button>

          <div style={{ textAlign: "center", marginBottom: 40, borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: 14 }}>
            <button
              type="button"
              onClick={() => setShowStaffPinModal(true)}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255, 255, 255, 0.4)",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                padding: "6px 14px",
                textDecoration: "none",
                transition: "color 0.2s ease"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255, 255, 255, 0.8)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255, 255, 255, 0.4)")}
            >
              Staff Access
            </button>
          </div>

          {/* Curated Recent Customer Designs / Products Gallery */}
          <div className="showroomCatalogSection">
            <div className="showroomCatalogHeader">
              <div>
                <h2>Recent Customer Designs</h2>
                <p className="muted small" style={{ color: "#9ca3af", margin: "4px 0 0" }}>Tap any design to inspect details or customize your own.</p>
              </div>
            </div>

            <div className="showroomCatalogGrid">
              {SHOWROOM_PRODUCTS.map((prod) => (
                <div
                  key={prod.id}
                  className="showroomProductCard"
                  role="button"
                  tabIndex={0}
                  onClick={() => selectProduct(prod)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") selectProduct(prod);
                  }}
                >
                  <div className="showroomProductImageWrap">
                    <img src={prod.image} alt={prod.title} className="showroomProductImage" />
                    <div className="showroomProductPriceBadge">{prod.basePrice}</div>
                  </div>
                  <div className="showroomProductContent">
                    <strong>{prod.title}</strong>
                    <p>{prod.description}</p>
                    <div className="showroomProductCta">
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                      Customize this ring
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
                  title="Your Details & Design Inspiration"
                  description="Please provide your contact details (mandatory) and reference photo or design description."
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

                  <div className="dropzone dropzone--multi">
                    <div className="dropzoneContent">
                      <div className="dropzoneIcon">
                        <span className="material-symbols-outlined" style={{ fontSize: 28, color: "var(--color-primary)" }}>smartphone</span>
                      </div>
                      <strong>Add Reference Photo</strong>
                      <span className="muted small">Scan the QR code to upload securely from your phone, or snap a live photo (1 photo)</span>
                    </div>
                    <div className="dropzoneActions" style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
                      <button
                        type="button"
                        className="button primary button--sm"
                        onClick={openMobileUploadQr}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>qr_code_scanner</span>
                        Upload from Phone (Scan QR)
                      </button>

                      <button
                        type="button"
                        className="button secondary button--sm"
                        onClick={() => setShowLiveCamera(true)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>photo_camera</span>
                        Take Photo
                      </button>

                      <label className="button secondary button--sm" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const selected = Array.from(event.target.files || []);
                            if (selected.length) {
                              setFiles(selected.slice(0, 1));
                              setAnalysis(null);
                              setRenderingImageUrl(null);
                              setError("");
                            }
                          }}
                          style={{ display: "none" }}
                        />
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>folder_open</span>
                        Choose File
                      </label>
                    </div>
                  </div>

                  <div style={{ marginTop: 16 }}>
                    {previews.length > 0 ? (
                      <div className="facetThumbRail" aria-label="Uploaded photos" style={{ marginBottom: 16 }}>
                        {previews.map((src, index) => (
                          <div key={src} className="facetThumb">
                            <img src={src} alt={`Reference ${index + 1}`} className="facetThumbImage" />
                            <span className="facetThumbBadge">#{index + 1}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {/* Explicit Analyze & Stop Buttons for Showroom Kiosk */}
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
                          {analysis ? "Re-analyze Design with AI" : "Analyze Design with AI"}
                        </button>
                      )}

                      {files.length > 0 && !analyzing ? (
                        <button
                          className="button secondary button--sm"
                          type="button"
                          onClick={() => {
                            setFiles([]);
                            setAnalysis(null);
                            setRenderingImageUrl(null);
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                          Clear
                        </button>
                      ) : null}
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
                  <span className="quoteStepNumber">✦</span>
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
                      <p className="muted small" style={{ margin: "8px 0 0", textAlign: "center" }}>Upload a photo or choose a design</p>
                    </div>
                  )}
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
              const currentFact = JEWELRY_FACTS_COLLECTION[factIndex] || JEWELRY_FACTS_COLLECTION[0];
              return (
                <div
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
                >
                  {/* Top Bar: Category Pill, Counter, Prev/Next Arrows */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                      <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>
                        {factIndex + 1} of {JEWELRY_FACTS_COLLECTION.length}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setFactIndex((current) => (current - 1 + JEWELRY_FACTS_COLLECTION.length) % JEWELRY_FACTS_COLLECTION.length);
                          setShowTriviaAnswer(false);
                        }}
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
                        onClick={() => {
                          setFactIndex((current) => (current + 1) % JEWELRY_FACTS_COLLECTION.length);
                          setShowTriviaAnswer(false);
                        }}
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
        onCapture={(capturedFile) => {
          setFiles([capturedFile]);
          setAnalysis(null);
          setRenderingImageUrl(null);
          setError("");
        }}
      />

      <footer style={{ marginTop: "auto", textAlign: "center", color: "var(--color-on-surface-variant)", fontSize: 12, padding: "24px 0" }}>
        Azzure AI Quote · Built by azzuresolutions.com
      </footer>
    </div>
  );
}
