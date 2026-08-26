"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";

// ============================================================================
// PRESET CONFIGURATIONS & ASSETS
// ============================================================================
const PRESETS = {
  "oval-solitaire": {
    label: "Oval Solitaire",
    category: "Ring",
    metal: "18k Yellow Gold",
    centerShape: "Oval",
    centerCarats: 1.5,
    sideShape: "None",
    sideCount: 0,
    sideCarats: 0,
    demoPrice: 1666,
    renderImage: "/images/catalog/oval_solitaire.jpg",
    promptText: "An elegant 1.5ct oval solitaire engagement ring in 18k yellow gold with a slender shank and hidden halo..."
  },
  "pave-band": {
    label: "Pavé Cushion Band",
    category: "Ring",
    metal: "18k White Gold",
    centerShape: "Cushion",
    centerCarats: 2.0,
    sideShape: "Round",
    sideCount: 28,
    sideCarats: 0.02,
    demoPrice: 2840,
    renderImage: "/images/catalog/cushion_pave.jpg",
    promptText: "A 2.0ct cushion cut diamond engagement ring with micro-pavé diamonds along the platinum shank..."
  },
  "halo-ring": {
    label: "Pear Halo Ring",
    category: "Ring",
    metal: "18k Rose Gold",
    centerShape: "Pear",
    centerCarats: 1.8,
    sideShape: "Round",
    sideCount: 22,
    sideCarats: 0.03,
    demoPrice: 2190,
    renderImage: "/images/catalog/pear_halo.jpg",
    promptText: "A dramatic 1.8ct pear-cut diamond in 18k rose gold with a celestial halo and cathedral shoulders..."
  },
  "tennis-bracelet": {
    label: "Emerald 3-Stone",
    category: "Ring",
    metal: "Platinum",
    centerShape: "Emerald",
    centerCarats: 2.5,
    sideShape: "Fancy",
    sideCount: 2,
    sideCarats: 0.5,
    demoPrice: 8450,
    renderImage: "/images/catalog/emerald_3stone.jpg",
    promptText: "A three-stone platinum ring with 2.5ct emerald cut center diamond flanked by tapered baguette side stones..."
  },
  pendant: {
    label: "Custom Iced Pendant",
    category: "Pendant",
    metal: "14k Yellow Gold",
    centerShape: "Round",
    centerCarats: 0.8,
    sideShape: "Round",
    sideCount: 84,
    sideCarats: 0.02,
    demoPrice: 4200,
    renderImage: "/images/catalog/oval_solitaire.jpg",
    promptText: "A multi-layered 3D custom monogram pendant in 14k gold flooded with VVS round brilliant diamonds..."
  },
  earrings: {
    label: "Drop Earrings",
    category: "Earrings",
    metal: "18k White Gold",
    centerShape: "Pear",
    centerCarats: 1.2,
    sideShape: "Round",
    sideCount: 36,
    sideCarats: 0.02,
    demoPrice: 3100,
    renderImage: "/images/catalog/pear_halo.jpg",
    promptText: "Cascading pear-cut diamond drop earrings in 18k white gold with articulating chandelier links..."
  }
} as const;

type PresetKey = keyof typeof PRESETS;

const BRAND_LOGOS = [
  "Diamond Rush NYC",
  "TRAXNYC",
  "Johnny Dang & Co",
  "Frost NYC",
  "Avianne & Co",
  "Mayfair Fine Jewels",
  "Fifth Avenue Diamonds",
  "Crown & Carat Atelier",
  "Rodeo Drive Beverly Hills"
];

function calculateLivePrice(adjustments: {
  metal: string;
  centerShape: string;
  centerCarats: number;
  sideShape: string;
  sideCount: number;
  sideCarats?: number;
}) {
  const metalRates: Record<string, number> = {
    "18k Yellow Gold": 58,
    "18k White Gold": 62,
    "18k Rose Gold": 60,
    Platinum: 88,
    "14k Yellow Gold": 45
  };

  const centerRate = ["oval", "round", "radiant", "cushion", "emerald", "pear"].includes(
    (adjustments.centerShape || "").toLowerCase()
  )
    ? 1.25
    : 1.65;

  const centerCost = (adjustments.centerCarats || 0) * centerRate * 480;
  const metalCost = Math.max(adjustments.centerCarats || 0.8, 0.5) * 4.4 * (metalRates[adjustments.metal] || 58);
  const sideCost = (adjustments.sideCount || 0) * (adjustments.sideCarats || 0.02) * 240;
  const overhead = 180 + 95;
  const making = centerCost + metalCost + sideCost + overhead;
  const margin = making * 0.35;
  const total = Math.round(making + margin);
  return Math.max(total, 650);
}

