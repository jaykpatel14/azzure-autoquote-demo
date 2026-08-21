"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";

// ============================================================================
// PRESET CONFIGURATIONS
// ============================================================================
const PRESETS = {
  "oval-solitaire": {
    label: "Oval Solitaire",
    metal: "18k Yellow Gold",
    centerShape: "Oval",
    centerCarats: 1.5,
    sideShape: "None",
    sideCount: 0,
    sideCarats: 0,
    demoPrice: 1666,
    svgType: "solitaire"
  },
  "pave-band": {
    label: "Pavé Band",
    metal: "18k White Gold",
    centerShape: "Round",
    centerCarats: 0.5,
    sideShape: "Round",
    sideCount: 28,
    sideCarats: 0.02,
    demoPrice: 2840,
    svgType: "pave"
  },
  "halo-ring": {
    label: "Halo Ring",
    metal: "18k Rose Gold",
    centerShape: "Cushion",
    centerCarats: 1.2,
    sideShape: "Round",
    sideCount: 16,
    sideCarats: 0.03,
    demoPrice: 2190,
    svgType: "halo"
  },
  "tennis-bracelet": {
    label: "Tennis Bracelet",
    metal: "18k Yellow Gold",
    centerShape: "None",
    centerCarats: 0,
    sideShape: "Round",
    sideCount: 47,
    sideCarats: 0.15,
    demoPrice: 8450,
    svgType: "bracelet"
  }
} as const;

type PresetKey = keyof typeof PRESETS;

function calculateDemoPrice(adjustments: {
  metal: string;
  centerShape: string;
  centerCarats: number;
  sideShape: string;
  sideCount: number;
  sideCarats?: number;
}) {
  const metalRates: Record<string, number> = {
    "18k Yellow Gold": 55,
    "18k White Gold": 58,
    "18k Rose Gold": 57,
    Platinum: 85,
    "14k Yellow Gold": 42
  };
  const centerRate = [
    "oval",
    "round",
    "radiant",
    "cushion",
    "elongated",
    "marquise",
    "emerald",
    "pear"
  ].includes((adjustments.centerShape || "").toLowerCase())
    ? 1.25
    : 1.75;

  const centerCost = (adjustments.centerCarats || 0) * centerRate;
  const metalCost =
    Math.max(adjustments.centerCarats || 0.8, 0.5) * 4.2 * (metalRates[adjustments.metal] || 55);
  const sideCost = (adjustments.sideCount || 0) * (adjustments.sideCarats || 0.02) * 80;
  const overhead = 35 + 15 + 20;
  const making = centerCost + metalCost + sideCost + overhead;
  const margin = making * 0.2;
  const makingWithMargin = making + margin;
  return Math.round((makingWithMargin / 0.7) * 2);
}

// ============================================================================
// SVG RING ILLUSTRATIONS (Luminous Gold & Sapphire)
// ============================================================================
function RingIllustration({ type, className = "" }: { type: string; className?: string }) {
  if (type === "solitaire" || type === "oval-solitaire") {
    return (
      <svg className={`ring-svg drawn ${className}`} viewBox="0 0 100 100" role="img" aria-label="Oval Solitaire Ring" style={{ width: 110, height: 110 }}>
        <ellipse cx="50" cy="36" rx="14" ry="19" stroke="#C9A84C" strokeWidth="1.5" fill="rgba(201, 168, 76, 0.06)" />
        <ellipse cx="50" cy="36" rx="8" ry="12" stroke="#005AB7" strokeWidth="1" fill="none" />
        <polygon points="50,17 56,26 50,36 44,26" stroke="#005AB7" strokeWidth="0.8" fill="none" />
        <polygon points="50,55 56,46 50,36 44,46" stroke="#005AB7" strokeWidth="0.8" fill="none" />
        <path d="M 26 52 C 24 74, 76 74, 74 52" stroke="#C9A84C" strokeWidth="2" fill="none" />
        <path d="M 22 52 C 20 80, 80 80, 78 52" stroke="#C9A84C" strokeWidth="2" fill="none" />
        <circle cx="40" cy="22" r="2" fill="#005AB7" />
        <circle cx="60" cy="22" r="2" fill="#005AB7" />
        <circle cx="40" cy="50" r="2" fill="#005AB7" />
        <circle cx="60" cy="50" r="2" fill="#005AB7" />
      </svg>
    );
  }
  if (type === "pave" || type === "pave-band") {
    return (
      <svg className={`ring-svg drawn ${className}`} viewBox="0 0 100 100" role="img" aria-label="Pavé Band Ring" style={{ width: 110, height: 110 }}>
        <circle cx="50" cy="30" r="10" stroke="#C9A84C" strokeWidth="1.5" fill="rgba(201, 168, 76, 0.06)" />
        <circle cx="50" cy="30" r="5" stroke="#005AB7" strokeWidth="1" fill="none" />
        <path d="M 24 50 C 22 76, 78 76, 76 50" stroke="#C9A84C" strokeWidth="2" fill="none" />
        <path d="M 20 50 C 18 82, 82 82, 80 50" stroke="#C9A84C" strokeWidth="2" fill="none" />
        <circle cx="30" cy="52" r="2" fill="#005AB7" />
        <circle cx="36" cy="58" r="2" fill="#005AB7" />
        <circle cx="44" cy="62" r="2" fill="#005AB7" />
        <circle cx="56" cy="62" r="2" fill="#005AB7" />
        <circle cx="64" cy="58" r="2" fill="#005AB7" />
        <circle cx="70" cy="52" r="2" fill="#005AB7" />
      </svg>
    );
  }
  if (type === "halo" || type === "halo-ring") {
    return (
      <svg className={`ring-svg drawn ${className}`} viewBox="0 0 100 100" role="img" aria-label="Halo Ring" style={{ width: 110, height: 110 }}>
        <rect x="38" y="24" width="24" height="24" rx="4" stroke="#005AB7" strokeWidth="1.5" fill="rgba(0, 90, 183, 0.05)" />
        <rect x="42" y="28" width="16" height="16" rx="2" stroke="#005AB7" strokeWidth="1" fill="none" />
        <circle cx="34" cy="20" r="2" fill="#C9A84C" /><circle cx="50" cy="18" r="2" fill="#C9A84C" /><circle cx="66" cy="20" r="2" fill="#C9A84C" />
        <circle cx="70" cy="36" r="2" fill="#C9A84C" /><circle cx="66" cy="52" r="2" fill="#C9A84C" /><circle cx="50" cy="54" r="2" fill="#C9A84C" />
        <circle cx="34" cy="52" r="2" fill="#C9A84C" /><circle cx="30" cy="36" r="2" fill="#C9A84C" />
        <path d="M 26 52 C 24 74, 76 74, 74 52" stroke="#C9A84C" strokeWidth="2" fill="none" />
        <path d="M 22 52 C 20 80, 80 80, 78 52" stroke="#C9A84C" strokeWidth="2" fill="none" />
      </svg>
    );
  }
  return (
    <svg className={`ring-svg drawn ${className}`} viewBox="0 0 100 100" role="img" aria-label="Tennis Bracelet" style={{ width: 110, height: 110 }}>
      <ellipse cx="50" cy="50" rx="38" ry="24" stroke="#C9A84C" strokeWidth="2" fill="none" />
      <ellipse cx="50" cy="50" rx="34" ry="20" stroke="#C9A84C" strokeWidth="1" fill="none" />
      <circle cx="20" cy="50" r="3" fill="#005AB7" /><circle cx="26" cy="40" r="3" fill="#005AB7" />
      <circle cx="36" cy="32" r="3" fill="#005AB7" /><circle cx="50" cy="28" r="3" fill="#005AB7" />
      <circle cx="64" cy="32" r="3" fill="#005AB7" /><circle cx="74" cy="40" r="3" fill="#005AB7" />
      <circle cx="80" cy="50" r="3" fill="#005AB7" /><circle cx="74" cy="60" r="3" fill="#005AB7" />
      <circle cx="64" cy="68" r="3" fill="#005AB7" /><circle cx="50" cy="72" r="3" fill="#005AB7" />
      <circle cx="36" cy="68" r="3" fill="#005AB7" /><circle cx="26" cy="60" r="3" fill="#005AB7" />
    </svg>
  );
}

