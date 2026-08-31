"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { calculateMakingPrice, DEFAULT_COLOR_CLARITY } from "@/src/services/pricing";
import type { PricingProfileInput } from "@/lib/pricing";
import type { PricingTier } from "@prisma/client";

type StaffQuoteItem = {
  id: string;
  displayCode: string;
  estimatedSellingPrice: number;
  metalType: string;
  jewelryType: string;
  createdAt: string;
  status: string;
  renderingImageUrl: string | null;
};

type QuoteDetail = {
  id: string;
  quoteId?: string;
  displayCode: string;
  status: string;
  createdAt: string;
  pricingTierSnapshot?: string | null;
  tierDivisorSnapshot?: number | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerNotes: string | null;
  jewelerNotes: string | null;
  estimatedPrice: number;
  metalType: string;
  jewelryType: string;
  uploadedImageUrl: string | null;
  renderingImageUrl: string | null;
  pricingContext?: {
    customerMarginPct: number;
    pricingProfile: PricingProfileInput | null;
  };
  specs: {
    metalType: string;
    metalWeightGrams: number | null;
    centerCarats: number | null;
    centerShape: string | null;
    centerClarity?: string | null;
    sideCarats: number | null;
    sideDiamondQuantity: number | null;
    settingType: string | null;
  };
};

function formatPrice(centsOrDollars: number) {
  const val = centsOrDollars > 100000 ? centsOrDollars / 100 : centsOrDollars;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(val);
}

function formatRelativeTime(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function parseOptionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatOptionalPrice(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return "—";
  }
  return formatPrice(value);
}

type KioskStaffViewProps = {
  staffName: string;
  sessionToken: string;
  brandColor?: string;
  onExit: () => void;
};

const METAL_CHOICES = ["10K", "14K", "18K", "Platinum", "Silver"];
const SHAPE_CHOICES = ["Round", "Oval", "Emerald", "Cushion", "Radiant", "Pear", "Marquise", "Princess"];
const SETTING_CHOICES = ["Prong", "Bezel", "Pavé", "Channel", "Tension", "Halo", "Cathedral"];
const CLARITY_CHOICES = [
  "E VS1",
  "D VVS1",
  "D VVS2",
  "E VVS2",
  "F VS1",
  "F VS2",
  "G VS2",
  "G SI1",
  "H SI1",
  "Lab DEF VS1",
  "Lab DEF VVS"
];