export function InteractiveLandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Hero Live Studio States
  const [activeCategory, setActiveCategory] = useState<string>("Ring");
  const [activePreset, setActivePreset] = useState<PresetKey>("oval-solitaire");
  const [userPrompt, setUserPrompt] = useState<string>(PRESETS["oval-solitaire"].promptText);
  const [demoMetal, setDemoMetal] = useState<string>(PRESETS["oval-solitaire"].metal);
  const [demoCenterShape, setDemoCenterShape] = useState<string>(PRESETS["oval-solitaire"].centerShape);
  const [demoCenterCarats, setDemoCenterCarats] = useState<number>(PRESETS["oval-solitaire"].centerCarats);
  const [demoSideShape, setDemoSideShape] = useState<string>(PRESETS["oval-solitaire"].sideShape);
  const [demoSideCount, setDemoSideCount] = useState<number>(PRESETS["oval-solitaire"].sideCount);
  const [currentPrice, setCurrentPrice] = useState<number>(PRESETS["oval-solitaire"].demoPrice);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  // The Problem Chat Animation State
  const [chatKey, setChatKey] = useState<number>(1);

  // How it works tabs
  const [workflowTab, setWorkflowTab] = useState<number>(0);

  // Studio Generator Interactive Sandbox State
  const [generatorStep, setGeneratorStep] = useState<number>(1);
  const [genGem, setGenGem] = useState<string>("Diamond");
  const [genMetal, setGenMetal] = useState<string>("Platinum");
  const [genVision, setGenVision] = useState<string>(
    "Classic round brilliant halo solitaire, platinum band, 2ct center stone"
  );
  const [genProgress, setGenProgress] = useState<number>(0);
  const [genDepositPaid, setGenDepositPaid] = useState<boolean>(false);

  // Showroom Kiosk Modal
  const [kioskOpen, setKioskOpen] = useState<boolean>(false);
  const [kioskSlide, setKioskSlide] = useState<number>(1);
  const [kioskUploadLoaded, setKioskUploadLoaded] = useState<boolean>(false);
  const [kioskLine1, setKioskLine1] = useState<string>("Identifying precious alloy...");
  const [kioskLine2, setKioskLine2] = useState<string>("Calculating diamond carat weight...");
  const [kioskLine3, setKioskLine3] = useState<string>("Computing casting geometry...");
  const [jewelerResultShow, setJewelerResultShow] = useState<boolean>(false);

  // Pricing Switcher
  const [isAnnual, setIsAnnual] = useState<boolean>(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // FAQ Open Set
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSelectPreset = (key: PresetKey) => {
    setActivePreset(key);
    const item = PRESETS[key];
    setActiveCategory(item.category);
    setUserPrompt(item.promptText);
    setDemoMetal(item.metal);
    setDemoCenterShape(item.centerShape);
    setDemoCenterCarats(item.centerCarats);
    setDemoSideShape(item.sideShape);
    setDemoSideCount(item.sideCount);
    triggerPriceUpdate(item.demoPrice);
  };

  const handleCategoryClick = (cat: string) => {
    setActiveCategory(cat);
    const matchedKey = (Object.keys(PRESETS) as PresetKey[]).find(
      (k) => PRESETS[k].category.toLowerCase() === cat.toLowerCase()
    );
    if (matchedKey) {
      handleSelectPreset(matchedKey);
    }
  };

  const triggerPriceUpdate = (target: number) => {
    setIsGenerating(true);
    const startVal = currentPrice;
    const diff = target - startVal;
    const duration = 400;
    let startTime: number | null = null;

    const anim = (timestamp: number) => {
      startTime ??= timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCurrentPrice(Math.floor(startVal + diff * ease));

      if (progress < 1) {
        requestAnimationFrame(anim);
      } else {
        setCurrentPrice(target);
        setTimeout(() => setIsGenerating(false), 200);
      }
    };
    requestAnimationFrame(anim);
  };

  const onSpecsChange = (updates: Partial<{
    metal: string;
    centerShape: string;
    centerCarats: number;
    sideShape: string;
    sideCount: number;
  }>) => {
    const nextSpecs = {
      metal: updates.metal ?? demoMetal,
      centerShape: updates.centerShape ?? demoCenterShape,
      centerCarats: updates.centerCarats ?? demoCenterCarats,
      sideShape: updates.sideShape ?? demoSideShape,
      sideCount: updates.sideCount ?? demoSideCount
    };

    if (updates.metal) setDemoMetal(updates.metal);
    if (updates.centerShape) setDemoCenterShape(updates.centerShape);
    if (updates.centerCarats !== undefined) setDemoCenterCarats(updates.centerCarats);
    if (updates.sideShape) setDemoSideShape(updates.sideShape);
    if (updates.sideCount !== undefined) setDemoSideCount(updates.sideCount);

    const calculated = calculateLivePrice(nextSpecs);
    triggerPriceUpdate(calculated);
  };

  const runGeneratorFlow = () => {
    setGeneratorStep(2);
    setGenProgress(10);
    const interval = setInterval(() => {
      setGenProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setGeneratorStep(3);
          return 100;
        }
        return prev + 15;
      });
    }, 180);
  };

  const replayChat = () => {
    setChatKey((k) => k + 1);
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const toggleExpand = (key: string) => {
    setExpandedCards((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const openKioskModal = () => {
    setKioskOpen(true);
    setKioskSlide(1);
    setKioskUploadLoaded(false);
    setJewelerResultShow(false);
  };

  const startKioskUpload = () => {
    setKioskSlide(2);
    setTimeout(() => {
      setKioskUploadLoaded(true);
    }, 900);
  };

  const runKioskAnalysis = () => {
    setKioskSlide(3);
    setKioskLine1("Identifying precious alloy...");
    setKioskLine2("Calculating diamond carat weight...");
    setKioskLine3("Computing casting geometry...");

    setTimeout(() => setKioskLine1("→ 18k Yellow Gold Verified ✓"), 800);
    setTimeout(() => setKioskLine2("→ 1.5ct VS1 Oval Solitaire Spec'd ✓"), 1600);
    setTimeout(() => setKioskLine3("→ 4.8g Gold Geometry Calculated ✓"), 2300);
    setTimeout(() => setKioskSlide(4), 3000);
  };

  return (
    <div className="js-landing">
      {/* ====================================================================
           1. NAVIGATION BAR (Frosted Floating Glass Pill)
           ==================================================================== */}
      <header className="js-header" style={{ paddingTop: scrolled ? "10px" : "18px" }}>
        <div className="js-header-inner">
          {/* Logo */}
          <a href="#hero" className="js-logo">
            <div className="js-logo-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polygon points="6 3 18 3 22 9 12 22 2 9" />
              </svg>
            </div>
            <span className="js-logo-text">Azzure</span>
            <span className="js-logo-badge">AI Quote</span>
          </a>

          {/* Desktop Navigation Links */}
          <nav className="js-nav">
            <a href="#features">Features</a>
            <a href="#design-studio">Live Studio</a>
            <a href="#the-problem">The Problem</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#dashboard">Dashboard</a>
            <a href="#showroom">Showroom Kiosk</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>

          {/* Right CTAs */}
          <div className="js-header-actions">
            <Link
              href="/signin"
              style={{
                fontSize: "14px",
                fontWeight: 500,
                color: "#94a3b8",
                textDecoration: "none",
                marginRight: "4px"
              }}
            >
              Log in
            </Link>
            <Link href="/signup" className="js-btn-aurora" style={{ padding: "9px 20px", fontSize: "13px" }}>
              Start Free Trial →
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="js-mobile-toggle"
              aria-label="Toggle menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu Drawer */}
        {mobileMenuOpen && (
          <div
            style={{
              maxWidth: "1240px",
              margin: "10px auto 0",
              padding: "20px",
              borderRadius: "20px",
              background: "rgba(8, 14, 34, 0.96)",
              border: "1px solid rgba(56, 189, 248, 0.2)",
              backdropFilter: "blur(20px)",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              pointerEvents: "auto"
            }}
          >
            <a onClick={() => setMobileMenuOpen(false)} href="#features" style={{ color: "#f8fafc", textDecoration: "none" }}>Features</a>
            <a onClick={() => setMobileMenuOpen(false)} href="#design-studio" style={{ color: "#f8fafc", textDecoration: "none" }}>Live Studio</a>
            <a onClick={() => setMobileMenuOpen(false)} href="#the-problem" style={{ color: "#f8fafc", textDecoration: "none" }}>The Problem</a>
            <a onClick={() => setMobileMenuOpen(false)} href="#how-it-works" style={{ color: "#f8fafc", textDecoration: "none" }}>How It Works</a>
            <a onClick={() => setMobileMenuOpen(false)} href="#dashboard" style={{ color: "#f8fafc", textDecoration: "none" }}>Dashboard</a>
            <a onClick={() => setMobileMenuOpen(false)} href="#showroom" style={{ color: "#f8fafc", textDecoration: "none" }}>Showroom Kiosk</a>
            <a onClick={() => setMobileMenuOpen(false)} href="#pricing" style={{ color: "#f8fafc", textDecoration: "none" }}>Pricing</a>
            <a onClick={() => setMobileMenuOpen(false)} href="#faq" style={{ color: "#f8fafc", textDecoration: "none" }}>FAQ</a>
            <div style={{ paddingTop: "12px", borderTop: "1px solid rgba(255, 255, 255, 0.1)", display: "flex", gap: "10px" }}>
              <Link href="/signin" className="js-btn-ghost" style={{ flex: 1, textAlign: "center" }}>Log in</Link>
              <Link href="/signup" className="js-btn-aurora" style={{ flex: 1, textAlign: "center" }}>Start Free Trial</Link>
            </div>
          </div>
        )}
      </header>

      {/* ====================================================================
           2. HERO SECTION (Royal Sapphire & Champagne Gold)
           ==================================================================== */}
      <section id="hero" className="js-hero-section">
        {/* Dynamic Glows */}
        <div className="js-aurora-bg">
          <div className="js-aurora-glow-1" />
          <div className="js-aurora-glow-2" />
        </div>

        <div className="js-container">
          <div className="js-hero-grid">
            
            {/* Left Hero Copy */}
            <div style={{ textAlign: "left" }}>
              <div className="js-hero-badge">
                <span className="js-hero-badge-dot" />
                <span className="js-eyebrow">Built By Jewelers · For Luxury Retailers</span>
              </div>

              <h1 className="js-display js-hero-title">
                The world&apos;s <span className="js-aurora-text" style={{ textDecoration: "underline" }}>first</span>
                <br />
                <em className="js-accent-italic">AI custom jewelry</em>
                <br />
                <span>quotation studio</span>
                <span className="js-cursor-blink" />
              </h1>

              <p className="js-hero-desc">
                Instant 3D visuals. <span style={{ color: "#f8fafc", fontWeight: 600 }}>20x more leads.</span>{" "}
                <span style={{ color: "#f8fafc", fontWeight: 600 }}>Mathematically perfect quotes.</span>
                <br />
                <span style={{ color: "#38bdf8", fontWeight: 600 }}>In under 60 seconds. Effortlessly.</span>
              </p>

              <div className="js-hero-ctas">
                <Link href="/signup" className="js-btn-aurora" style={{ fontSize: "15px", padding: "14px 32px" }}>
                  Start 14-Day Free Trial →
                </Link>
                <a href="#design-studio" className="js-btn-ghost" style={{ fontSize: "15px", padding: "14px 28px" }}>
                  Try Live Sandbox ↓
                </a>
              </div>

              <div className="js-hero-trust">
                <span style={{ color: "#34d399", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  ✓ 14-Day Free Trial
                </span>
                <span>·</span>
                <span>No Credit Card Required</span>
                <span>·</span>
                <span style={{ color: "#f5d061" }}>Live Bullion Spot Rates</span>
              </div>
            </div>

            {/* Right Hero Live Studio Card */}
            <div id="design-studio" className="js-glass-card js-studio-card">
              <div className="js-accent-line" />

              <div className="js-studio-header">
                <span className="js-eyebrow">Interactive Studio AI</span>
                <span className="js-live-pill">
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d399" }} />
                  Live Engine
                </span>
              </div>

              <h2 className="js-display" style={{ fontSize: "28px", margin: "0 0 4px" }}>
                Describe <em className="js-accent-italic">any piece</em>
              </h2>
              <p style={{ fontSize: "13px", color: "#94a3b8", margin: "0 0 16px" }}>
                Type what a customer envisions or select presets below:
              </p>

              {/* Prompt Textarea */}
              <div className="js-prompt-box">
                <textarea
                  rows={2}
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="e.g. 2.0ct oval diamond in 18k yellow gold with hidden halo..."
                  className="js-prompt-textarea"
                />

                <div className="js-prompt-bottom">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "11px", color: "#64748b", fontFamily: "var(--font-mono-loaded, monospace)" }}>
                      PRESET:
                    </span>
                    <select
                      value={activePreset}
                      onChange={(e) => handleSelectPreset(e.target.value as PresetKey)}
                      style={{
                        background: "rgba(255, 255, 255, 0.08)",
                        border: "1px solid rgba(56, 189, 248, 0.25)",
                        borderRadius: "6px",
                        padding: "4px 8px",
                        color: "#f8fafc",
                        fontSize: "12px",
                        outline: "none",
                        cursor: "pointer"
                      }}
                    >
                      {(Object.keys(PRESETS) as PresetKey[]).map((k) => (
                        <option key={k} value={k} style={{ background: "#080e22", color: "#f8fafc" }}>
                          {PRESETS[k].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      triggerPriceUpdate(
                        calculateLivePrice({
                          metal: demoMetal,
                          centerShape: demoCenterShape,
                          centerCarats: demoCenterCarats,
                          sideShape: demoSideShape,
                          sideCount: demoSideCount
                        })
                      )
                    }
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, #38bdf8, #2563eb)",
                      border: "none",
                      color: "#ffffff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "bold",
                      boxShadow: "0 0 12px rgba(56, 189, 248, 0.5)"
                    }}
                    title="Calculate Live Price"
                  >
                    ↑
                  </button>
                </div>
              </div>

              {/* Category Buttons */}
              <div className="js-category-grid">
                {[
                  { name: "Ring", icon: "💍" },
                  { name: "Pendant", icon: "✨" },
                  { name: "Bracelet", icon: "💎" },
                  { name: "Necklace", icon: "📿" },
                  { name: "Earrings", icon: "💫" },
                  { name: "Grillz", icon: "👑" }
                ].map((item) => {
                  const isSelected = activeCategory.toLowerCase() === item.name.toLowerCase();
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => handleCategoryClick(item.name)}
                      className={`js-cat-btn ${isSelected ? "is-active" : ""}`}
                    >
                      <span style={{ fontSize: "16px" }}>{item.icon}</span>
                      <span>{item.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Render Preview & Live Price Adjuster */}
              <div className="js-preview-row">
                <div className="js-preview-thumb">
                  <img
                    src={PRESETS[activePreset]?.renderImage || "/images/catalog/oval_solitaire.jpg"}
                    alt={PRESETS[activePreset]?.label || "Render"}
                  />
                  {isGenerating && (
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "rgba(4, 7, 17, 0.8)",
                        backdropFilter: "blur(4px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#38bdf8",
                        fontSize: "11px",
                        fontFamily: "var(--font-mono-loaded, monospace)"
                      }}
                    >
                      Rendering...
                    </div>
                  )}
                </div>

                <div style={{ textAlign: "left" }}>
                  <span style={{ fontSize: "10px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Approved Quote Estimate
                  </span>
                  <div className="js-preview-price">${currentPrice.toLocaleString()}</div>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", marginBottom: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8" }}>
                      <span>Alloy:</span>
                      <select
                        value={demoMetal}
                        onChange={(e) => onSpecsChange({ metal: e.target.value })}
                        style={{ background: "transparent", border: "none", color: "#f8fafc", fontWeight: 600, outline: "none", cursor: "pointer" }}
                      >
                        <option value="18k Yellow Gold" style={{ background: "#080e22" }}>18k Yellow Gold</option>
                        <option value="18k White Gold" style={{ background: "#080e22" }}>18k White Gold</option>
                        <option value="18k Rose Gold" style={{ background: "#080e22" }}>18k Rose Gold</option>
                        <option value="Platinum" style={{ background: "#080e22" }}>Platinum 950</option>
                        <option value="14k Yellow Gold" style={{ background: "#080e22" }}>14k Yellow Gold</option>
                      </select>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8" }}>
                      <span>Diamond:</span>
                      <span style={{ color: "#f8fafc", fontWeight: 600 }}>
                        {demoCenterCarats}ct {demoCenterShape}
                      </span>
                    </div>
                  </div>

                  <Link href="/signup" className="js-btn-aurora" style={{ width: "100%", padding: "10px", fontSize: "12px" }}>
                    Save &amp; Generate Quote PDF →
                  </Link>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
           3. 3D TILT SHOWCASE & EXPLAINER CARD
           ==================================================================== */}
      <section className="js-showcase-section">
        <div className="js-container">
          <div style={{ marginBottom: "40px" }}>
            <span className="js-eyebrow" style={{ color: "#f5d061" }}>Museum-Grade Specular Lighting</span>
            <h2 className="js-display" style={{ fontSize: "42px", margin: "10px 0 14px" }}>
              Ideas to photoreal 3D renders. <em className="js-accent-gold">Zero CAD wait time.</em>
            </h2>
            <p style={{ color: "#94a3b8", fontSize: "17px", maxWidth: "600px", margin: "0 auto" }}>
              Generate studio-quality, light-accurate 3D jewelry renderings before your competitors can even open a CAD file.
            </p>
          </div>

          <div className="js-tilt-wrapper">
            <div className="js-tilt-inner">
              <img src="/images/catalog/cushion_pave.jpg" alt="Photorealistic 3D ring render" />
              
              <div className="js-tilt-floating-meta">
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "24px" }}>💍</span>
                  <div>
                    <strong style={{ fontSize: "14px", color: "#f8fafc", display: "block" }}>
                      2.0ct Cushion Pavé Engagement Ring
                    </strong>
                    <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                      Multi-pass AI raytracing · 18k White Gold
                    </span>
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: "10px", color: "#34d399", fontWeight: 700, textTransform: "uppercase", display: "block" }}>
                    Render Time: 12.4s
                  </span>
                  <span className="js-display" style={{ fontSize: "20px", color: "#38bdf8" }}>$2,840</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
           4. MARQUEE BRAND STRIP
           ==================================================================== */}
      <section className="js-marquee-section">
        <p style={{ textAlign: "center", fontSize: "11px", color: "#64748b", fontFamily: "var(--font-mono-loaded, monospace)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "20px" }}>
          Trusted by premier custom ateliers &amp; retail jewelers nationwide
        </p>

        <div className="js-marquee-track">
          {[...BRAND_LOGOS, ...BRAND_LOGOS].map((brand, i) => (
            <span key={i} className="js-marquee-item">
              {brand}
            </span>
          ))}
        </div>
      </section>

      {/* ====================================================================
           5. THE PROBLEM SECTION & ANIMATED LOST-SALE CHAT SIMULATOR
           ==================================================================== */}
      <section id="the-problem" className="js-problem-section">
        <div className="js-container">
          <div className="js-problem-grid">
            
            {/* Left Narrative */}
            <div style={{ textAlign: "left" }}>
              <div className="js-eyebrow" style={{ marginBottom: "14px" }}>The Custom Order Dilemma</div>
              <h2 className="js-display" style={{ fontSize: "48px", lineHeight: "1.06", margin: "0 0 20px" }}>
                Stop doing free CAD sketches.
                <br />
                <span style={{ color: "#f43f5e" }}>1 out of 10</span> custom orders die for one reason.
              </h2>

              <p className="js-display" style={{ fontSize: "26px", lineHeight: "1.3", margin: "0 0 24px", color: "#f8fafc" }}>
                If they can&apos;t see it instantly,{" "}
                <span style={{ color: "#38bdf8", textDecoration: "underline" }}>
                  they will not buy it.
                </span>
              </p>

              <p style={{ color: "#94a3b8", fontSize: "16px", lineHeight: "1.7", marginBottom: "32px" }}>
                Customers walk into your showroom or message your Instagram with an inspiration photo. When you make them wait days for CAD sketches and estimates, their excitement cools off and they buy next door.
                <br /><br />
                <strong style={{ color: "#f8fafc" }}>Azzure AI Quote flips the script.</strong> Instant 3D renders and mathematically precise quotes on the spot lock in deposits while interest is at its peak.
              </p>

              <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                <Link href="/signup" className="js-btn-aurora">
                  Stop Losing Custom Sales →
                </Link>
                <button onClick={replayChat} className="js-btn-ghost" style={{ fontSize: "13px" }}>
                  ↻ Replay Simulation
                </button>
              </div>
            </div>

            {/* Right: iOS Chat Simulator */}
            <div className="js-glass-card js-chat-card">
              <div className="js-chat-header">
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "rgba(245, 208, 97, 0.2)", color: "#f5d061", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "12px" }}>
                    JD
                  </div>
                  <div>
                    <strong style={{ fontSize: "13px", color: "#f8fafc", display: "block" }}>Jessica Davies</strong>
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>Custom Solitaire Inquiry</span>
                  </div>
                </div>
                <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "4px", background: "rgba(244, 63, 94, 0.15)", color: "#f43f5e", fontWeight: "bold" }}>
                  GHOSTED
                </span>
              </div>

              <div key={chatKey} className="js-chat-messages">
                <div className="js-msg-bubble-left">
                  Hi! I love this 2ct oval ring on Pinterest. Can you make this and how much would it be? 💍
                </div>

                <div className="js-msg-bubble-right">
                  Hi Jessica! Sure thing! Let me talk to my CAD bench. Give us 3–4 business days to sketch specs and quote.
                </div>

                <div className="js-msg-bubble-right">
                  Does that work for you?
                </div>

                <div className="js-msg-bubble-right" style={{ opacity: 0.85 }}>
                  Hey Jessica, still interested? Just following up!
                  <span style={{ display: "block", fontSize: "9px", color: "rgba(255,255,255,0.7)", marginTop: "2px" }}>Read · 4 days ago</span>
                </div>

                <div style={{ fontSize: "11px", fontStyle: "italic", color: "#64748b", textAlign: "center", paddingTop: "8px" }}>
                  No reply. Customer purchased from competitor with instant 3D visual.
                </div>

                <div className="js-lost-sale-stamp">
                  $6,400 SALE LOST
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ====================================================================
           6. PRODUCT DEEP-DIVE: INTERACTIVE 3-STEP STUDIO GENERATOR
           ==================================================================== */}
      <section id="features" className="js-generator-section">
        <div className="js-container">
          <div style={{ marginBottom: "48px" }}>
            <span className="js-eyebrow">Interactive Demonstration</span>
            <h2 className="js-display" style={{ fontSize: "44px", margin: "10px 0 14px" }}>
              Turn any inspiration into a <em className="js-accent-italic">closed sale</em>.
            </h2>
            <p style={{ color: "#94a3b8", fontSize: "17px", maxWidth: "560px", margin: "0 auto" }}>
              Test how quick and effortless your customer quoting experience will be:
            </p>
          </div>

          <div className="js-glass-card js-generator-card">
            <div className="js-accent-line" />

            {/* Stepper Node Bar */}
            <div className="js-stepper-bar">
              <div className="js-step-node">
                <span className={`js-step-circle ${generatorStep >= 1 ? "is-active" : ""}`}>1</span>
                <span style={{ color: "#f8fafc" }}>Configure Piece</span>
              </div>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.15)", margin: "0 16px" }} />
              <div className="js-step-node">
                <span className={`js-step-circle ${generatorStep >= 2 ? "is-active" : ""}`}>2</span>
                <span style={{ color: "#f8fafc" }}>AI 3D Synthesis</span>
              </div>
              <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.15)", margin: "0 16px" }} />
              <div className="js-step-node">
                <span className={`js-step-circle ${generatorStep >= 3 ? "is-active" : ""}`}>3</span>
                <span style={{ color: "#f8fafc" }}>Deposit &amp; Order</span>
              </div>
            </div>

            {/* Step 1: Configuration Form */}
            {generatorStep === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "11px", color: "#64748b", fontFamily: "var(--font-mono-loaded, monospace)", textTransform: "uppercase", marginBottom: "6px" }}>
                      Center Gemstone
                    </label>
                    <select
                      value={genGem}
                      onChange={(e) => setGenGem(e.target.value)}
                      style={{ width: "100%", padding: "12px", background: "rgba(4, 7, 17, 0.7)", border: "1px solid rgba(56, 189, 248, 0.25)", borderRadius: "10px", color: "#f8fafc", fontSize: "14px" }}
                    >
                      <option value="Diamond">Natural Diamond (VS1 / F Color)</option>
                      <option value="Lab Diamond">Lab Grown Diamond (VVS / E Color)</option>
                      <option value="Sapphire">Ceylon Royal Blue Sapphire</option>
                      <option value="Emerald">Colombian Emerald</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "11px", color: "#64748b", fontFamily: "var(--font-mono-loaded, monospace)", textTransform: "uppercase", marginBottom: "6px" }}>
                      Precious Metal
                    </label>
                    <select
                      value={genMetal}
                      onChange={(e) => setGenMetal(e.target.value)}
                      style={{ width: "100%", padding: "12px", background: "rgba(4, 7, 17, 0.7)", border: "1px solid rgba(56, 189, 248, 0.25)", borderRadius: "10px", color: "#f8fafc", fontSize: "14px" }}
                    >
                      <option value="Platinum">Platinum 950 High-Polish</option>
                      <option value="18k Yellow Gold">18k Yellow Gold</option>
                      <option value="18k White Gold">18k White Gold</option>
                      <option value="18k Rose Gold">18k Rose Gold</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", color: "#64748b", fontFamily: "var(--font-mono-loaded, monospace)", textTransform: "uppercase", marginBottom: "6px" }}>
                    Vision Description
                  </label>
                  <textarea
                    rows={2}
                    value={genVision}
                    onChange={(e) => setGenVision(e.target.value)}
                    style={{ width: "100%", padding: "12px", background: "rgba(4, 7, 17, 0.7)", border: "1px solid rgba(56, 189, 248, 0.25)", borderRadius: "10px", color: "#f8fafc", fontSize: "14px", resize: "none" }}
                  />
                </div>

                <button type="button" onClick={runGeneratorFlow} className="js-btn-aurora" style={{ width: "100%", padding: "14px" }}>
                  ⚡ Generate 3D Concept &amp; Live Quote
                </button>
              </div>
            )}

            {/* Step 2: Processing */}
            {generatorStep === 2 && (
              <div style={{ padding: "40px 0", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                <div style={{ width: "48px", height: "48px", border: "4px solid #38bdf8", borderTopColor: "transparent", borderRadius: "50%", animation: "sweepRotation 1s linear infinite" }} />
                <div>
                  <strong style={{ fontSize: "18px", color: "#f8fafc", display: "block" }}>Synthesizing 3D Render &amp; Spot Prices</strong>
                  <span style={{ fontSize: "12px", color: "#94a3b8" }}>Connecting to live bullion feeds &amp; calculating labor margins...</span>
                </div>
                <div style={{ width: "100%", maxWidth: "400px", height: "8px", background: "rgba(255,255,255,0.1)", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ width: `${genProgress}%`, height: "100%", background: "linear-gradient(90deg, #38bdf8, #2563eb, #f5d061)", transition: "width 0.2s" }} />
                </div>
              </div>
            )}

            {/* Step 3: Complete & Deposit */}
            {generatorStep === 3 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px", alignItems: "center" }}>
                <div style={{ borderRadius: "16px", overflow: "hidden", aspectRatio: "1", background: "#080e22" }}>
                  <img src="/images/catalog/oval_solitaire.jpg" alt="Generated Ring" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <span style={{ fontSize: "10px", padding: "3px 8px", borderRadius: "9999px", background: "rgba(52, 211, 153, 0.15)", color: "#34d399", fontWeight: "bold", width: "max-content" }}>
                    ✓ 30-Day Guaranteed Price
                  </span>
                  <h3 className="js-display" style={{ fontSize: "24px", margin: 0 }}>
                    {genMetal} {genGem} Solitaire
                  </h3>

                  <div style={{ background: "rgba(4, 7, 17, 0.6)", border: "1px solid rgba(56, 189, 248, 0.15)", borderRadius: "12px", padding: "14px", fontSize: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8" }}>
                      <span>Precious Metal (Pt 950):</span>
                      <strong style={{ color: "#f8fafc" }}>$1,280</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8" }}>
                      <span>Diamond (2.0ct F/VS1):</span>
                      <strong style={{ color: "#f8fafc" }}>$4,850</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8" }}>
                      <span>Labor &amp; Setting:</span>
                      <strong style={{ color: "#f8fafc" }}>$670</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "8px", fontSize: "14px", fontWeight: "bold", color: "#f8fafc" }}>
                      <span>Approved Retail Price:</span>
                      <span className="js-display" style={{ fontSize: "22px", color: "#38bdf8" }}>$6,800</span>
                    </div>
                  </div>

                  {!genDepositPaid ? (
                    <button type="button" onClick={() => setGenDepositPaid(true)} className="js-btn-aurora" style={{ width: "100%", padding: "12px" }}>
                      💳 Capture $500 Deposit &amp; Dispatch
                    </button>
                  ) : (
                    <div style={{ padding: "12px", borderRadius: "10px", background: "rgba(52, 211, 153, 0.2)", border: "1px solid #34d399", color: "#34d399", textAlign: "center", fontSize: "13px", fontWeight: "bold" }}>
                      ✓ $500 Deposit Captured! Dispatched to Jeweler CRM.
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setGeneratorStep(1);
                      setGenDepositPaid(false);
                    }}
                    style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "12px", textDecoration: "underline", cursor: "pointer" }}
                  >
                    ← Configure another custom design
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </section>

      {/* ====================================================================
           7. WORKFLOW: "LIVE IN 1 MINUTE. CLOSING IN SECONDS."
           ==================================================================== */}
      <section id="how-it-works" className="js-workflow-section">
        <div className="js-container">
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <span className="js-eyebrow">Effortless Integration</span>
            <h2 className="js-display" style={{ fontSize: "44px", margin: "10px 0 14px" }}>
              Live in 1 minute. <em className="js-accent-italic">Closing in seconds.</em>
            </h2>
            <p style={{ color: "#94a3b8", fontSize: "17px", maxWidth: "560px", margin: "0 auto" }}>
              No software developers required. Embeds on any site or showroom iPad with one line of code.
            </p>
          </div>

          <div className="js-workflow-grid">
            
            {/* Display Panel Left */}
            <div className="js-glass-card" style={{ padding: "32px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div className="js-accent-line" />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="js-eyebrow">Step 0{workflowTab + 1} Architecture</span>
                <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "4px", background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", fontWeight: "bold" }}>
                  ACTIVE
                </span>
              </div>

              <div style={{ margin: "auto 0", padding: "24px 0", textAlign: "left" }}>
                {workflowTab === 0 && (
                  <div>
                    <h3 className="js-display" style={{ fontSize: "28px", margin: "0 0 12px" }}>
                      Connect to Shopify, WooCommerce, Wix, or Custom Website
                    </h3>
                    <p style={{ color: "#94a3b8", fontSize: "15px", lineHeight: "1.6", marginBottom: "18px" }}>
                      Embed our lightning-fast 3D quotation widget onto your website with a single copy-paste script tag. Integrates seamlessly with your existing luxury brand theme.
                    </p>
                    <div style={{ padding: "14px", borderRadius: "10px", background: "#040711", border: "1px solid rgba(56, 189, 248, 0.2)", fontFamily: "var(--font-mono-loaded, monospace)", fontSize: "12px", color: "#38bdf8" }}>
                      &lt;script src=&quot;https://cdn.azzureaiquote.com/embed.js&quot; data-store=&quot;your-store&quot;&gt;&lt;/script&gt;
                    </div>
                  </div>
                )}

                {workflowTab === 1 && (
                  <div>
                    <h3 className="js-display" style={{ fontSize: "28px", margin: "0 0 12px" }}>
                      Set Your Precious Metal Formulas &amp; Retail Markups
                    </h3>
                    <p style={{ color: "#94a3b8", fontSize: "15px", lineHeight: "1.6", marginBottom: "18px" }}>
                      Control your margins down to the dollar. Set custom multipliers on precious metal spot prices, diamond carat weight tiers, and labor setting costs.
                    </p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div style={{ padding: "14px", borderRadius: "10px", background: "#040711", border: "1px solid rgba(56, 189, 248, 0.2)" }}>
                        <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>Gold Spot Markup</span>
                        <strong style={{ fontSize: "18px", color: "#34d399" }}>+35% Retail</strong>
                      </div>
                      <div style={{ padding: "14px", borderRadius: "10px", background: "#040711", border: "1px solid rgba(56, 189, 248, 0.2)" }}>
                        <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>Deposit Requirement</span>
                        <strong style={{ fontSize: "18px", color: "#f5d061" }}>20% or $500 Min</strong>
                      </div>
                    </div>
                  </div>
                )}

                {workflowTab === 2 && (
                  <div>
                    <h3 className="js-display" style={{ fontSize: "28px", margin: "0 0 12px" }}>
                      Shoppers Describe Dreams &amp; Get Photoreal Visuals
                    </h3>
                    <p style={{ color: "#94a3b8", fontSize: "15px", lineHeight: "1.6", marginBottom: "18px" }}>
                      Clients upload photos from Instagram, Pinterest, or camera roll. Azzure generates hyper-realistic 3D images and quotes immediately.
                    </p>
                    <div style={{ padding: "14px", borderRadius: "10px", background: "#040711", border: "1px solid rgba(56, 189, 248, 0.2)", display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "22px" }}>📸</span>
                      <span style={{ fontSize: "13px", color: "#94a3b8" }}>Photo merged with live pricing matrix in &lt; 15 seconds.</span>
                    </div>
                  </div>
                )}

                {workflowTab === 3 && (
                  <div>
                    <h3 className="js-display" style={{ fontSize: "28px", margin: "0 0 12px" }}>
                      Automated Lead Capture &amp; Direct Manufacturing Queue
                    </h3>
                    <p style={{ color: "#94a3b8", fontSize: "15px", lineHeight: "1.6", marginBottom: "18px" }}>
                      Customer deposits are securely processed before they leave your site. Quote specs automatically export to PDF and push directly to CAD/CAM casting.
                    </p>
                    <div style={{ padding: "14px", borderRadius: "10px", background: "rgba(52, 211, 153, 0.15)", border: "1px solid #34d399", color: "#34d399", fontSize: "13px", fontWeight: "bold" }}>
                      ✓ Instant Stripe deposit checkout + PDF quote reference link generated.
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    onClick={() => setWorkflowTab(idx)}
                    style={{
                      flex: 1,
                      height: "4px",
                      borderRadius: "2px",
                      background: workflowTab === idx ? "linear-gradient(90deg, #38bdf8, #2563eb, #f5d061)" : "rgba(255,255,255,0.15)",
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Selectors Right */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[
                { step: "01", title: "Connect to your website", desc: "One snippet, one minute, any platform." },
                { step: "02", title: "Set up pricing & formulas", desc: "Match your colors, logo, markups, and catalog." },
                { step: "03", title: "Customers design live", desc: "AI visual builder with instant 3D renders." },
                { step: "04", title: "Lead capture & deposit secured", desc: "Hot buyers land in your CRM with deposits attached." }
              ].map((item, idx) => (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => setWorkflowTab(idx)}
                  className={`js-tab-btn ${workflowTab === idx ? "is-active" : ""}`}
                >
                  <span className="js-eyebrow" style={{ fontSize: "14px" }}>{item.step}</span>
                  <div>
                    <strong style={{ fontSize: "15px", color: "#f8fafc", display: "block", marginBottom: "4px" }}>
                      {item.title}
                    </strong>
                    <span style={{ fontSize: "13px", color: "#94a3b8" }}>{item.desc}</span>
                  </div>
                </button>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ====================================================================
           8. JEWELER DASHBOARD SPOTLIGHT ("Zero Guesswork. Total Visibility.")
           ==================================================================== */}
      <section id="dashboard" className="js-dashboard-section">
        <div className="js-container">
          <div style={{ textAlign: "left", marginBottom: "40px", maxWidth: "600px" }}>
            <span className="js-eyebrow">Jeweler Back-Office Portal</span>
            <h2 className="js-display" style={{ fontSize: "44px", margin: "10px 0 14px" }}>
              Zero guesswork.<br />
              <em className="js-accent-italic">Total pipeline visibility.</em>
            </h2>
            <p style={{ color: "#94a3b8", fontSize: "16px" }}>
              Every lead, custom design, metal spot rate, and deposit tracked in real time.
            </p>
          </div>

          <div className="js-glass-card" style={{ padding: "32px" }}>
            <div className="js-accent-line" />

            <div className="js-kpi-grid">
              <div className="js-kpi-card">
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span className="js-eyebrow" style={{ color: "#94a3b8" }}>Designs Generated</span>
                  <span style={{ color: "#34d399", fontWeight: "bold", fontSize: "12px" }}>+24%</span>
                </div>
                <div className="js-display" style={{ fontSize: "36px" }}>245</div>
                <span style={{ fontSize: "12px", color: "#64748b" }}>This month across all devices</span>
              </div>

              <div className="js-kpi-card">
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span className="js-eyebrow" style={{ color: "#94a3b8" }}>Qualified Leads</span>
                  <span style={{ color: "#34d399", fontWeight: "bold", fontSize: "12px" }}>+18%</span>
                </div>
                <div className="js-display" style={{ fontSize: "36px", color: "#38bdf8" }}>84</div>
                <span style={{ fontSize: "12px", color: "#64748b" }}>With customer inspiration photos</span>
              </div>

              <div className="js-kpi-card">
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span className="js-eyebrow" style={{ color: "#94a3b8" }}>Deposits Secured</span>
                  <span style={{ color: "#34d399", fontWeight: "bold", fontSize: "12px" }}>+31%</span>
                </div>
                <div className="js-display" style={{ fontSize: "36px", color: "#f5d061" }}>$34,800</div>
                <span style={{ fontSize: "12px", color: "#64748b" }}>Collected directly before CAD</span>
              </div>
            </div>

            <div style={{ textAlign: "left" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}>
                <span className="js-eyebrow">Recent Quotation Stream</span>
                <span style={{ fontSize: "12px", color: "#38bdf8" }}>● Real-Time Sync</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[
                  { client: "Sarah M.", item: "1.8ct Pear Halo Engagement Ring", amount: "$4,500", status: "Deposit Secured", color: "#34d399" },
                  { client: "Marcus T.", item: "Platinum 3-Stone Emerald Diamond Band", amount: "$8,450", status: "Quote Sent", color: "#38bdf8" },
                  { client: "Jenna L.", item: "14k Gold Custom Monogram Iced Pendant", amount: "$3,200", status: "In Production", color: "#f5d061" }
                ].map((row, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 18px",
                      borderRadius: "12px",
                      background: "rgba(4, 7, 17, 0.5)",
                      border: "1px solid rgba(56, 189, 248, 0.12)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "12px" }}>
                        {row.client.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <strong style={{ fontSize: "14px", color: "#f8fafc", display: "block" }}>{row.client}</strong>
                        <span style={{ fontSize: "12px", color: "#94a3b8" }}>{row.item}</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <span className="js-display" style={{ fontSize: "17px", color: "#f8fafc" }}>{row.amount}</span>
                      <span style={{ fontSize: "10px", padding: "3px 8px", borderRadius: "9999px", border: `1px solid ${row.color}`, color: row.color, fontWeight: "bold", fontFamily: "var(--font-mono-loaded, monospace)" }}>
                        {row.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ====================================================================
           9. SHOWROOM KIOSK MODE (In-Store iPad Flagship)
           ==================================================================== */}
      <section id="showroom" className="js-showroom-section">
        <div className="js-container">
          <div className="js-showroom-grid">
            
            <div style={{ textAlign: "left" }}>
              <span className="js-eyebrow" style={{ color: "#f5d061", display: "block", marginBottom: "12px" }}>
                ★ Enterprise Flagship Feature
              </span>
              <h2 className="js-display" style={{ fontSize: "44px", margin: "0 0 20px", lineHeight: "1.1" }}>
                Turn your showroom floor into a <em className="js-accent-gold">self-service quote studio</em>.
              </h2>
              <p style={{ color: "#94a3b8", fontSize: "16px", lineHeight: "1.7", marginBottom: "32px" }}>
                Place an iPad or touchscreen kiosk on your showroom counter. Walk-in shoppers upload inspiration images, adjust diamond specs, and receive an instant private quote code (<strong style={{ color: "#f8fafc" }}>QT-4821</strong>).
                <br /><br />
                Your sales reps pull up the exact specifications in the jeweler portal, confirm metal weight, and dispatch to manufacturing instantly.
              </p>
              <button onClick={openKioskModal} className="js-btn-aurora">
                Launch Showroom Kiosk Simulation →
              </button>
            </div>

            <div className="js-glass-card" style={{ padding: "32px", textAlign: "center", border: "1px solid rgba(245, 208, 97, 0.35)" }}>
              <strong className="js-display" style={{ fontSize: "22px", color: "#f5d061", display: "block", marginBottom: "4px" }}>
                Crown Jewellers
              </strong>
              <span style={{ fontSize: "11px", color: "#94a3b8", fontFamily: "var(--font-mono-loaded, monospace)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "20px" }}>
                In-Store Interactive Kiosk
              </span>

              <div style={{ padding: "20px", borderRadius: "16px", background: "#040711", border: "1px solid rgba(56, 189, 248, 0.2)", marginBottom: "16px" }}>
                <div style={{ width: "80px", height: "80px", margin: "0 auto 12px", borderRadius: "12px", overflow: "hidden", background: "#080e22" }}>
                  <img src="/images/catalog/oval_solitaire.jpg" alt="Showroom piece" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>Private Quote Reference</span>
                <span style={{ fontFamily: "var(--font-mono-loaded, monospace)", fontSize: "26px", fontWeight: "bold", color: "#f5d061", letterSpacing: "0.1em", display: "block", margin: "4px 0" }}>
                  QT-4821
                </span>
                <span className="js-display" style={{ fontSize: "30px", color: "#f8fafc" }}>$2,380</span>
              </div>

              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Customer presents quote reference · Sales staff pulls CAD in 5 seconds
              </span>
            </div>

          </div>
        </div>
      </section>

      {/* ====================================================================
           10. PRICING SECTION (Built for Scale)
           ==================================================================== */}
      <section id="pricing" className="js-pricing-section">
        <div className="js-container">
          <div style={{ marginBottom: "40px" }}>
            <span className="js-eyebrow">Transparent Pricing</span>
            <h2 className="js-display" style={{ fontSize: "44px", margin: "10px 0 14px" }}>
              Simple pricing. <em className="js-accent-italic">Built for Scale.</em>
            </h2>
            <p style={{ color: "#94a3b8", fontSize: "17px", maxWidth: "520px", margin: "0 auto" }}>
              14-day free trial on all plans. No setup fee. Cancel anytime.
            </p>
          </div>

          {/* Toggle Monthly / Annual */}
          <div className="js-pricing-toggle">
            <button
              type="button"
              onClick={() => setIsAnnual(false)}
              className={`js-toggle-btn ${!isAnnual ? "is-active" : ""}`}
            >
              Monthly Billing
            </button>
            <button
              type="button"
              onClick={() => setIsAnnual(true)}
              className={`js-toggle-btn ${isAnnual ? "is-active" : ""}`}
            >
              Annual Billing (Save 20%)
            </button>
          </div>

          <div className="js-pricing-grid">
            
            {/* Starter */}
            <div className="js-glass-card js-price-card">
              <div>
                <h3 className="js-display" style={{ fontSize: "24px", margin: "0 0 6px" }}>Starter</h3>
                <p style={{ fontSize: "12px", color: "#94a3b8", margin: "0 0 20px" }}>For solo jewelers &amp; boutique studios</p>
                <div className="js-display" style={{ fontSize: "44px", marginBottom: "20px" }}>
                  ${isAnnual ? 79 : 99}
                  <span style={{ fontSize: "14px", color: "#94a3b8", fontWeight: "normal" }}>/ mo</span>
                </div>

                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px", color: "#94a3b8", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "18px" }}>
                  <li style={{ color: "#f8fafc" }}>✓ <strong>300 quotes / month</strong></li>
                  <li>✓ Full 3-pass AI + manual override</li>
                  <li>✓ Branded PDFs (Logo + brand name)</li>
                  <li>✓ Complete quote history &amp; CRM</li>
                  <li>✓ Up to 3 staff seats</li>
                  <li>✓ Live precious metal spot rates</li>
                </ul>

                {expandedCards["starter"] && (
                  <ul style={{ listStyle: "none", padding: 0, marginTop: "10px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px", color: "#94a3b8" }}>
                    <li>✓ Email &amp; chat support</li>
                    <li>✓ Alloy density weight conversions</li>
                  </ul>
                )}

                <button
                  type="button"
                  onClick={() => toggleExpand("starter")}
                  style={{ background: "transparent", border: "none", color: "#38bdf8", fontSize: "12px", cursor: "pointer", padding: "10px 0 0", textAlign: "left" }}
                >
                  {expandedCards["starter"] ? "Hide features ↑" : "View all features ↓"}
                </button>
              </div>

              <Link href="/signup?plan=starter" className="js-btn-ghost" style={{ width: "100%", marginTop: "24px" }}>
                Start Free Trial
              </Link>
            </div>

            {/* Professional */}
            <div className="js-glass-card js-price-card is-popular">
              <span className="js-price-popular-badge">★ Most Popular · 14-Day Trial</span>

              <div>
                <h3 className="js-display" style={{ fontSize: "24px", margin: "0 0 6px" }}>Professional</h3>
                <p style={{ fontSize: "12px", color: "#94a3b8", margin: "0 0 20px" }}>For growing shops quoting every day</p>
                <div className="js-display js-aurora-text" style={{ fontSize: "44px", marginBottom: "20px" }}>
                  ${isAnnual ? 159 : 199}
                  <span style={{ fontSize: "14px", color: "#94a3b8", fontWeight: "normal" }}>/ mo</span>
                </div>

                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px", color: "#94a3b8", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "18px" }}>
                  <li style={{ color: "#f8fafc" }}>✓ <strong>1,200 quotes / month</strong></li>
                  <li style={{ color: "#f8fafc" }}>✓ Everything in Starter</li>
                  <li>✓ Unlimited staff seats + role access</li>
                  <li>✓ Shareable branded quote links</li>
                  <li>✓ Custom pricing markups &amp; formulas</li>
                  <li>✓ Embed on unlimited website domains</li>
                </ul>

                {expandedCards["pro"] && (
                  <ul style={{ listStyle: "none", padding: 0, marginTop: "10px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px", color: "#94a3b8" }}>
                    <li>✓ Priority 24/7 support response</li>
                    <li>✓ Multi-photo merge analysis</li>
                  </ul>
                )}

                <button
                  type="button"
                  onClick={() => toggleExpand("pro")}
                  style={{ background: "transparent", border: "none", color: "#38bdf8", fontSize: "12px", cursor: "pointer", padding: "10px 0 0", textAlign: "left" }}
                >
                  {expandedCards["pro"] ? "Hide features ↑" : "View all features ↓"}
                </button>
              </div>

              <Link href="/signup?plan=professional" className="js-btn-aurora" style={{ width: "100%", marginTop: "24px" }}>
                Start Free Trial
              </Link>
            </div>

            {/* Enterprise */}
            <div className="js-glass-card js-price-card" style={{ border: "1px solid rgba(245, 208, 97, 0.45)" }}>
              <div>
                <h3 className="js-display" style={{ fontSize: "24px", margin: "0 0 6px", color: "#f5d061" }}>Enterprise</h3>
                <p style={{ fontSize: "12px", color: "#94a3b8", margin: "0 0 20px" }}>Showrooms, kiosks &amp; high volume</p>
                <div className="js-display" style={{ fontSize: "44px", marginBottom: "20px", color: "#f5d061" }}>
                  ${isAnnual ? 239 : 299}
                  <span style={{ fontSize: "14px", color: "#94a3b8", fontWeight: "normal" }}>/ mo</span>
                </div>

                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px", color: "#94a3b8", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "18px" }}>
                  <li style={{ color: "#f8fafc" }}>✓ <strong>2,500 quotes / month</strong></li>
                  <li style={{ color: "#f8fafc" }}>✓ Everything in Professional</li>
                  <li style={{ color: "#f5d061", fontWeight: "bold" }}>★ Photorealistic 3D Concept Renders</li>
                  <li style={{ color: "#f5d061", fontWeight: "bold" }}>★ In-Store Tablet (Kiosk Mode)</li>
                  <li>✓ Full Auto-Push to Custom King / CAD</li>
                  <li>✓ Dedicated account manager &amp; VIP queue</li>
                </ul>

                {expandedCards["ent"] && (
                  <ul style={{ listStyle: "none", padding: 0, marginTop: "10px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "13px", color: "#94a3b8" }}>
                    <li>✓ Custom showroom branding lockup</li>
                    <li>✓ 1-on-1 staff onboarding session</li>
                  </ul>
                )}

                <button
                  type="button"
                  onClick={() => toggleExpand("ent")}
                  style={{ background: "transparent", border: "none", color: "#f5d061", fontSize: "12px", cursor: "pointer", padding: "10px 0 0", textAlign: "left" }}
                >
                  {expandedCards["ent"] ? "Hide features ↑" : "View all features ↓"}
                </button>
              </div>

              <Link href="/signup?plan=enterprise" className="js-btn-ghost" style={{ width: "100%", marginTop: "24px", borderColor: "rgba(245, 208, 97, 0.4)", color: "#f5d061" }}>
                Start Enterprise Trial
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* ====================================================================
           11. FAQ ACCORDION
           ==================================================================== */}
      <section id="faq" className="js-faq-section">
        <div className="js-container-xs">
          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <span className="js-eyebrow">FAQ</span>
            <h2 className="js-display" style={{ fontSize: "42px", margin: "10px 0" }}>
              Got a <em className="js-accent-italic">question?</em>
            </h2>
          </div>

          <div>
            {[
              {
                q: "What is Azzure AI Quote?",
                a: "Azzure AI Quote is an AI-powered pricing and 3D visualization platform engineered specifically for independent and luxury retail jewelers. It allows customers to upload any inspiration photo and receive instant, photorealistic 3D renders with mathematically accurate retail quotes in seconds."
              },
              {
                q: "How fast can I go live on my website and in-store?",
                a: "You can be live in under 60 seconds. Simply add our lightweight embed script to Shopify, WooCommerce, Squarespace, Wix, or WordPress, or launch the tablet kiosk mode in your showroom. No developer needed."
              },
              {
                q: "Is Azzure AI Quote fully white-labeled?",
                a: "Yes. Customers only ever see your brand logo, your brand colors, and your custom quote domain. Azzure remains completely invisible."
              },
              {
                q: "How does the live precious metal spot pricing work?",
                a: "We automatically stream live bullion spot prices for gold, platinum, and silver daily. When gold moves, your quote margins automatically stay protected."
              },
              {
                q: "Can I customize diamond markups, labor, and setting fees?",
                a: "Absolutely. You can set custom dollar-per-gram labor rates, stone setting fees by diamond shape and size, and percentage retail profit markups."
              },
              {
                q: "Is there a free trial?",
                a: "Yes! Every account includes a risk-free 14-day trial with full feature access so you can test live custom quoting with your actual customers before committing."
              }
            ].map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx} className="js-faq-item">
                  <button type="button" onClick={() => toggleFaq(idx)} className="js-faq-question">
                    <span>{item.q}</span>
                    <span style={{ color: "#38bdf8", fontWeight: "bold" }}>{isOpen ? "−" : "+"}</span>
                  </button>
                  {isOpen && <div className="js-faq-answer">{item.a}</div>}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ====================================================================
           12. FINAL AURORA CALL TO ACTION
           ==================================================================== */}
      <section className="js-cta-section">
        <div className="js-container-xs">
          <span className="js-eyebrow">Get Started Today</span>
          
          <h2 className="js-display" style={{ fontSize: "52px", lineHeight: "1.1", margin: "14px 0 20px" }}>
            Your next customer is already<br />
            looking for this <span className="js-aurora-text">ring</span>.
          </h2>

          <p style={{ color: "#94a3b8", fontSize: "18px", lineHeight: "1.6", marginBottom: "32px" }}>
            Stop losing custom orders to slow sketches. Deliver instant 3D quotes that turn casual browsers into paying clients.
          </p>

          <Link href="/signup" className="js-btn-aurora" style={{ fontSize: "16px", padding: "16px 40px" }}>
            Start 14-Day Free Trial →
          </Link>

          <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginTop: "32px", fontSize: "12px", color: "#64748b" }}>
            <span>🔒 Isolated Tenant Database</span>
            <span>•</span>
            <span>⭐ Cancel Anytime</span>
            <span>•</span>
            <span>💳 No Credit Card Required</span>
          </div>
        </div>
      </section>

      {/* ====================================================================
           13. LUXURY FOOTER
           ==================================================================== */}
      <footer className="js-footer">
        <div className="js-container" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: "linear-gradient(135deg, #38bdf8, #2563eb)", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "12px" }}>
              A
            </div>
            <strong className="js-display" style={{ fontSize: "16px", color: "#f8fafc" }}>Azzure AI Quote</strong>
            <span>· Built by azzuresolutions.com</span>
          </div>

          <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
            <a href="#features" style={{ color: "#94a3b8", textDecoration: "none" }}>Features</a>
            <a href="#pricing" style={{ color: "#94a3b8", textDecoration: "none" }}>Pricing</a>
            <a href="#faq" style={{ color: "#94a3b8", textDecoration: "none" }}>FAQ</a>
            <Link href="/signin" style={{ color: "#38bdf8", textDecoration: "none", fontWeight: "bold" }}>
              Jeweler Log in →
            </Link>
          </div>
        </div>
      </footer>

      {/* ====================================================================
           SHOWROOM WALKTHROUGH MODAL SIMULATION
           ==================================================================== */}
      {kioskOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(2, 4, 10, 0.88)",
            backdropFilter: "blur(14px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="js-glass-card" style={{ maxWidth: "520px", width: "100%", padding: "32px", textAlign: "center", position: "relative", border: "1px solid rgba(245, 208, 97, 0.4)" }}>
            <button
              onClick={() => setKioskOpen(false)}
              style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                fontSize: "20px",
                cursor: "pointer"
              }}
            >
              ✕
            </button>

            {kioskSlide === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <span className="js-display" style={{ fontSize: "22px", color: "#f5d061" }}>Crown Jewellers</span>
                <h3 className="js-display" style={{ fontSize: "26px", margin: 0 }}>Design Your Dream Piece</h3>
                <p style={{ fontSize: "13px", color: "#94a3b8", lineHeight: "1.6" }}>
                  Showroom floor touchscreen mode: customer taps to upload their inspiration photo and receive instant quote specs.
                </p>
                <button onClick={startKioskUpload} className="js-btn-aurora" style={{ width: "100%" }}>
                  Start Kiosk Simulation →
                </button>
              </div>
            )}

            {kioskSlide === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <span className="js-display" style={{ fontSize: "22px", color: "#f5d061" }}>Crown Jewellers</span>
                <h3 style={{ fontSize: "18px", color: "#f8fafc", margin: 0 }}>Customer Inspiration Upload</h3>
                <div style={{ padding: "32px", border: "2px dashed rgba(56, 189, 248, 0.4)", borderRadius: "16px", background: "rgba(56, 189, 248, 0.08)" }}>
                  {kioskUploadLoaded ? (
                    <span style={{ color: "#34d399", fontWeight: "bold", fontSize: "13px" }}>✓ client_ring_photo.jpg (Uploaded)</span>
                  ) : (
                    <span style={{ color: "#94a3b8", fontSize: "13px" }}>Simulating customer photo tap...</span>
                  )}
                </div>
                <button onClick={runKioskAnalysis} disabled={!kioskUploadLoaded} className="js-btn-aurora" style={{ width: "100%", opacity: kioskUploadLoaded ? 1 : 0.5 }}>
                  Analyze &amp; Generate Quote →
                </button>
              </div>
            )}

            {kioskSlide === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <span className="js-display" style={{ fontSize: "22px", color: "#f5d061" }}>Crown Jewellers</span>
                <h3 style={{ fontSize: "18px", color: "#f8fafc", margin: 0 }}>Multi-Pass Geometry Analysis</h3>
                <div style={{ padding: "16px", background: "rgba(4, 7, 17, 0.7)", borderRadius: "12px", textAlign: "left", fontFamily: "var(--font-mono-loaded, monospace)", fontSize: "13px", color: "#94a3b8", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div>{kioskLine1}</div>
                  <div>{kioskLine2}</div>
                  <div>{kioskLine3}</div>
                </div>
              </div>
            )}

            {kioskSlide === 4 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <span className="js-display" style={{ fontSize: "22px", color: "#f5d061" }}>Crown Jewellers</span>
                <div style={{ padding: "18px", background: "rgba(4, 7, 17, 0.7)", borderRadius: "16px", border: "1px solid rgba(245, 208, 97, 0.3)" }}>
                  <span style={{ fontSize: "11px", color: "#94a3b8", display: "block" }}>Quote Reference Code</span>
                  <span style={{ fontFamily: "var(--font-mono-loaded, monospace)", fontSize: "32px", fontWeight: "bold", color: "#f5d061", letterSpacing: "0.1em", display: "block", margin: "4px 0" }}>
                    QT-4821
                  </span>
                  <span className="js-display" style={{ fontSize: "32px", color: "#f8fafc" }}>$2,380</span>
                </div>
                <p style={{ fontSize: "13px", color: "#94a3b8" }}>
                  Customer presents this code at the showroom counter.
                </p>
                <button onClick={() => setKioskSlide(5)} className="js-btn-aurora" style={{ width: "100%" }}>
                  Open Jeweler Counter Lookup View →
                </button>
              </div>
            )}

            {kioskSlide === 5 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", textAlign: "left" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="js-eyebrow">Jeweler Sales Portal</span>
                  <span style={{ color: "#34d399", fontSize: "12px" }}>● Live Sync</span>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    value="QT-4821"
                    readOnly
                    style={{ flex: 1, padding: "10px 14px", background: "rgba(4, 7, 17, 0.7)", border: "1px solid rgba(245, 208, 97, 0.3)", borderRadius: "10px", color: "#f5d061", fontFamily: "var(--font-mono-loaded, monospace)", fontSize: "16px", fontWeight: "bold" }}
                  />
                  <button onClick={() => setJewelerResultShow(true)} className="js-btn-aurora" style={{ padding: "10px 18px", fontSize: "13px" }}>
                    Fetch Specs
                  </button>
                </div>

                {jewelerResultShow && (
                  <div style={{ padding: "16px", background: "rgba(56, 189, 248, 0.1)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "12px", fontSize: "13px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <strong style={{ color: "#f8fafc" }}>18k Yellow Gold · 1.5ct Oval VS1</strong>
                    <span style={{ color: "#94a3b8" }}>Instant margin calculated at +40% retail markup ($2,380 approved price).</span>
                    <button
                      onClick={() => {
                        alert("Quote sent directly to CAD manufacturing queue!");
                        setKioskOpen(false);
                      }}
                      className="js-btn-aurora"
                      style={{ marginTop: "8px", width: "100%" }}
                    >
                      🚀 Send to CAD Manufacturing
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