export function InteractiveLandingPage() {
  const [scrolled, setScrolled] = useState(false);

  // Hero Animation State
  const [heroStep1, setHeroStep1] = useState(false);
  const [heroStep2Tag, setHeroStep2Tag] = useState(false);
  const [heroLine1, setHeroLine1] = useState("Identifying metal...");
  const [heroLine1Done, setHeroLine1Done] = useState(false);
  const [heroLine2, setHeroLine2] = useState("Estimating diamonds...");
  const [heroLine2Done, setHeroLine2Done] = useState(false);
  const [heroLine3, setHeroLine3] = useState("Calculating weight...");
  const [heroLine3Done, setHeroLine3Done] = useState(false);
  const [heroFields, setHeroFields] = useState(false);
  const [heroRingDrawn, setHeroRingDrawn] = useState(false);
  const [heroPriceLabel, setHeroPriceLabel] = useState(false);
  const [heroPrice, setHeroPrice] = useState(0);
  const [heroSaveBtn, setHeroSaveBtn] = useState(false);
  const [heroGlint, setHeroGlint] = useState(false);

  // Live Demo State
  const [activePreset, setActivePreset] = useState<PresetKey>("oval-solitaire");
  const [demoMetal, setDemoMetal] = useState("18k Yellow Gold");
  const [demoCenterShape, setDemoCenterShape] = useState("Oval");
  const [demoCenterCarats, setDemoCenterCarats] = useState(1.5);
  const [demoSideShape, setDemoSideShape] = useState("None");
  const [demoSideCount, setDemoSideCount] = useState(0);
  const [demoPrice, setDemoPrice] = useState(1666);
  const [demoGlint, setDemoGlint] = useState(false);

  // Showroom Walkthrough Modal State
  const [kioskOpen, setKioskOpen] = useState(false);
  const [kioskSlide, setKioskSlide] = useState(1);
  const [kioskUploadLoaded, setKioskUploadLoaded] = useState(false);
  const [kioskLine1, setKioskLine1] = useState("Identifying metal...");
  const [kioskLine2, setKioskLine2] = useState("Estimating diamonds...");
  const [kioskLine3, setKioskLine3] = useState("Calculating weight...");
  const [jewelerResultShow, setJewelerResultShow] = useState(false);

  // Pricing State
  const [isAnnual, setIsAnnual] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [hoveredPlanCard, setHoveredPlanCard] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // Scroll & Hero Sequence
  // --------------------------------------------------------------------------
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 80);
    };
    window.addEventListener("scroll", handleScroll);

    // Hero 6-Second Animation Sequence
    const t1 = setTimeout(() => setHeroStep1(true), 800);
    const t2 = setTimeout(() => setHeroStep2Tag(true), 1200);

    const t3 = setTimeout(() => {
      setHeroLine1Done(true);
      setHeroLine1("18k Yellow Gold");
    }, 2300);

    const t4 = setTimeout(() => {
      setHeroLine2Done(true);
      setHeroLine2("0.5ct VS1 Oval");
    }, 3500);

    const t5 = setTimeout(() => {
      setHeroLine3Done(true);
      setHeroLine3("4.2g");
    }, 4700);

    const t6 = setTimeout(() => setHeroFields(true), 5100);
    const t7 = setTimeout(() => setHeroRingDrawn(true), 5200);
    const t8 = setTimeout(() => setHeroPriceLabel(true), 5500);

    const t9 = setTimeout(() => {
      const start = performance.now();
      const duration = 800;
      const target = 1666;
      const step = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        setHeroPrice(Math.floor(easeOut * target));
        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          setHeroPrice(target);
          setHeroGlint(true);
        }
      };
      requestAnimationFrame(step);
    }, 5700);

    const t10 = setTimeout(() => setHeroSaveBtn(true), 6500);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      [t1, t2, t3, t4, t5, t6, t7, t8, t9, t10].forEach(clearTimeout);
    };
  }, []);

  // --------------------------------------------------------------------------
  // Preset Selection
  // --------------------------------------------------------------------------
  const selectPreset = (key: PresetKey) => {
    const data = PRESETS[key];
    setActivePreset(key);
    setDemoMetal(data.metal);
    setDemoCenterShape(data.centerShape);
    setDemoCenterCarats(data.centerCarats);
    setDemoSideShape(data.sideShape);
    setDemoSideCount(data.sideCount);

    animateDemoPrice(data.demoPrice);
  };

  const animateDemoPrice = (target: number) => {
    const startVal = demoPrice;
    const diff = target - startVal;
    const duration = 400;
    let start: number | null = null;

    const step = (now: number) => {
      start ??= now;
      const p = Math.min((now - start) / duration, 1);
      const easeOut = 1 - Math.pow(1 - p, 3);
      setDemoPrice(Math.floor(startVal + diff * easeOut));
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        setDemoPrice(target);
        setDemoGlint(true);
        setTimeout(() => setDemoGlint(false), 1800);
      }
    };
    requestAnimationFrame(step);
  };

  const onDemoInputChange = (updates: Partial<{
    metal: string;
    centerShape: string;
    centerCarats: number;
    sideShape: string;
    sideCount: number;
  }>) => {
    const updated = {
      metal: updates.metal ?? demoMetal,
      centerShape: updates.centerShape ?? demoCenterShape,
      centerCarats: updates.centerCarats ?? demoCenterCarats,
      sideShape: updates.sideShape ?? demoSideShape,
      sideCount: updates.sideCount ?? demoSideCount
    };

    if (updates.metal !== undefined) setDemoMetal(updates.metal);
    if (updates.centerShape !== undefined) setDemoCenterShape(updates.centerShape);
    if (updates.centerCarats !== undefined) setDemoCenterCarats(updates.centerCarats);
    if (updates.sideShape !== undefined) setDemoSideShape(updates.sideShape);
    if (updates.sideCount !== undefined) setDemoSideCount(updates.sideCount);

    const calculated = calculateDemoPrice(updated);
    animateDemoPrice(calculated);
  };

  const openKiosk = () => {
    setKioskOpen(true);
    setKioskSlide(1);
    setKioskUploadLoaded(false);
    setJewelerResultShow(false);
  };

  const startKioskUpload = () => {
    setKioskSlide(2);
    setTimeout(() => {
      setKioskUploadLoaded(true);
    }, 1000);
  };

  const runKioskAnalysis = () => {
    setKioskSlide(3);
    setKioskLine1("Identifying metal...");
    setKioskLine2("Estimating diamonds...");
    setKioskLine3("Calculating weight...");

    setTimeout(() => setKioskLine1("→ 18k Yellow Gold ✓"), 900);
    setTimeout(() => setKioskLine2("→ 1.0ct VS1 Oval ✓"), 1800);
    setTimeout(() => setKioskLine3("→ 5.1g ✓"), 2500);
    setTimeout(() => setKioskSlide(4), 3200);
  };

  const toggleFeatureExpand = (key: string) => {
    setExpandedCards((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div style={{ backgroundColor: "#F9F9FB", color: "#111827", minHeight: "100vh", fontFamily: "var(--font-ui-loaded, var(--font-body, system-ui))" }}>
      
      {/* ====================================================================
           SECTION 1: NAVIGATION
           ==================================================================== */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          height: 72,
          background: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: scrolled ? "1px solid #E2E8F0" : "1px solid rgba(226, 232, 240, 0.6)",
          display: "flex",
          alignItems: "center",
          boxShadow: scrolled ? "0 4px 20px rgba(0, 0, 0, 0.04)" : "none",
          transition: "all 0.2s ease"
        }}
      >
        <div style={{ maxWidth: 1280, width: "100%", margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="#hero" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <span style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 24, fontWeight: 700, color: "#005AB7", letterSpacing: "-0.01em" }}>
              Azzure
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.08em", background: "#F1F5F9", padding: "2px 8px", borderRadius: 4 }}>
              AI Quote
            </span>
          </a>

          <nav style={{ display: "flex", alignItems: "center", gap: 36 }} className="desktop-nav">
            <a href="#how-it-works" style={{ fontSize: 14, fontWeight: 500, color: "#475569", textDecoration: "none" }}>How it works</a>
            <a href="#demo" style={{ fontSize: 14, fontWeight: 500, color: "#475569", textDecoration: "none" }}>Live demo</a>
            <a href="#showroom" style={{ fontSize: 14, fontWeight: 500, color: "#475569", textDecoration: "none" }}>Showroom</a>
            <a href="#pricing" style={{ fontSize: 14, fontWeight: 500, color: "#475569", textDecoration: "none" }}>Pricing</a>
            <Link href="/signin" style={{ fontSize: 14, fontWeight: 600, color: "#005AB7", textDecoration: "none" }}>Log in</Link>
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link href="/signup" className="button primary" style={{ padding: "12px 24px", fontSize: 13, fontWeight: 600, borderRadius: 6 }}>
              Start free trial
            </Link>
          </div>
        </div>
      </header>

      {/* ====================================================================
           SECTION 2: HERO
           ==================================================================== */}
      <section id="hero" style={{ minHeight: "calc(100vh - 72px)", display: "flex", alignItems: "center", padding: "64px 24px 96px", background: "linear-gradient(180deg, #FFFFFF 0%, #F9F9FB 100%)" }}>
        <div style={{ maxWidth: 1280, width: "100%", margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 56, alignItems: "center" }}>
          
          {/* Left Copy */}
          <div style={{ maxWidth: 560 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", background: "#EFF6FF", border: "1px solid #DBEAFE", borderRadius: 9999, marginBottom: 24 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#005AB7", display: "inline-block" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#005AB7", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Introducing Azzure AI Quote v2.0
              </span>
            </div>
            
            <h1 style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontWeight: 700, fontSize: "clamp(46px, 5.5vw, 76px)", lineHeight: 1.08, color: "#0F172A", marginBottom: 24, letterSpacing: "-0.02em" }}>
              Quote any piece<br />
              of jewelry.<br />
              <span style={{ color: "#005AB7" }}>In seconds.</span>
            </h1>
            
            <p style={{ fontSize: 18, lineHeight: 1.7, color: "#475569", marginBottom: 36, maxWidth: 500 }}>
              Upload a customer&apos;s inspiration photo — an Instagram screenshot, a magazine clip, anything. Our AI identifies the metal, stones, and setting, and generates an accurate quote instantly.
            </p>
            
            <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
              <Link href="/signup" className="button primary" style={{ padding: "16px 36px", fontSize: 15, fontWeight: 600, borderRadius: 8, boxShadow: "0 10px 24px rgba(0, 90, 183, 0.25)" }}>
                Start free trial
              </Link>
              <a href="#demo" style={{ fontSize: 15, fontWeight: 600, color: "#005AB7", display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
                Watch it work ↓
              </a>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 40, paddingTop: 24, borderTop: "1px solid #E2E8F0" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>Trusted by 500+ independent &amp; multi-location luxury jewelers</span>
            </div>
          </div>

          {/* Right Product Mockup */}
          <div style={{ background: "#FFFFFF", borderRadius: 16, border: "1px solid #E2E8F0", padding: 28, boxShadow: "0 24px 60px rgba(15, 23, 42, 0.08)", maxWidth: 540, width: "100%", margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 24 }}>
              
              {/* Left Steps */}
              <div style={{ borderRight: "1px solid #F1F5F9", paddingRight: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748B", marginBottom: 4 }}>Step 1</p>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#0F172A", opacity: heroStep1 ? 1 : 0, transition: "opacity 0.5s ease" }}>
                    ✓ Photo uploaded
                  </p>
                </div>

                <div style={{ height: 1, background: "#F1F5F9" }} />

                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748B", marginBottom: 6, opacity: heroStep2Tag ? 1 : 0, transition: "opacity 0.4s ease" }}>
                    Step 2 — AI Analysis
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
                    <p style={{ color: "#1E293B", fontWeight: 500 }}>
                      {heroLine1Done ? `→ ${heroLine1} ✓` : <><span style={{ color: "#005AB7" }}>●</span> {heroLine1}</>}
                    </p>
                    <p style={{ color: "#1E293B", fontWeight: 500 }}>
                      {heroLine2Done ? `→ ${heroLine2} ✓` : <><span style={{ color: "#005AB7" }}>●</span> {heroLine2}</>}
                    </p>
                    <p style={{ color: "#1E293B", fontWeight: 500 }}>
                      {heroLine3Done ? `→ ${heroLine3} ✓` : <><span style={{ color: "#005AB7" }}>●</span> {heroLine3}</>}
                    </p>
                  </div>
                </div>

                <div style={{ height: 1, background: "#F1F5F9" }} />

                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748B", marginBottom: 6 }}>Step 3 — Specs</p>
                  <div style={{ display: "grid", gap: 8, opacity: heroFields ? 1 : 0, transition: "opacity 0.6s ease" }}>
                    <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "6px 10px", fontSize: 12, display: "flex", justifyContent: "space-between", color: "#64748B" }}>
                      <span>Metal</span><strong style={{ color: "#0F172A" }}>18k Yellow Gold</strong>
                    </div>
                    <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6, padding: "6px 10px", fontSize: 12, display: "flex", justifyContent: "space-between", color: "#64748B" }}>
                      <span>Stone</span><strong style={{ color: "#0F172A" }}>0.5ct Oval VS1</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Render & Price */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", textAlign: "center" }}>
                <div style={{ width: "100%", height: 140, display: "flex", alignItems: "center", justifyContent: "center", background: "#F8FAFC", borderRadius: 10, border: "1px solid #E2E8F0", marginBottom: 12 }}>
                  <RingIllustration type="solitaire" className={heroRingDrawn ? "drawn" : ""} />
                </div>

                <div style={{ width: "100%", borderTop: "1px solid #F1F5F9", paddingTop: 12, marginBottom: 14 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748B", opacity: heroPriceLabel ? 1 : 0, transition: "opacity 0.4s ease" }}>
                    Approved Quote Price
                  </p>
                  <div style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 36, fontWeight: 700, color: "#005AB7", lineHeight: 1.1, marginTop: 4 }}>
                    ${heroPrice.toLocaleString()}
                  </div>
                </div>

                <button className="button primary" style={{ width: "100%", fontSize: 12, padding: "10px 12px", opacity: heroSaveBtn ? 1 : 0, transition: "opacity 0.4s ease" }}>
                  Save Quote
                </button>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* ====================================================================
           SECTION 3: PROBLEM STATEMENT & STATS
           ==================================================================== */}
      <section style={{ padding: "100px 24px", maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontWeight: 400, fontSize: 28, lineHeight: 1.5, color: "#64748B", padding: "28px 0" }}>
          &ldquo;A customer walks in with a photo of a ring she loves.<br />
          You spend 20 minutes pricing it by hand.<br />
          She leaves to &lsquo;think about it.&rsquo;&rdquo;
        </p>

        <hr style={{ border: "none", height: 1, background: "linear-gradient(90deg, transparent, #CBD5E1, transparent)" }} />

        <p style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontWeight: 400, fontSize: 28, lineHeight: 1.5, color: "#64748B", padding: "28px 0" }}>
          &ldquo;Every minute you take to quote is a minute<br />
          your customer might walk next door.&rdquo;
        </p>

        <hr style={{ border: "none", height: 1, background: "linear-gradient(90deg, transparent, #CBD5E1, transparent)" }} />

        <p style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontWeight: 700, fontSize: 34, lineHeight: 1.4, color: "#0F172A", padding: "28px 0" }}>
          Azzure AI Quote turns that photo into a professional quote<br />
          — accurate, branded, ready to share — in under <span style={{ color: "#005AB7" }}>60 seconds</span>.
        </p>
      </section>

      {/* Stats Bar */}
      <section style={{ borderTop: "1px solid #E2E8F0", borderBottom: "1px solid #E2E8F0", background: "#FFFFFF", padding: "56px 24px", margin: "0 auto 60px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 36, textAlign: "center" }}>
          <div>
            <div style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 52, fontWeight: 700, color: "#005AB7", lineHeight: 1, marginBottom: 8 }}>2,500</div>
            <div style={{ fontSize: 14, color: "#64748B", fontWeight: 500 }}>Quotes per month on Enterprise</div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 52, fontWeight: 700, color: "#005AB7", lineHeight: 1, marginBottom: 8 }}>&lt; 15 sec</div>
            <div style={{ fontSize: 14, color: "#64748B", fontWeight: 500 }}>To generate an approved quote</div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 52, fontWeight: 700, color: "#005AB7", lineHeight: 1, marginBottom: 8 }}>3 plans</div>
            <div style={{ fontSize: 14, color: "#64748B", fontWeight: 500 }}>Starting at $99 / month</div>
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 52, fontWeight: 700, color: "#005AB7", lineHeight: 1, marginBottom: 8 }}>14 days</div>
            <div style={{ fontSize: 14, color: "#64748B", fontWeight: 500 }}>Risk-free trial on Professional</div>
          </div>
        </div>
      </section>

      {/* ====================================================================
           SECTION 4: LIVE INTERACTIVE DEMO
           ==================================================================== */}
      <section id="demo" style={{ padding: "80px 24px 120px", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 40px" }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#005AB7", display: "inline-block", marginBottom: 12 }}>
            Interactive Sandbox
          </span>
          <h2 style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: "clamp(36px, 4vw, 52px)", fontWeight: 700, color: "#0F172A", marginBottom: 14 }}>
            Try it yourself.
          </h2>
          <p style={{ fontSize: 17, color: "#64748B" }}>Pick a ring style. Watch the AI work. See your quote adjust live.</p>
        </div>

        {/* Preset Selector */}
        <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", marginBottom: 40 }}>
          {(Object.keys(PRESETS) as PresetKey[]).map((key) => {
            const isActive = activePreset === key;
            return (
              <button
                key={key}
                onClick={() => selectPreset(key)}
                style={{
                  padding: "10px 24px",
                  borderRadius: 9999,
                  border: isActive ? "2px solid #005AB7" : "1px solid #CBD5E1",
                  background: isActive ? "#EFF6FF" : "#FFFFFF",
                  color: isActive ? "#005AB7" : "#334155",
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 500,
                  cursor: "pointer",
                  boxShadow: isActive ? "0 4px 12px rgba(0, 90, 183, 0.15)" : "0 1px 3px rgba(0, 0, 0, 0.05)",
                  transition: "all 0.2s ease"
                }}
              >
                {PRESETS[key].label}
              </button>
            );
          })}
        </div>

        {/* Workbench */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 16, padding: "40px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 48, alignItems: "center", boxShadow: "0 20px 48px rgba(15, 23, 42, 0.06)" }}>
          
          {/* Controls Left */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748B", marginBottom: 24 }}>
              Adjust specs and watch the price change
            </p>
            <div style={{ display: "grid", gap: 20 }}>
              
              <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", alignItems: "center", gap: 16 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}>Metal:</label>
                <select
                  value={demoMetal}
                  onChange={(e) => onDemoInputChange({ metal: e.target.value })}
                  style={{ background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 6, padding: "10px 14px", fontSize: 14, color: "#0F172A", width: "100%" }}
                >
                  <option value="18k Yellow Gold">18k Yellow Gold</option>
                  <option value="18k White Gold">18k White Gold</option>
                  <option value="18k Rose Gold">18k Rose Gold</option>
                  <option value="14k Yellow Gold">14k Yellow Gold</option>
                  <option value="Platinum">Platinum</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", alignItems: "center", gap: 16 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}>Center stone:</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <select
                    value={demoCenterShape}
                    onChange={(e) => onDemoInputChange({ centerShape: e.target.value })}
                    style={{ flex: 1, background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 6, padding: "10px 14px", fontSize: 14, color: "#0F172A" }}
                  >
                    <option value="Oval">Oval</option>
                    <option value="Round">Round</option>
                    <option value="Cushion">Cushion</option>
                    <option value="Emerald">Emerald</option>
                    <option value="Pear">Pear</option>
                    <option value="None">None</option>
                  </select>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={demoCenterCarats}
                    onChange={(e) => onDemoInputChange({ centerCarats: parseFloat(e.target.value) || 0 })}
                    style={{ width: 84, background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 6, padding: "10px 12px", fontSize: 14, color: "#0F172A" }}
                  />
                  <span style={{ fontSize: 13, color: "#64748B", fontWeight: 500 }}>ct</span>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", alignItems: "center", gap: 16 }}>
                <label style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}>Side stones:</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <select
                    value={demoSideShape}
                    onChange={(e) => onDemoInputChange({ sideShape: e.target.value })}
                    style={{ flex: 1, background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 6, padding: "10px 14px", fontSize: 14, color: "#0F172A" }}
                  >
                    <option value="Round">Round</option>
                    <option value="Fancy">Fancy</option>
                    <option value="None">None</option>
                  </select>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={demoSideCount}
                    onChange={(e) => onDemoInputChange({ sideCount: parseInt(e.target.value, 10) || 0 })}
                    style={{ width: 84, background: "#F8FAFC", border: "1px solid #CBD5E1", borderRadius: 6, padding: "10px 12px", fontSize: 14, color: "#0F172A" }}
                  />
                  <span style={{ fontSize: 13, color: "#64748B", fontWeight: 500 }}>stones</span>
                </div>
              </div>

            </div>
          </div>

          {/* Right Display & Price */}
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: 32, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: 160, height: 160, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              <RingIllustration type={PRESETS[activePreset].svgType} />
            </div>
            <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 18, width: "100%" }}>
              <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#64748B", marginBottom: 4 }}>Quote price</p>
              <div style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 46, fontWeight: 700, color: "#005AB7", lineHeight: 1.1 }}>
                ${demoPrice.toLocaleString()}
              </div>
              <p style={{ fontSize: 12, color: "#64748B", marginTop: 10 }}>
                Demo calculation · Actual pricing uses real-time multi-pass AI analysis
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ====================================================================
           SECTION 5: HOW IT WORKS
           ==================================================================== */}
      <section id="how-it-works" style={{ padding: "100px 24px", maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#005AB7", display: "inline-block", marginBottom: 12 }}>
            Workflow
          </span>
          <h2 style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: "clamp(36px, 4vw, 52px)", fontWeight: 700, color: "#0F172A" }}>
            A calm, deliberate process.
          </h2>
        </div>

        <div style={{ position: "relative", padding: "48px 0" }}>
          <div style={{ position: "absolute", top: 0, left: -20, fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 200, fontWeight: 300, color: "#005AB7", opacity: 0.06, lineHeight: 1, userSelect: "none" }}>1</div>
          <div style={{ position: "relative", zIndex: 1, maxWidth: 680 }}>
            <h3 style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 36, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>Upload any photo</h3>
            <p style={{ fontSize: 17, lineHeight: 1.7, color: "#475569" }}>
              Your customer shows you an inspiration image — Instagram screenshot, magazine scan, Pinterest board, or printed sketch. Upload it directly to Azzure AI Quote.
            </p>
          </div>
        </div>

        <hr style={{ border: "none", height: 1, background: "#E2E8F0" }} />

        <div style={{ position: "relative", padding: "48px 0" }}>
          <div style={{ position: "absolute", top: 0, left: -20, fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 200, fontWeight: 300, color: "#005AB7", opacity: 0.06, lineHeight: 1, userSelect: "none" }}>2</div>
          <div style={{ position: "relative", zIndex: 1, maxWidth: 680 }}>
            <h3 style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 36, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>AI reads every detail</h3>
            <p style={{ fontSize: 17, lineHeight: 1.7, color: "#475569" }}>
              Our multi-pass AI identifies the metal type, center stone shape and carat weight, accent side diamonds, and setting — in seconds. You review and adjust anything you wish.
            </p>
          </div>
        </div>

        <hr style={{ border: "none", height: 1, background: "#E2E8F0" }} />

        <div style={{ position: "relative", padding: "48px 0" }}>
          <div style={{ position: "absolute", top: 0, left: -20, fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 200, fontWeight: 300, color: "#005AB7", opacity: 0.06, lineHeight: 1, userSelect: "none" }}>3</div>
          <div style={{ position: "relative", zIndex: 1, maxWidth: 680 }}>
            <h3 style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 36, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>Professional quote, instantly</h3>
            <p style={{ fontSize: 17, lineHeight: 1.7, color: "#475569" }}>
              A branded quote appears with your exact retail margin and final customer price. Download the PDF proposal, share a private link, or dispatch directly to manufacturing.
            </p>
          </div>
        </div>
      </section>

      {/* ====================================================================
           SECTION 6: SHOWROOM MODE (ULTRA FEATURE)
           ==================================================================== */}
      <section id="showroom" style={{ background: "#FFFFFF", borderTop: "1px solid #E2E8F0", borderBottom: "1px solid #E2E8F0", padding: "120px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 60, alignItems: "center" }}>
          
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", color: "#005AB7", background: "#EFF6FF", border: "1px solid #DBEAFE", padding: "6px 14px", borderRadius: 6, display: "inline-block", marginBottom: 20 }}>
              Ultra Flagship Feature
            </span>
            <h2 style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: "clamp(36px, 4.5vw, 56px)", fontWeight: 700, lineHeight: 1.15, color: "#0F172A", marginBottom: 20 }}>
              Turn your showroom into<br />
              a self-service quote studio.
            </h2>
            <p style={{ fontSize: 17, lineHeight: 1.7, color: "#475569", marginBottom: 36 }}>
              Place a touchscreen kiosk on your showroom floor. Customers walk up, upload a photo of the ring they desire, and receive an instant quote in your store&apos;s luxury branding.
              <br /><br />
              They walk away with a private quote code. You look it up in your jeweler portal, finalize the CAD specifications, and send it straight into production.
            </p>
            <button onClick={openKiosk} className="button primary" style={{ padding: "16px 36px", fontSize: 15, fontWeight: 600, borderRadius: 8 }}>
              Try the showroom demo →
            </button>
          </div>

          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 16, padding: 36, boxShadow: "0 20px 48px rgba(15, 23, 42, 0.05)", textAlign: "center" }}>
            <p style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 22, fontWeight: 700, color: "#005AB7", marginBottom: 4 }}>Crown Jewellers</p>
            <p style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#64748B", marginBottom: 24 }}>In-Store WOW Kiosk</p>
            
            <div style={{ background: "#FFFFFF", borderRadius: 12, padding: 28, border: "1px solid #E2E8F0", boxShadow: "0 4px 16px rgba(0, 0, 0, 0.04)" }}>
              <div style={{ width: 90, height: 90, margin: "0 auto 12px" }}>
                <RingIllustration type="solitaire" />
              </div>
              <p style={{ fontSize: 13, color: "#64748B", marginBottom: 4 }}>Quote Reference</p>
              <p style={{ fontFamily: "var(--font-mono-loaded, monospace)", fontSize: 22, fontWeight: 700, color: "#005AB7", letterSpacing: "0.08em", marginBottom: 12 }}>QT-4821</p>
              <p style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 32, fontWeight: 700, color: "#0F172A" }}>$2,380</p>
            </div>
          </div>

        </div>
      </section>

      {/* ====================================================================
           SECTION 7: PRICING
           ==================================================================== */}
      <section id="pricing" style={{ padding: "120px 24px", maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 48px" }}>
          <span style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#005AB7", display: "inline-block", marginBottom: 12 }}>
            Transparent Plans
          </span>
          <h2 style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: "clamp(36px, 4vw, 52px)", fontWeight: 700, color: "#0F172A", marginBottom: 14 }}>
            Simple pricing. Powerful quoting.
          </h2>
          <p style={{ fontSize: 17, color: "#64748B" }}>14-day free trial on all plans. No setup fee. Cancel anytime.</p>
        </div>

        {/* Toggle */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 48 }}>
          <div style={{ background: "#FFFFFF", border: "1px solid #CBD5E1", borderRadius: 9999, padding: 4, display: "flex", cursor: "pointer", boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)" }}>
            <div
              onClick={() => setIsAnnual(false)}
              style={{
                padding: "8px 22px",
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: !isAnnual ? 700 : 500,
                background: !isAnnual ? "#005AB7" : "transparent",
                color: !isAnnual ? "#FFFFFF" : "#64748B",
                transition: "all 0.2s ease"
              }}
            >
              Monthly
            </div>
            <div
              onClick={() => setIsAnnual(true)}
              style={{
                padding: "8px 22px",
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: isAnnual ? 700 : 500,
                background: isAnnual ? "#005AB7" : "transparent",
                color: isAnnual ? "#FFFFFF" : "#64748B",
                transition: "all 0.2s ease"
              }}
            >
              Annual — save 20%
            </div>
          </div>
        </div>

        {/* 3 Cards Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          
          {/* Starter */}
          <article
            onMouseEnter={() => setHoveredPlanCard("starter")}
            onMouseLeave={() => setHoveredPlanCard(null)}
            style={{
              background: "#FFFFFF",
              border: hoveredPlanCard === "starter" ? "1px solid #005AB7" : "1px solid #E2E8F0",
              borderRadius: 16,
              padding: 32,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: hoveredPlanCard === "starter" ? "0 20px 40px -10px rgba(0, 90, 183, 0.16)" : "0 4px 16px rgba(0, 0, 0, 0.03)",
              transform: hoveredPlanCard === "starter" ? "translateY(-8px)" : "translateY(0)",
              transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
            }}
          >
            <div>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 24, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>Starter</h3>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}>
                  <span style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 48, fontWeight: 700, color: "#005AB7", lineHeight: 1 }}>
                    ${isAnnual ? 79 : 99}
                  </span>
                  <span style={{ fontSize: 14, color: "#64748B" }}>/ month</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#005AB7", background: "#EFF6FF", padding: "4px 8px", borderRadius: 4 }}>Independent Studios</span>
              </div>

              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12, fontSize: 14, borderTop: "1px solid #F1F5F9", paddingTop: 20, color: "#334155" }}>
                <li>✓ <strong>300 quotes / month</strong></li>
                <li>✓ Full 3-pass AI + manual override</li>
                <li>✓ Branded PDFs (Logo + brand name)</li>
                <li>✓ Complete quote history</li>
                <li>✓ Up to 3 user seats</li>
                <li>✓ Live precious metal spot rates</li>
                <li style={{ color: "#94A3B8" }}>– Shareable public links</li>
                <li style={{ color: "#94A3B8" }}>– Showroom tablet mode</li>
              </ul>

              {expandedCards["starter"] && (
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12, fontSize: 14, marginTop: 12, borderTop: "none", paddingTop: 0, color: "#334155" }}>
                  <li>✓ Standard email support</li>
                  <li>✓ Live gold, platinum &amp; silver feeds</li>
                  <li>✓ Alloy weight density conversions</li>
                </ul>
              )}
              <a onClick={() => toggleFeatureExpand("starter")} style={{ fontSize: 12, fontWeight: 600, color: "#005AB7", cursor: "pointer", display: "inline-block", margin: "14px 0 24px" }}>
                {expandedCards["starter"] ? "Hide additional features ↑" : "Show all features ↓"}
              </a>
            </div>

            <Link href="/signup?plan=starter" className="button secondary" style={{ width: "100%", textAlign: "center" }}>
              Start free trial
            </Link>
          </article>

          {/* Professional */}
          <article
            onMouseEnter={() => setHoveredPlanCard("pro")}
            onMouseLeave={() => setHoveredPlanCard(null)}
            style={{
              background: "#FFFFFF",
              border: "2px solid #005AB7",
              borderRadius: 16,
              padding: 32,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: hoveredPlanCard === "pro" ? "0 28px 52px -12px rgba(0, 90, 183, 0.3)" : "0 10px 30px rgba(0, 90, 183, 0.12)",
              transform: hoveredPlanCard === "pro" ? "translateY(-10px)" : "translateY(0)",
              transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
            }}
          >
            <div>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 24, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>Professional</h3>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}>
                  <span style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 48, fontWeight: 700, color: "#005AB7", lineHeight: 1 }}>
                    ${isAnnual ? 159 : 199}
                  </span>
                  <span style={{ fontSize: 14, color: "#64748B" }}>/ month</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#FFFFFF", background: "#005AB7", padding: "4px 8px", borderRadius: 4 }}>Most Popular · 14-Day Trial</span>
              </div>

              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12, fontSize: 14, borderTop: "1px solid #F1F5F9", paddingTop: 20, color: "#334155" }}>
                <li>✓ <strong>1,200 quotes / month</strong></li>
                <li>✓ Everything in Starter</li>
                <li>✓ Unlimited seats + role-based access</li>
                <li>✓ Shareable branded quote links</li>
                <li>✓ Custom pricing profile &amp; markups</li>
                <li>✓ Auto-push to Custom King (Coming Soon)</li>
                <li style={{ color: "#94A3B8" }}>– Showroom tablet mode</li>
              </ul>

              {expandedCards["pro"] && (
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12, fontSize: 14, marginTop: 12, borderTop: "none", paddingTop: 0, color: "#334155" }}>
                  <li>✓ Priority support response</li>
                  <li>✓ Multi-photo merge analysis</li>
                  <li>✓ Custom domain for links (Coming Soon)</li>
                </ul>
              )}
              <a onClick={() => toggleFeatureExpand("pro")} style={{ fontSize: 12, fontWeight: 600, color: "#005AB7", cursor: "pointer", display: "inline-block", margin: "14px 0 24px" }}>
                {expandedCards["pro"] ? "Hide additional features ↑" : "Show all features ↓"}
              </a>
            </div>

            <Link href="/signup?plan=professional" className="button primary" style={{ width: "100%", textAlign: "center" }}>
              Start free trial
            </Link>
          </article>

          {/* Enterprise */}
          <article
            onMouseEnter={() => setHoveredPlanCard("enterprise")}
            onMouseLeave={() => setHoveredPlanCard(null)}
            style={{
              background: "#FFFFFF",
              border: "2px solid #C9A84C",
              borderRadius: 16,
              padding: 32,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: hoveredPlanCard === "enterprise" ? "0 28px 52px -12px rgba(201, 168, 76, 0.35)" : "0 10px 30px rgba(201, 168, 76, 0.15)",
              position: "relative",
              transform: hoveredPlanCard === "enterprise" ? "translateY(-10px)" : "translateY(0)",
              transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
            }}
          >
            <span style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: "#C9A84C", color: "#FFFFFF", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "5px 14px", borderRadius: 9999, whiteSpace: "nowrap" }}>
              ★ 3D Renders &amp; Showroom Tablet
            </span>
            <div>
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 24, fontWeight: 700, color: "#0F172A", marginBottom: 8 }}>Enterprise</h3>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}>
                  <span style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 48, fontWeight: 700, color: "#C9A84C", lineHeight: 1 }}>
                    ${isAnnual ? 239 : 299}
                  </span>
                  <span style={{ fontSize: 14, color: "#64748B" }}>/ month</span>
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#C9A84C", background: "#FEF9EE", padding: "4px 8px", borderRadius: 4 }}>Full Experience</span>
              </div>

              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12, fontSize: 14, borderTop: "1px solid #F1F5F9", paddingTop: 20, color: "#334155" }}>
                <li>✓ <strong>2,500 quotes / month</strong></li>
                <li>✓ Everything in Professional</li>
                <li><strong style={{ color: "#C9A84C" }}>✓ Photorealistic 3D Concept Renders</strong></li>
                <li><strong style={{ color: "#C9A84C" }}>✓ In-Store Tablet (Kiosk Mode) Touchscreen</strong></li>
                <li><strong style={{ color: "#C9A84C" }}>✓ Full Auto-Push to Custom King</strong></li>
                <li>✓ Photo → 3D print file (Coming Soon)</li>
              </ul>

              {expandedCards["ent"] && (
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12, fontSize: 14, marginTop: 12, borderTop: "none", paddingTop: 0, color: "#334155" }}>
                  <li>✓ Dedicated account manager</li>
                  <li>✓ Store logo &amp; custom showroom branding</li>
                  <li>✓ Priority manufacturing queue</li>
                </ul>
              )}
              <a onClick={() => toggleFeatureExpand("ent")} style={{ fontSize: 12, fontWeight: 600, color: "#C9A84C", cursor: "pointer", display: "inline-block", margin: "14px 0 24px" }}>
                {expandedCards["ent"] ? "Hide additional features ↑" : "Show all features ↓"}
              </a>
            </div>

            <Link href="/signup?plan=enterprise" className="button primary" style={{ width: "100%", textAlign: "center", background: "#C9A84C", borderColor: "#C9A84C" }}>
              Start free trial
            </Link>
          </article>

        </div>
      </section>

      {/* ====================================================================
           SECTION 8: FINAL CTA
           ==================================================================== */}
      <section style={{ padding: "140px 24px 120px", textAlign: "center", maxWidth: 860, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, fontSize: 13, color: "#64748B", marginBottom: 32, flexWrap: "wrap", fontWeight: 500 }}>
          <span>🔒 Secure · isolated per business</span>
          <span>•</span>
          <span>⭐ 14-day free trial</span>
          <span>•</span>
          <span>❌ No credit card tricks</span>
        </div>

        <h2 style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: "clamp(38px, 4.5vw, 60px)", fontWeight: 700, lineHeight: 1.15, color: "#0F172A", marginBottom: 20 }}>
          Your next customer is already<br />
          looking for this <span style={{ color: "#005AB7" }}>ring</span>.
        </h2>
        <p style={{ fontSize: 16, color: "#64748B", marginBottom: 36 }}>14-day free trial · No setup fee · Cancel anytime</p>
        <Link href="/signup" className="button primary" style={{ padding: "16px 36px", fontSize: 15, fontWeight: 600, borderRadius: 8, display: "inline-block" }}>
          Start free trial →
        </Link>
      </section>

      {/* ====================================================================
           SECTION 9: FOOTER
           ==================================================================== */}
      <footer style={{ borderTop: "1px solid #E2E8F0", padding: "48px 24px", background: "#FFFFFF" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, color: "#64748B", flexWrap: "wrap", gap: 20 }}>
          <div>
            <p style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 18, color: "#0F172A", fontWeight: 600, marginBottom: 4 }}>Azzure AI Quote</p>
            <p>Built by azzuresolutions.com</p>
          </div>
          <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <Link href="/signin" style={{ color: "#005AB7", fontWeight: 600, textDecoration: "none" }}>Sign in → azzureaiquote.azzuresolutions.com</Link>
          </div>
        </div>
      </footer>

      {/* ====================================================================
           SHOWROOM WALKTHROUGH MODAL OVERLAY
           ==================================================================== */}
      {kioskOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Showroom Kiosk Simulation"
        >
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: 20,
              width: "100%",
              maxWidth: 640,
              minHeight: 520,
              position: "relative",
              padding: 40,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
            }}
          >
            <button
              onClick={() => setKioskOpen(false)}
              style={{
                position: "absolute",
                top: 20,
                right: 20,
                fontSize: 22,
                color: "#64748B",
                cursor: "pointer",
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                background: "#F8FAFC",
                border: "1px solid #E2E8F0"
              }}
              aria-label="Close showroom demo"
            >
              ×
            </button>

            {/* Slide 1 */}
            {kioskSlide === 1 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", width: "100%" }}>
                <p style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 24, fontWeight: 700, color: "#005AB7", letterSpacing: "0.05em", marginBottom: 20 }}>Crown Jewellers</p>
                <h3 style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 32, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>Design Your Dream Ring</h3>
                <p style={{ fontSize: 15, color: "#64748B", maxWidth: 440, marginBottom: 32, lineHeight: 1.6 }}>
                  Upload a photo of the piece you love. We&apos;ll give you an instant quote in seconds.
                </p>
                <button onClick={startKioskUpload} className="button primary" style={{ padding: "14px 32px", fontSize: 15, borderRadius: 8 }}>Start →</button>
              </div>
            )}

            {/* Slide 2 */}
            {kioskSlide === 2 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", width: "100%" }}>
                <p style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 24, fontWeight: 700, color: "#005AB7", letterSpacing: "0.05em", marginBottom: 20 }}>Crown Jewellers</p>
                <h3 style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 26, fontWeight: 700, color: "#0F172A", marginBottom: 16 }}>Upload your inspiration photo</h3>
                <div
                  style={{
                    width: "100%",
                    height: 180,
                    border: kioskUploadLoaded ? "2px dashed #005AB7" : "2px dashed #CBD5E1",
                    background: kioskUploadLoaded ? "#EFF6FF" : "#F8FAFC",
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 24,
                    transition: "all 0.4s ease"
                  }}
                >
                  {kioskUploadLoaded ? (
                    <p style={{ fontSize: 14, color: "#0F172A" }}>💍 <strong>customer_ring_inspiration.jpg</strong> (4.2 MB uploaded ✓)</p>
                  ) : (
                    <p style={{ fontSize: 14, color: "#64748B" }}>Simulating customer upload...</p>
                  )}
                </div>
                <button
                  onClick={runKioskAnalysis}
                  disabled={!kioskUploadLoaded}
                  className="button primary"
                  style={{ padding: "14px 32px", fontSize: 15, borderRadius: 8, opacity: kioskUploadLoaded ? 1 : 0.5, pointerEvents: kioskUploadLoaded ? "auto" : "none" }}
                >
                  Analyse my ring →
                </button>
              </div>
            )}

            {/* Slide 3 */}
            {kioskSlide === 3 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", width: "100%" }}>
                <p style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 24, fontWeight: 700, color: "#005AB7", letterSpacing: "0.05em", marginBottom: 20 }}>Crown Jewellers</p>
                <h3 style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 26, fontWeight: 700, color: "#0F172A", marginBottom: 16 }}>Analysing your ring...</h3>
                <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, padding: 24, width: "100%", maxWidth: 400, marginBottom: 24, textAlign: "left", display: "flex", flexDirection: "column", gap: 12, fontSize: 14 }}>
                  <p style={{ fontWeight: 500, color: "#1E293B" }}>{kioskLine1.startsWith("→") ? kioskLine1 : <><span style={{ color: "#005AB7" }}>●</span> {kioskLine1}</>}</p>
                  <p style={{ fontWeight: 500, color: "#1E293B" }}>{kioskLine2.startsWith("→") ? kioskLine2 : <><span style={{ color: "#005AB7" }}>●</span> {kioskLine2}</>}</p>
                  <p style={{ fontWeight: 500, color: "#1E293B" }}>{kioskLine3.startsWith("→") ? kioskLine3 : <><span style={{ color: "#005AB7" }}>●</span> {kioskLine3}</>}</p>
                </div>
                <p style={{ fontSize: 12, color: "#64748B" }}>Finalizing geometry &amp; pricing...</p>
              </div>
            )}

            {/* Slide 4 */}
            {kioskSlide === 4 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", width: "100%" }}>
                <p style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 24, fontWeight: 700, color: "#005AB7", letterSpacing: "0.05em", marginBottom: 20 }}>Crown Jewellers</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, width: "100%", alignItems: "center", textAlign: "left", marginBottom: 24 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#64748B", marginBottom: 6 }}>Your ring specifications</p>
                    <p style={{ fontSize: 14, marginBottom: 4, color: "#1E293B" }}><strong>Metal:</strong> 18k Yellow Gold</p>
                    <p style={{ fontSize: 14, marginBottom: 4, color: "#1E293B" }}><strong>Center:</strong> 1.0ct Oval VS1</p>
                    <p style={{ fontSize: 14, color: "#1E293B" }}><strong>Side stones:</strong> 20 round, pavé</p>
                  </div>
                  <div style={{ background: "#F8FAFC", padding: 20, borderRadius: 12, textAlign: "center", border: "1px solid #E2E8F0" }}>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#64748B" }}>Quote price</p>
                    <p style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 32, fontWeight: 700, color: "#005AB7" }}>$2,380</p>
                  </div>
                </div>
                <button onClick={() => setKioskSlide(5)} className="button primary" style={{ width: "100%", padding: "14px", fontSize: 15, borderRadius: 8 }}>
                  Save Quote
                </button>
              </div>
            )}

            {/* Slide 5 */}
            {kioskSlide === 5 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", width: "100%" }}>
                <p style={{ color: "#16A34A", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>✓ Quote saved</p>
                <p style={{ fontSize: 13, color: "#64748B" }}>Your quote reference code:</p>
                <p style={{ fontFamily: "var(--font-mono-loaded, monospace)", fontSize: 40, fontWeight: 700, color: "#005AB7", letterSpacing: "0.12em", margin: "12px 0" }}>QT-4821</p>
                <p style={{ fontSize: 15, color: "#64748B", maxWidth: 440, marginBottom: 20, lineHeight: 1.6 }}>
                  Tell this code to your jeweler.<br />They&apos;ll pull up your exact design in seconds.
                </p>
                <p style={{ fontSize: 13, color: "#64748B", marginBottom: 28 }}>Quote price: $2,380 · Valid for 30 days</p>
                <button onClick={() => setKioskSlide(6)} className="button primary" style={{ width: "100%", padding: "14px", fontSize: 15, borderRadius: 8 }}>
                  Done (See Jeweler View)
                </button>
              </div>
            )}

            {/* Slide 6: Jeweler Lookup */}
            {kioskSlide === 6 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%", textAlign: "left" }}>
                <div>
                  <p style={{ fontSize: 11, textTransform: "uppercase", color: "#005AB7", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4 }}>Jeweler Dashboard Portal</p>
                  <h3 style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 24, fontWeight: 700, color: "#0F172A" }}>Now see what your jeweler sees</h3>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                  <input
                    type="text"
                    value="QT-4821"
                    readOnly
                    style={{ flex: 1, background: "#F8FAFC", border: "1px solid #CBD5E1", padding: "12px 16px", borderRadius: 6, fontFamily: "var(--font-mono-loaded, monospace)", fontSize: 16, color: "#005AB7", fontWeight: 600, letterSpacing: "0.1em" }}
                  />
                  <button onClick={() => setJewelerResultShow(true)} className="button primary" style={{ padding: "12px 20px" }}>
                    Look up quote
                  </button>
                </div>

                {jewelerResultShow && (
                  <div style={{ background: "#F8FAFC", border: "1px solid #005AB7", borderRadius: 12, padding: 20, display: "grid", gridTemplateColumns: "80px 1fr", gap: 20, alignItems: "center" }}>
                    <div style={{ width: 80, height: 80 }}>
                      <RingIllustration type="solitaire" />
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                        <strong style={{ fontFamily: "var(--font-mono-loaded, monospace)", color: "#005AB7" }}>QT-4821</strong>
                        <span style={{ fontSize: 12, color: "#64748B" }}>Showroom quote · Just now</span>
                      </div>
                      <p style={{ fontSize: 13, color: "#334155", marginBottom: 2 }}>18k Yellow Gold · 1.0ct Oval VS1 · 20 round pavé</p>
                      <p style={{ fontFamily: "var(--font-display-loaded, Georgia, serif)", fontSize: 22, fontWeight: 700, color: "#005AB7", marginTop: 4 }}>Price: $2,380</p>
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                  <button className="button secondary" style={{ flex: 1 }} onClick={() => alert("Demo: Opens full jeweler editor")}>
                    Edit specs
                  </button>
                  <button className="button primary" style={{ flex: 1 }} onClick={() => alert("Demo: Quote dispatched to CustomKing manufacturing!")}>
                    Send to Manufacturing
                  </button>
                </div>
              </div>
            )}

            {/* Dots */}
            {kioskSlide <= 5 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24 }}>
                {[1, 2, 3, 4, 5].map((idx) => (
                  <div
                    key={idx}
                    style={{
                      width: kioskSlide === idx ? 24 : 8,
                      height: 8,
                      borderRadius: kioskSlide === idx ? 4 : "50%",
                      background: kioskSlide === idx ? "#005AB7" : "#E2E8F0",
                      transition: "all 0.3s ease"
                    }}
                  />
                ))}
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