export default function KioskStaffView({
  staffName,
  sessionToken,
  brandColor = "#c9a84c",
  onExit
}: KioskStaffViewProps) {
  const [quotes, setQuotes] = useState<StaffQuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchCode, setSearchCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<QuoteDetail | null>(null);

  // Edit Mode States
  const [isEditing, setIsEditing] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerEmail, setEditCustomerEmail] = useState("");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");
  const [editMetalType, setEditMetalType] = useState("");
  const [editMetalWeight, setEditMetalWeight] = useState("");
  const [editCenterCarats, setEditCenterCarats] = useState("");
  const [editCenterShape, setEditCenterShape] = useState("");
  const [editCenterClarity, setEditCenterClarity] = useState("E VS1");
  const [editSideCarats, setEditSideCarats] = useState("");
  const [editSideCount, setEditSideCount] = useState("");
  const [editSettingType, setEditSettingType] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editJewelerNotes, setEditJewelerNotes] = useState("");
  const [editStatus, setEditStatus] = useState<"PENDING" | "CLAIMED" | "IN_REVIEW" | "COMPLETED" | "EXPIRED">("CLAIMED");
  const [savingEdit, setSavingEdit] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);

  // Inactivity auto-exit timer (90 seconds)
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);

  const exitSession = useCallback(async () => {
    try {
      await fetch("/api/showroom/staff/invalidate-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken })
      });
    } catch {}
    onExit();
  }, [sessionToken, onExit]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(() => {
      exitSession();
    }, 90 * 1000);
  }, [exitSession]);

  useEffect(() => {
    const handleActivity = () => resetInactivityTimer();
    window.addEventListener("pointerdown", handleActivity);
    window.addEventListener("keydown", handleActivity);
    resetInactivityTimer();

    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      window.removeEventListener("pointerdown", handleActivity);
      window.removeEventListener("keydown", handleActivity);
    };
  }, [resetInactivityTimer]);

  // Fetch recent quotes
  const fetchRecentQuotes = useCallback(async () => {
    try {
      const res = await fetch("/api/showroom/staff/quotes", {
        headers: { Authorization: `Bearer ${sessionToken}` }
      });
      if (res.status === 401) {
        onExit();
        return;
      }
      if (!res.ok) throw new Error("Failed to load quotes.");
      const data = await res.json();
      setQuotes(data.quotes || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [sessionToken, onExit]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchRecentQuotes();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchRecentQuotes]);

  useEffect(() => {
    const interval = setInterval(() => {
      void fetchRecentQuotes();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchRecentQuotes]);

  // Initialize edit fields when a quote is opened
  const initEditFields = (q: QuoteDetail) => {
    setEditCustomerName(q.customerName || "");
    setEditCustomerEmail(q.customerEmail || "");
    setEditCustomerPhone(q.customerPhone || "");
    setEditMetalType(q.specs.metalType || q.metalType || "14K");
    setEditMetalWeight(q.specs.metalWeightGrams ? String(q.specs.metalWeightGrams) : "");
    setEditCenterCarats(q.specs.centerCarats ? String(q.specs.centerCarats) : "");
    setEditCenterShape(q.specs.centerShape || "Round");
    setEditCenterClarity(q.specs.centerClarity || "E VS1");
    setEditSideCarats(q.specs.sideCarats ? String(q.specs.sideCarats) : "");
    setEditSideCount(q.specs.sideDiamondQuantity ? String(q.specs.sideDiamondQuantity) : "");
    setEditSettingType(q.specs.settingType || "Prong");
    setEditPrice("");
    setEditJewelerNotes(q.jewelerNotes || "");
    const statusVal = q.status as "PENDING" | "CLAIMED" | "IN_REVIEW" | "COMPLETED" | "EXPIRED";
    setEditStatus(["PENDING", "CLAIMED", "IN_REVIEW", "COMPLETED", "EXPIRED"].includes(statusVal) ? statusVal : "CLAIMED");
    setIsEditing(false);
    setSaveSuccessMessage(null);
    setSaveErrorMessage(null);
  };

  const livePricingCalculation = useMemo(() => {
    if (!selectedQuote) return null;

    const pricingProfile = selectedQuote.pricingContext?.pricingProfile || {
      goldSpotPerOz: 4500,
      platinumSpotPerOz: 2000,
      silverSpotPerOz: 300,
      cadCharge: 25,
      centerSettingPerCarat: 20,
      sideSettingPerStone: 3,
      sellingMarginDivisor: 0.7,
      finalMultiplier: 2,
      platinumLaborPct: 40,
      goldWastagePct: 25,
      standardCenterDiamondPerCarat: 125,
      fancyCenterDiamondPerCarat: 175,
      roundSideDiamondPerCarat: 80,
      fancySideDiamondPerCarat: 130,
      roundSideSettingPerStone: 1.25,
      fancySideSettingPerStone: 5,
      waxPerPiece: 10,
      polishingPerPiece: 15
    };

    const metalType = editMetalType || selectedQuote.specs.metalType || selectedQuote.metalType || "14K";
    const metalWeightGrams = parseOptionalNumber(editMetalWeight) ?? selectedQuote.specs.metalWeightGrams ?? 0;
    const centerCarats = parseOptionalNumber(editCenterCarats) ?? selectedQuote.specs.centerCarats ?? 0;
    const sideCarats = parseOptionalNumber(editSideCarats) ?? selectedQuote.specs.sideCarats ?? 0;
    const sideCount = parseOptionalNumber(editSideCount) ?? selectedQuote.specs.sideDiamondQuantity ?? 0;
    const centerShape = editCenterShape || selectedQuote.specs.centerShape || "Round";
    const centerClarity = editCenterClarity || selectedQuote.specs.centerClarity || "E VS1";
    const settingType = editSettingType || selectedQuote.specs.settingType || "Prong";
    const customerMarginPct = selectedQuote.pricingContext?.customerMarginPct ?? 0;
    const pricingTier = (selectedQuote.pricingTierSnapshot as PricingTier | undefined) ?? "TIER_2";
    const sideShape = ["emerald", "radiant", "cushion", "oval", "pear", "princess"].includes(centerShape.toLowerCase()) && sideCount <= 4
      ? "fancy"
      : "round";

    try {
      const result = calculateMakingPrice({
        pricingProfile,
        metalType,
        metalWeightGrams,
        centerStone: {
          shape: centerShape,
          caratWeight: Math.max(centerCarats, 0)
        },
        sideStones:
          sideCarats > 0 && sideCount > 0
            ? [
                {
                  shape: sideShape,
                  caratWeightEach: sideCarats / sideCount,
                  count: sideCount,
                  settingType
                }
              ]
            : [],
        hasWeddingBand: false,
        isTwoTone: false,
        colorClarity: centerClarity,
        cadCost: Number(pricingProfile.cadCharge ?? 25),
        pricingTier,
        customerMarginPct
      });

      const originalPrice = selectedQuote.estimatedPrice || 0;
      const livePrice = result.estimatedSellingPrice;
      const diff = livePrice - originalPrice;
      const diffPct = originalPrice > 0 ? (diff / originalPrice) * 100 : 0;

      return {
        price: livePrice,
        originalPrice,
        diff,
        diffPct,
        breakdown: result,
        calculation: result
      };
    } catch {
      return {
        price: selectedQuote.estimatedPrice || 0,
        originalPrice: selectedQuote.estimatedPrice || 0,
        diff: 0,
        diffPct: 0,
        breakdown: null,
        calculation: null
      };
    }
  }, [
    editCenterCarats,
    editCenterClarity,
    editCenterShape,
    editMetalType,
    editMetalWeight,
    editSettingType,
    editSideCarats,
    editSideCount,
    selectedQuote
  ]);

  const liveEstimatedPrice = livePricingCalculation?.price ?? selectedQuote?.estimatedPrice ?? null;

  const displayedQuotePrice = isEditing
    ? (parseOptionalNumber(editPrice) ?? liveEstimatedPrice ?? selectedQuote?.estimatedPrice ?? 0)
    : (selectedQuote?.estimatedPrice ?? 0);

  // Lookup quote by code
  const handleLookup = async (codeToLookup?: string) => {
    const target = (codeToLookup || searchCode).trim();
    if (!target) return;

    setSearching(true);
    setSearchError(null);

    try {
      const formatted = target.toUpperCase().startsWith("QT") ? target.toUpperCase() : `QT-${target}`;
      const res = await fetch(`/api/showroom/staff/quotes/${encodeURIComponent(formatted)}`, {
        headers: { Authorization: `Bearer ${sessionToken}` }
      });

      if (res.status === 401) {
        onExit();
        return;
      }

      if (!res.ok) {
        throw new Error(`Quote "${target}" not found.`);
      }

      const data = await res.json();
      setSelectedQuote(data.quote);
      initEditFields(data.quote);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Quote not found.");
    } finally {
      setSearching(false);
    }
  };

  // Save changes to the quote
  const handleSaveQuoteChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuote || savingEdit) return;

    setSavingEdit(true);
    setSaveSuccessMessage(null);
    setSaveErrorMessage(null);

    try {
      const res = await fetch(`/api/showroom/staff/quotes/${encodeURIComponent(selectedQuote.displayCode)}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          customerName: editCustomerName.trim(),
          customerEmail: editCustomerEmail.trim(),
          customerPhone: editCustomerPhone.trim(),
          metalType: editMetalType,
          metalWeightGrams: editMetalWeight ? parseFloat(editMetalWeight) : undefined,
          centerCarats: editCenterCarats ? parseFloat(editCenterCarats) : undefined,
          centerShape: editCenterShape,
          centerClarity: editCenterClarity,
          sideCarats: editSideCarats ? parseFloat(editSideCarats) : undefined,
          sideDiamondQuantity: editSideCount ? parseInt(editSideCount, 10) : undefined,
          settingType: editSettingType,
          estimatedPrice: parseOptionalNumber(editPrice) ?? liveEstimatedPrice ?? undefined,
          jewelerNotes: editJewelerNotes.trim(),
          status: editStatus
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to update quote.");
      }

      const data = await res.json();
      setSelectedQuote(data.quote);
      initEditFields(data.quote);
      setSaveSuccessMessage("Quote updated successfully!");
      setIsEditing(false);
      void fetchRecentQuotes();
    } catch (err: any) {
      setSaveErrorMessage(err.message || "Failed to save changes.");
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9990,
        background: "#0a0b0e",
        color: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto"
      }}
    >
      {/* Top Staff App Bar */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 24px",
          background: "rgba(18, 20, 26, 0.9)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 10
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${brandColor}, #dfc674)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0a0b0e",
              fontWeight: 800,
              fontSize: "1.1rem"
            }}
          >
            {staffName[0]?.toUpperCase() || "S"}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <strong style={{ fontSize: "1.05rem", color: "#ffffff" }}>{staffName}</strong>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  background: "rgba(201, 168, 76, 0.15)",
                  color: brandColor,
                  padding: "2px 8px",
                  borderRadius: 6,
                  border: `1px solid ${brandColor}40`
                }}
              >
                STAFF MODE
              </span>
            </div>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Auto-locks after 90s idle</span>
          </div>
        </div>

        <button
          type="button"
          onClick={exitSession}
          style={{
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            color: "#f87171",
            padding: "8px 16px",
            borderRadius: 10,
            cursor: "pointer",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 6
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>lock</span>
          Exit Staff Mode
        </button>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, maxWidth: 960, width: "100%", margin: "0 auto", padding: "32px 24px" }}>
        {selectedQuote ? (
          /* ── Quote Detail & Edit View ── */
          <div
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 24,
              padding: "32px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
            }}
          >
            {/* Top Bar inside Quote */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
              <button
                type="button"
                onClick={() => setSelectedQuote(null)}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#cbd5e1",
                  padding: "8px 16px",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
                Back to Quote List
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "1.35rem",
                    fontWeight: 700,
                    color: brandColor,
                    letterSpacing: "0.05em"
                  }}
                >
                  {selectedQuote.displayCode}
                </span>

                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  style={{
                    background: isEditing ? "rgba(255,255,255,0.1)" : `linear-gradient(135deg, ${brandColor}, #dfc674)`,
                    color: isEditing ? "#ffffff" : "#0a0b0e",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                    {isEditing ? "close" : "edit"}
                  </span>
                  {isEditing ? "Cancel Edit" : "Edit Quote"}
                </button>
              </div>
            </div>

            {/* Notification Banners */}
            {saveSuccessMessage ? (
              <div style={{ background: "rgba(16, 185, 129, 0.15)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: 12, padding: "12px 16px", color: "#10b981", fontWeight: 600, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>check_circle</span>
                {saveSuccessMessage}
              </div>
            ) : null}

            {saveErrorMessage ? (
              <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 12, padding: "12px 16px", color: "#f87171", fontWeight: 600, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>error</span>
                {saveErrorMessage}
              </div>
            ) : null}

            {/* Customer Details Hero Card */}
            <div
              style={{
                background: "rgba(201, 168, 76, 0.08)",
                border: "1px solid rgba(201, 168, 76, 0.25)",
                borderRadius: 16,
                padding: "18px 24px",
                marginBottom: 24,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16
              }}
            >
              <div>
                <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#e6cb78", fontWeight: 700 }}>Customer Name</span>
                <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "#f8fafc", marginTop: 2 }}>
                  {selectedQuote.customerName || "In-Store Guest"}
                </div>
              </div>

              <div>
                <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#e6cb78", fontWeight: 700 }}>Email Address</span>
                <div style={{ fontSize: "0.95rem", color: "#cbd5e1", marginTop: 2 }}>
                  {selectedQuote.customerEmail || "Not provided"}
                </div>
              </div>

              <div>
                <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "#e6cb78", fontWeight: 700 }}>Phone Number</span>
                <div style={{ fontSize: "0.95rem", color: "#cbd5e1", marginTop: 2 }}>
                  {selectedQuote.customerPhone || "Not provided"}
                </div>
              </div>
            </div>

            {/* Dual Images Section: Customer Uploaded Photo + AI 3D Render */}
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: "1rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                Design Visuals
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
                {/* 1. Uploaded Customer Photo */}
                <div
                  style={{
                    background: "rgba(0, 0, 0, 0.4)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 16,
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center"
                  }}
                >
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase" }}>
                    📷 Uploaded Reference Photo
                  </span>
                  {selectedQuote.uploadedImageUrl ? (
                    <img
                      src={selectedQuote.uploadedImageUrl}
                      alt="Customer Upload"
                      style={{ width: "100%", height: 260, objectFit: "contain", borderRadius: 12, background: "#000" }}
                    />
                  ) : (
                    <div style={{ height: 260, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", background: "rgba(255, 255, 255, 0.02)", borderRadius: 12 }}>
                      No upload image
                    </div>
                  )}
                </div>

                {/* 2. Photorealistic AI 3D Render */}
                <div
                  style={{
                    background: "rgba(0, 0, 0, 0.4)",
                    border: "1px solid rgba(201, 168, 76, 0.25)",
                    borderRadius: 16,
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center"
                  }}
                >
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#e6cb78", marginBottom: 8, textTransform: "uppercase" }}>
                    ✦ Photorealistic AI 3D Render
                  </span>
                  {selectedQuote.renderingImageUrl ? (
                    <img
                      src={selectedQuote.renderingImageUrl}
                      alt="AI Render"
                      style={{ width: "100%", height: 260, objectFit: "contain", borderRadius: 12, background: "#000" }}
                    />
                  ) : (
                    <div style={{ height: 260, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", background: "rgba(255, 255, 255, 0.02)", borderRadius: 12 }}>
                      Render not generated
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Toggle between Edit Form and View Mode */}
            {isEditing ? (
              /* ── INLINE QUOTE EDITOR FORM ── */
              <form onSubmit={handleSaveQuoteChanges} style={{ background: "rgba(0, 0, 0, 0.4)", border: "1.5px solid rgba(201, 168, 76, 0.4)", borderRadius: 18, padding: 24, position: "relative" }}>
                
                {/* ── STICKY REAL-TIME PRICING HUD BANNER ── */}
                <div
                  style={{
                    position: "sticky",
                    top: 80,
                    zIndex: 9,
                    background: "linear-gradient(135deg, rgba(20, 24, 33, 0.96), rgba(15, 23, 42, 0.98))",
                    border: "1.5px solid var(--color-brand, #c9a84c)",
                    boxShadow: "0 12px 30px rgba(0, 0, 0, 0.6), 0 0 24px rgba(201, 168, 76, 0.2)",
                    borderRadius: 16,
                    padding: "16px 20px",
                    marginBottom: 24,
                    backdropFilter: "blur(14px)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: "#10b981",
                          boxShadow: "0 0 10px #10b981"
                        }}
                      />
                      <div>
                        <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: brandColor, fontWeight: 800 }}>
                          Live Recalculated Price
                        </div>
                        <div style={{ fontSize: "2.1rem", fontWeight: 800, color: "#ffffff", lineHeight: 1.1 }}>
                          {formatPrice(livePricingCalculation?.price ?? displayedQuotePrice)}
                          {editPrice.trim() ? (
                            <span style={{ fontSize: "0.85rem", color: "#e6cb78", fontWeight: 600, marginLeft: 8 }}>
                              (Manual Override: {formatPrice(Number(editPrice))})
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {livePricingCalculation && Math.abs(livePricingCalculation.diff) >= 0.5 ? (
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 14px",
                            borderRadius: 999,
                            background: livePricingCalculation.diff > 0 ? "rgba(239, 68, 68, 0.18)" : "rgba(16, 185, 129, 0.18)",
                            border: `1px solid ${livePricingCalculation.diff > 0 ? "rgba(239, 68, 68, 0.4)" : "rgba(16, 185, 129, 0.4)"}`,
                            color: livePricingCalculation.diff > 0 ? "#f87171" : "#34d399",
                            fontWeight: 700,
                            fontSize: "0.875rem"
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                            {livePricingCalculation.diff > 0 ? "trending_up" : "trending_down"}
                          </span>
                          {livePricingCalculation.diff > 0 ? `+${formatPrice(livePricingCalculation.diff)}` : formatPrice(livePricingCalculation.diff)}
                          {" "}({livePricingCalculation.diffPct > 0 ? `+${livePricingCalculation.diffPct.toFixed(1)}%` : `${livePricingCalculation.diffPct.toFixed(1)}%`})
                        </div>
                      ) : (
                        <div style={{ fontSize: "0.8rem", color: "#94a3b8", fontWeight: 600 }}>
                          Original Price: {formatPrice(selectedQuote.estimatedPrice)}
                        </div>
                      )}

                      {editPrice.trim() ? (
                        <button
                          type="button"
                          onClick={() => setEditPrice("")}
                          style={{
                            background: "rgba(201, 168, 76, 0.15)",
                            border: "1px solid rgba(201, 168, 76, 0.4)",
                            color: "#e6cb78",
                            padding: "4px 10px",
                            borderRadius: 8,
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            cursor: "pointer"
                          }}
                        >
                          Clear Override
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Component Breakdown Pills */}
                  {livePricingCalculation?.breakdown ? (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
                      <div style={{ padding: "4px 10px", borderRadius: 8, background: "rgba(255, 255, 255, 0.05)", fontSize: "0.75rem", color: "#cbd5e1" }}>
                        Metal ({editMetalType}, {editMetalWeight || 0}g): <strong style={{ color: "#fff" }}>{formatPrice(livePricingCalculation.breakdown.metalCost)}</strong>
                      </div>
                      <div style={{ padding: "4px 10px", borderRadius: 8, background: "rgba(255, 255, 255, 0.05)", fontSize: "0.75rem", color: "#cbd5e1" }}>
                        Center ({editCenterCarats || 0}ct {editCenterShape}, {editCenterClarity}): <strong style={{ color: "#fff" }}>{formatPrice(livePricingCalculation.breakdown.centerStoneCost)}</strong>
                      </div>
                      {Number(editSideCarats) > 0 ? (
                        <div style={{ padding: "4px 10px", borderRadius: 8, background: "rgba(255, 255, 255, 0.05)", fontSize: "0.75rem", color: "#cbd5e1" }}>
                          Accents ({editSideCarats}ct, {editSideCount || 0} stones): <strong style={{ color: "#fff" }}>{formatPrice(livePricingCalculation.breakdown.sideStoneCost)}</strong>
                        </div>
                      ) : null}
                      <div style={{ padding: "4px 10px", borderRadius: 8, background: "rgba(255, 255, 255, 0.05)", fontSize: "0.75rem", color: "#cbd5e1" }}>
                        Setting &amp; CAD: <strong style={{ color: "#fff" }}>{formatPrice((livePricingCalculation.breakdown.centerStoneSettingCost || 0) + (livePricingCalculation.breakdown.sideStoneSettingCost || 0) + (livePricingCalculation.breakdown.cadCost || 0))}</strong>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                  <span className="material-symbols-outlined" style={{ color: brandColor, fontSize: 24 }}>tune</span>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0, color: "#ffffff" }}>
                    Edit &amp; Adjust Quote Specifications
                  </h3>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
                  {/* Customer Name */}
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: "0.8125rem", color: "#94a3b8", fontWeight: 600 }}>Customer Name</span>
                    <input
                      type="text"
                      value={editCustomerName}
                      onChange={(e) => setEditCustomerName(e.target.value)}
                      placeholder="Customer name"
                      style={{ padding: "10px 14px", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#fff" }}
                    />
                  </label>

                  {/* Customer Email */}
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: "0.8125rem", color: "#94a3b8", fontWeight: 600 }}>Customer Email</span>
                    <input
                      type="email"
                      value={editCustomerEmail}
                      onChange={(e) => setEditCustomerEmail(e.target.value)}
                      placeholder="email@example.com"
                      style={{ padding: "10px 14px", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#fff" }}
                    />
                  </label>

                  {/* Customer Phone */}
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: "0.8125rem", color: "#94a3b8", fontWeight: 600 }}>Customer Phone</span>
                    <input
                      type="tel"
                      value={editCustomerPhone}
                      onChange={(e) => setEditCustomerPhone(e.target.value)}
                      placeholder="(555) 000-0000"
                      style={{ padding: "10px 14px", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#fff" }}
                    />
                  </label>

                  {/* Metal Type */}
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: "0.8125rem", color: "#94a3b8", fontWeight: 600 }}>Metal Alloy (Live Price)</span>
                    <select
                      value={editMetalType}
                      onChange={(e) => setEditMetalType(e.target.value)}
                      style={{ padding: "10px 14px", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#fff" }}
                    >
                      {METAL_CHOICES.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </label>

                  {/* Metal Weight (grams) */}
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: "0.8125rem", color: "#94a3b8", fontWeight: 600 }}>Metal Weight (grams)</span>
                    <input
                      type="number"
                      step="0.1"
                      value={editMetalWeight}
                      onChange={(e) => setEditMetalWeight(e.target.value)}
                      placeholder="e.g. 4.5"
                      style={{ padding: "10px 14px", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#fff" }}
                    />
                  </label>

                  {/* Center Stone Carats */}
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: "0.8125rem", color: "#94a3b8", fontWeight: 600 }}>Center Diamond (ct)</span>
                    <input
                      type="number"
                      step="0.01"
                      value={editCenterCarats}
                      onChange={(e) => setEditCenterCarats(e.target.value)}
                      placeholder="e.g. 2.00 (or 0 for mount)"
                      style={{ padding: "10px 14px", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#fff" }}
                    />
                  </label>

                  {/* Center Shape */}
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: "0.8125rem", color: "#94a3b8", fontWeight: 600 }}>Center Shape</span>
                    <select
                      value={editCenterShape}
                      onChange={(e) => setEditCenterShape(e.target.value)}
                      style={{ padding: "10px 14px", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#fff" }}
                    >
                      {SHAPE_CHOICES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>

                  {/* Center Diamond Quality / Clarity */}
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: "0.8125rem", color: "#94a3b8", fontWeight: 600 }}>Diamond Quality / Clarity</span>
                    <select
                      value={editCenterClarity}
                      onChange={(e) => setEditCenterClarity(e.target.value)}
                      style={{ padding: "10px 14px", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#fff" }}
                    >
                      {CLARITY_CHOICES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </label>

                  {/* Side Stones Carats */}
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: "0.8125rem", color: "#94a3b8", fontWeight: 600 }}>Side Diamonds (Total ct)</span>
                    <input
                      type="number"
                      step="0.01"
                      value={editSideCarats}
                      onChange={(e) => setEditSideCarats(e.target.value)}
                      placeholder="e.g. 0.45"
                      style={{ padding: "10px 14px", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#fff" }}
                    />
                  </label>

                  {/* Side Stones Quantity */}
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: "0.8125rem", color: "#94a3b8", fontWeight: 600 }}>Side Stones Qty</span>
                    <input
                      type="number"
                      step="1"
                      value={editSideCount}
                      onChange={(e) => setEditSideCount(e.target.value)}
                      placeholder="e.g. 18"
                      style={{ padding: "10px 14px", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#fff" }}
                    />
                  </label>

                  {/* Setting Type */}
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: "0.8125rem", color: "#94a3b8", fontWeight: 600 }}>Setting Style</span>
                    <select
                      value={editSettingType}
                      onChange={(e) => setEditSettingType(e.target.value)}
                      style={{ padding: "10px 14px", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#fff" }}
                    >
                      {SETTING_CHOICES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </label>

                  {/* Selling Price Override */}
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: "0.8125rem", color: "#e6cb78", fontWeight: 700 }}>Custom Selling Price Override ($ USD)</span>
                    <input
                      type="number"
                      step="1"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      placeholder="Leave blank to use live estimate"
                      style={{ padding: "10px 14px", background: "#0f172a", border: "1px solid #e6cb78", borderRadius: 8, color: "#e6cb78", fontWeight: 700, fontSize: "1.1rem" }}
                    />
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                      Live calculated: <strong style={{ color: "#fff" }}>{formatOptionalPrice(liveEstimatedPrice)}</strong>
                    </span>
                  </label>

                  {/* Quote Status */}
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: "0.8125rem", color: "#94a3b8", fontWeight: 600 }}>Status</span>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as any)}
                      style={{ padding: "10px 14px", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#fff" }}
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="CLAIMED">CLAIMED</option>
                      <option value="IN_REVIEW">IN_REVIEW</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="EXPIRED">EXPIRED</option>
                    </select>
                  </label>
                </div>

                {/* Jeweler Notes */}
                <label style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
                  <span style={{ fontSize: "0.8125rem", color: "#94a3b8", fontWeight: 600 }}>Internal Jeweler / Staff Notes</span>
                  <textarea
                    rows={3}
                    value={editJewelerNotes}
                    onChange={(e) => setEditJewelerNotes(e.target.value)}
                    placeholder="Add custom modifications, finger sizing, or special customer requests…"
                    style={{ padding: "10px 14px", background: "#0f172a", border: "1px solid #334155", borderRadius: 8, color: "#fff" }}
                  />
                </label>

                {/* Submit / Cancel Buttons */}
                <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#cbd5e1",
                      padding: "10px 20px",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontWeight: 600
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    style={{
                      background: `linear-gradient(135deg, ${brandColor}, #dfc674)`,
                      border: "none",
                      color: "#0a0b0e",
                      padding: "10px 24px",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: 6
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check</span>
                    {savingEdit ? "Saving…" : "Save & Update Quote"}
                  </button>
                </div>
              </form>
            ) : (
              /* ── READ-ONLY SPECS DISPLAY ── */
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
                {/* Price Display */}
                <div>
                  <span style={{ fontSize: "0.8125rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>
                    Estimated Selling Price
                  </span>
                  <div style={{ fontSize: "2.5rem", fontWeight: 800, color: "#ffffff", marginTop: 4 }}>
                    {formatPrice(displayedQuotePrice)}
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <span style={{ fontSize: "0.85rem", padding: "4px 10px", borderRadius: 6, background: "rgba(201, 168, 76, 0.15)", color: brandColor, fontWeight: 700 }}>
                      STATUS: {selectedQuote.status}
                    </span>
                  </div>
                </div>

                {/* Specs List */}
                <div
                  style={{
                    background: "rgba(0, 0, 0, 0.3)",
                    borderRadius: 14,
                    padding: "16px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#94a3b8" }}>Metal:</span>
                    <strong style={{ color: "#f8fafc" }}>{selectedQuote.specs.metalType}</strong>
                  </div>
                  {selectedQuote.specs.metalWeightGrams ? (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#94a3b8" }}>Est. Metal Weight:</span>
                      <strong style={{ color: "#f8fafc" }}>{selectedQuote.specs.metalWeightGrams}g</strong>
                    </div>
                  ) : null}
                  {selectedQuote.specs.centerCarats ? (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#94a3b8" }}>Center Stone:</span>
                      <strong style={{ color: "#f8fafc" }}>
                        {selectedQuote.specs.centerCarats}ct {selectedQuote.specs.centerShape || ""}
                      </strong>
                    </div>
                  ) : null}
                  {selectedQuote.specs.sideCarats ? (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#94a3b8" }}>Side Stones:</span>
                      <strong style={{ color: "#f8fafc" }}>
                        {selectedQuote.specs.sideCarats}ct ({selectedQuote.specs.sideDiamondQuantity || 0} stones)
                      </strong>
                    </div>
                  ) : null}
                  {selectedQuote.specs.settingType ? (
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#94a3b8" }}>Setting Type:</span>
                      <strong style={{ color: "#f8fafc" }}>{selectedQuote.specs.settingType}</strong>
                    </div>
                  ) : null}
                  {selectedQuote.jewelerNotes ? (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
                      <span style={{ fontSize: "0.75rem", color: "#e6cb78", fontWeight: 700, textTransform: "uppercase" }}>Staff Notes:</span>
                      <p style={{ margin: "4px 0 0", color: "#cbd5e1", fontSize: "0.875rem" }}>{selectedQuote.jewelerNotes}</p>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(255, 255, 255, 0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p className="muted small" style={{ margin: 0, color: "#64748b" }}>
                Created {formatRelativeTime(selectedQuote.createdAt)}
              </p>
            </div>
          </div>
        ) : (
          /* ── Search & Recent Quotes Roster ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {/* Quote Lookup Form */}
            <div
              style={{
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 20,
                padding: "24px 28px"
              }}
            >
              <h2 style={{ fontSize: "1.35rem", fontWeight: 700, margin: "0 0 16px", color: "#ffffff" }}>
                Look up a customer quote
              </h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleLookup();
                }}
                style={{ display: "flex", gap: 12, flexWrap: "wrap" }}
              >
                <input
                  type="text"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  placeholder="Enter Quote Code (e.g. QT-4821 or 4821)"
                  style={{
                    flex: 1,
                    minWidth: 260,
                    minHeight: 58,
                    background: "rgba(0, 0, 0, 0.4)",
                    border: "2px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: 12,
                    padding: "0 18px",
                    color: "#ffffff",
                    fontSize: "1.15rem",
                    fontWeight: 600,
                    outline: "none"
                  }}
                />
                <button
                  type="submit"
                  disabled={searching || !searchCode.trim()}
                  style={{
                    minHeight: 58,
                    padding: "0 28px",
                    background: `linear-gradient(135deg, ${brandColor}, #dfc674)`,
                    color: "#0a0b0e",
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    border: "none",
                    borderRadius: 12,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                  }}
                >
                  {searching ? "Searching…" : "Look up →"}
                </button>
              </form>

              {searchError ? (
                <p style={{ color: "#f87171", fontSize: "0.95rem", margin: "12px 0 0" }}>{searchError}</p>
              ) : null}
            </div>

            {/* Recent Quotes List */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0, color: "#e2e8f0" }}>
                  Recent In-Store Quotes (Last 10)
                </h3>
                <span style={{ fontSize: "0.875rem", color: "#64748b" }}>Auto-refreshed</span>
              </div>

              {loading ? (
                <p className="muted">Loading recent quotes…</p>
              ) : quotes.length === 0 ? (
                <div
                  style={{
                    padding: 32,
                    textAlign: "center",
                    background: "rgba(255, 255, 255, 0.02)",
                    borderRadius: 14,
                    color: "#64748b"
                  }}
                >
                  No showroom quotes generated yet today.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {quotes.map((q) => (
                    <div
                      key={q.id}
                      onClick={() => handleLookup(q.displayCode)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "16px 20px",
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: 14,
                        cursor: "pointer",
                        transition: "background 0.15s ease, transform 0.15s ease"
                      }}
                      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.99)")}
                      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontWeight: 700,
                            color: brandColor,
                            fontSize: "1.1rem"
                          }}
                        >
                          {q.displayCode}
                        </span>
                        <div>
                          <strong style={{ color: "#f8fafc" }}>
                            {q.metalType} {q.jewelryType}
                          </strong>
                          <div style={{ fontSize: "0.8125rem", color: "#94a3b8", marginTop: 2 }}>
                            {formatRelativeTime(q.createdAt)} · {q.status}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                        <span style={{ fontSize: "1.2rem", fontWeight: 700, color: "#ffffff" }}>
                          {formatPrice(q.estimatedSellingPrice)}
                        </span>
                        <span style={{ color: "#64748b", fontSize: "1.2rem" }}>→</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
