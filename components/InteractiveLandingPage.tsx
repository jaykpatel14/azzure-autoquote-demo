"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";

// ============================================================================
// PRESET CONFIGURATIONS & CATALOG ASSETS
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
    promptText: "An elegant 1.5ct oval solitaire ring in 18k yellow gold with razor-thin band and hidden diamond halo..."
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
  const [renderProgress, setRenderProgress] = useState<number>(100);

  // The Problem Chat Animation State
  const [chatActive, setChatActive] = useState<boolean>(true);
  const [chatKey, setChatKey] = useState<number>(1);

  // How it works tabs
  const [workflowTab, setWorkflowTab] = useState<number>(0);

  // Studio Generator Interactive Sandbox State
  const [generatorStep, setGeneratorStep] = useState<number>(1);
  const [genGem, setGenGem] = useState<string>("Diamond");
  const [genMetal, setGenMetal] = useState<string>("Platinum");
  const [genVision, setGenVision] = useState<string>("Classic round brilliant halo solitaire, platinum band, 2ct center stone");
  const [genProgress, setGenProgress] = useState<number>(0);
  const [genDepositPaid, setGenDepositPaid] = useState<boolean>(false);

  // Showroom Kiosk Modal
  const [kioskOpen, setKioskOpen] = useState<boolean>(false);
  const [kioskSlide, setKioskSlide] = useState<number>(1);
  const [kioskUploadLoaded, setKioskUploadLoaded] = useState<boolean>(false);
  const [kioskLine1, setKioskLine1] = useState<string>("Identifying metal...");
  const [kioskLine2, setKioskLine2] = useState<string>("Estimating diamonds...");
  const [kioskLine3, setKioskLine3] = useState<string>("Calculating weight...");
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
    setRenderProgress(30);

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
        setRenderProgress(100);
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
    setChatActive(false);
    setTimeout(() => {
      setChatKey((k) => k + 1);
      setChatActive(true);
    }, 100);
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const toggleExpand = (key: string) => {
    setExpandedCards((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Showroom modal actions
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
    setKioskLine1("Identifying metal...");
    setKioskLine2("Estimating diamonds...");
    setKioskLine3("Calculating weight...");

    setTimeout(() => setKioskLine1("→ 18k Yellow Gold ✓"), 800);
    setTimeout(() => setKioskLine2("→ 1.5ct VS1 Oval Solitaire ✓"), 1600);
    setTimeout(() => setKioskLine3("→ 4.8g Gold Geometry ✓"), 2300);
    setTimeout(() => setKioskSlide(4), 3000);
  };

  return (
    <div className="min-h-screen bg-obsidian text-ice overflow-x-hidden selection:bg-purple-500 selection:text-white">
      {/* ====================================================================
           1. NAVIGATION BAR (Frosted Floating Glass Pill)
           ==================================================================== */}
      <header className="fixed top-0 inset-x-0 z-50 pointer-events-none transition-all duration-300">
        <div
          className="mx-auto pointer-events-auto px-4 sm:px-6 transition-all duration-300"
          style={{ maxWidth: "80rem", paddingTop: scrolled ? "12px" : "20px" }}
        >
          <div
            className="relative flex items-center justify-between px-5 py-3 rounded-full transition-all duration-300"
            style={{
              background: scrolled
                ? "linear-gradient(180deg, rgba(10,11,20,0.85), rgba(8,9,13,0.85))"
                : "linear-gradient(180deg, rgba(10,11,20,0.65), rgba(8,9,13,0.65))",
              backdropFilter: "blur(18px) saturate(180%)",
              WebkitBackdropFilter: "blur(18px) saturate(180%)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.18)"
            }}
          >
            {/* Logo */}
            <a href="#hero" className="flex items-center gap-2.5 group shrink-0 text-decoration-none">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-cyan-400 via-indigo-400 to-purple-500 p-0.5 shadow-lg shadow-purple-500/20">
                <div className="w-full h-full bg-[#08090D] rounded-[7px] flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-cyan-300">
                    <polygon points="6 3 18 3 22 9 12 22 2 9" />
                  </svg>
                </div>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-display-luxury text-xl font-bold text-ice tracking-tight">Azzure</span>
                <span className="font-mono text-[11px] font-bold text-aurora-violet uppercase tracking-widest px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                  AI Quote
                </span>
              </div>
            </a>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center gap-7">
              <a href="#features" className="text-[14px] font-medium text-smoke hover:text-ice transition-colors">
                Features
              </a>
              <a href="#design-studio" className="text-[14px] font-medium text-smoke hover:text-ice transition-colors">
                Live Studio
              </a>
              <a href="#the-problem" className="text-[14px] font-medium text-smoke hover:text-ice transition-colors">
                The Problem
              </a>
              <a href="#how-it-works" className="text-[14px] font-medium text-smoke hover:text-ice transition-colors">
                How It Works
              </a>
              <a href="#dashboard" className="text-[14px] font-medium text-smoke hover:text-ice transition-colors">
                Dashboard
              </a>
              <a href="#showroom" className="text-[14px] font-medium text-smoke hover:text-ice transition-colors">
                Showroom Kiosk
              </a>
              <a href="#pricing" className="text-[14px] font-medium text-smoke hover:text-ice transition-colors">
                Pricing
              </a>
              <a href="#faq" className="text-[14px] font-medium text-smoke hover:text-ice transition-colors">
                FAQ
              </a>
            </nav>

            {/* Right CTAs */}
            <div className="flex items-center gap-3">
              <Link
                href="/signin"
                className="hidden sm:inline-block text-[13.5px] font-medium text-smoke hover:text-ice px-3 py-1.5 transition-colors"
              >
                Log in
              </Link>
              <Link href="/signup" className="btn-aurora text-[13.5px] px-5 py-2">
                Start Free Trial
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-smoke hover:text-ice focus:outline-none"
                aria-label="Toggle Navigation"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="18" x2="20" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Drawer */}
          {mobileMenuOpen && (
            <div className="lg:hidden mt-2 p-5 rounded-2xl glass-panel-dark flex flex-col gap-3 text-left animate-rise">
              <a onClick={() => setMobileMenuOpen(false)} href="#features" className="text-sm font-medium py-1.5 text-smoke hover:text-ice">Features</a>
              <a onClick={() => setMobileMenuOpen(false)} href="#design-studio" className="text-sm font-medium py-1.5 text-smoke hover:text-ice">Live Studio</a>
              <a onClick={() => setMobileMenuOpen(false)} href="#the-problem" className="text-sm font-medium py-1.5 text-smoke hover:text-ice">The Problem</a>
              <a onClick={() => setMobileMenuOpen(false)} href="#how-it-works" className="text-sm font-medium py-1.5 text-smoke hover:text-ice">How It Works</a>
              <a onClick={() => setMobileMenuOpen(false)} href="#showroom" className="text-sm font-medium py-1.5 text-smoke hover:text-ice">Showroom Kiosk</a>
              <a onClick={() => setMobileMenuOpen(false)} href="#pricing" className="text-sm font-medium py-1.5 text-smoke hover:text-ice">Pricing</a>
              <a onClick={() => setMobileMenuOpen(false)} href="#faq" className="text-sm font-medium py-1.5 text-smoke hover:text-ice">FAQ</a>
              <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
                <Link href="/signin" className="text-sm font-semibold text-center py-2 text-ice">Log in</Link>
                <Link href="/signup" className="btn-aurora text-center py-2.5">Start 14-Day Free Trial</Link>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ====================================================================
           2. HERO SECTION (Dark Obsidian + Dynamic Aurora Mesh Background)
           ==================================================================== */}
      <section id="hero" className="relative min-h-[100svh] flex items-center pt-28 pb-20 px-6 overflow-hidden bg-obsidian">
        {/* Background Glowing Aurora Lights */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0B0D14] via-[#08090D] to-[#0A0B12]" />
          <div
            className="absolute -top-[35%] -left-[15%] w-[130%] h-[130%] animate-sweep opacity-75"
            style={{
              background:
                "conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(168,100,255,0.25) 60deg, rgba(100,200,255,0.18) 120deg, transparent 200deg, rgba(168,100,255,0.14) 280deg, transparent 360deg)",
              filter: "blur(70px)"
            }}
          />
          <div
            className="absolute -bottom-[30%] -right-[20%] w-[120%] h-[120%] animate-sweep-2 opacity-70"
            style={{
              background:
                "conic-gradient(from 180deg at 50% 50%, transparent 0deg, rgba(80,220,255,0.28) 80deg, rgba(168,100,255,0.22) 140deg, transparent 220deg, rgba(200,230,255,0.10) 300deg, transparent 360deg)",
              filter: "blur(80px)"
            }}
          />
          <div
            className="absolute top-[10%] right-[10%] w-[600px] h-[600px] rounded-full animate-ambient"
            style={{
              background: "radial-gradient(circle, rgba(178,152,255,0.35) 0%, transparent 65%)",
              filter: "blur(80px)"
            }}
          />
          <div
            className="absolute bottom-[10%] left-[5%] w-[600px] h-[600px] rounded-full animate-ambient"
            style={{
              background: "radial-gradient(circle, rgba(109,213,250,0.32) 0%, transparent 65%)",
              filter: "blur(80px)",
              animationDelay: "-6s"
            }}
          />
          {/* Subtle noise texture */}
          <div
            className="absolute inset-0 opacity-[0.035] mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"
            }}
          />
        </div>

        {/* Hero Grid Container */}
        <div className="relative z-10 w-full max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-14 items-center">
          
          {/* Left Column: Headlines & High-Impact Copy */}
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left justify-center gap-6">
            {/* Eyebrow Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/25 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-aurora-cyan animate-ping" />
              <span className="eyebrow-accent">Built By Jewelers · For Luxury Retailers</span>
            </div>

            {/* Display Headline */}
            <h1 className="display text-4xl sm:text-5xl lg:text-[56px] xl:text-[62px] leading-[1.06] text-balance">
              The world&apos;s <span className="text-aurora-cyan underline decoration-purple-400 decoration-wavy decoration-1 underline-offset-4">first</span>
              <br />
              <em className="accent-italic">AI custom jewelry</em>
              <br />
              <span className="inline-flex items-baseline">
                <span>quotation studio</span>
                <span className="ml-1.5 inline-block w-[3px] h-[0.9em] bg-gradient-to-b from-purple-400 to-cyan-400 animate-blink rounded-sm" />
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-smoke text-lg sm:text-xl max-w-lg leading-relaxed font-normal">
              Instant 3D visuals. <span className="text-ice font-medium whitespace-nowrap">20x more leads.</span>{" "}
              <span className="text-ice font-medium whitespace-nowrap">Mathematically perfect quotes.</span>
              <br />
              <span className="text-aurora-violet font-semibold">In under 60 seconds. Effortlessly.</span>
            </p>

            {/* CTAs */}
            <div className="flex flex-row items-center gap-4 pt-2 flex-wrap justify-center lg:justify-start">
              <Link href="/signup" className="btn-aurora text-[15px] px-8 py-3.5">
                Start Free Trial
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Link>
              <a href="#design-studio" className="btn-ghost text-[15px] px-7 py-3.5">
                Try Live Demo ↓
              </a>
            </div>

            {/* Trust badge */}
            <div className="flex items-center gap-3 pt-4 text-xs font-medium text-smoke-2 border-t border-white/10 w-full justify-center lg:justify-start">
              <span className="flex items-center gap-1 text-emerald-400">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                14-Day Free Trial
              </span>
              <span>·</span>
              <span>No Credit Card Required</span>
              <span>·</span>
              <span>Live Metal Feeds</span>
            </div>
          </div>

          {/* Right Column: Hero Live Interactive Studio Card */}
          <div id="design-studio" className="w-full max-w-xl mx-auto lg:max-w-none">
            <div className="glass-panel-dark rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
              <div className="accent-line" />

              {/* Studio Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-aurora-violet font-bold">
                  <span className="w-2 h-2 rounded-full bg-gradient-to-r from-cyan-400 to-purple-400" />
                  Interactive Studio AI
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Engine
                </div>
              </div>

              <h2 className="display text-2xl sm:text-3xl text-ice mb-1.5">
                Describe <em className="accent-italic">any custom piece</em>
              </h2>
              <p className="text-smoke text-[13px] mb-4">
                Type what a customer envisions or select presets below:
              </p>

              {/* Interactive Prompt Box */}
              <div className="rounded-2xl p-3 text-left bg-black/40 border border-white/15 focus-within:border-purple-400 transition-colors">
                <textarea
                  rows={2}
                  value={userPrompt}
                  onChange={(e) => setUserPrompt(e.target.value)}
                  placeholder="e.g. 2.0ct oval diamond in 18k yellow gold with hidden halo and pavé band..."
                  className="w-full bg-transparent outline-none resize-none px-2 text-[14px] leading-relaxed text-ice placeholder:text-smoke-2 font-sans"
                />

                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono uppercase text-smoke-2">Preset:</span>
                    <select
                      value={activePreset}
                      onChange={(e) => handleSelectPreset(e.target.value as PresetKey)}
                      className="bg-white/5 border border-white/15 rounded-lg px-2 py-1 text-xs text-ice outline-none cursor-pointer hover:bg-white/10"
                    >
                      {(Object.keys(PRESETS) as PresetKey[]).map((k) => (
                        <option key={k} value={k} className="bg-neutral-900 text-ice">
                          {PRESETS[k].label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => triggerPriceUpdate(calculateLivePrice({ metal: demoMetal, centerShape: demoCenterShape, centerCarats: demoCenterCarats, sideShape: demoSideShape, sideCount: demoSideCount }))}
                    className="w-8 h-8 rounded-full flex items-center justify-center bg-gradient-to-r from-cyan-400 to-purple-400 text-neutral-950 font-bold shadow-lg shadow-purple-500/40 hover:scale-105 active:scale-95 transition-all"
                    title="Recalculate Estimate"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12 7-7 7 7" />
                      <path d="M12 19V5" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Jewelry Category Tiles */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">
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
                      className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                        isSelected
                          ? "bg-purple-500/20 border-purple-400 text-white shadow-md shadow-purple-500/25 scale-[1.03]"
                          : "bg-white/[0.04] border-white/10 text-smoke hover:bg-white/[0.08] hover:text-ice"
                      }`}
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span>{item.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Live Preview Card & Dynamic Specs */}
              <div className="mt-5 p-4 rounded-2xl bg-black/40 border border-white/10 grid sm:grid-cols-2 gap-4 items-center">
                {/* Left: Render Frame */}
                <div className="relative aspect-square sm:aspect-auto sm:h-44 rounded-xl overflow-hidden bg-neutral-900 border border-white/10 flex items-center justify-center group">
                  <img
                    src={PRESETS[activePreset]?.renderImage || "/images/catalog/oval_solitaire.jpg"}
                    alt={PRESETS[activePreset]?.label || "3D Render"}
                    className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[10px] font-mono uppercase text-aurora-cyan font-bold">
                    3D Render
                  </div>
                  {isGenerating && (
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-[11px] font-mono uppercase text-purple-300">Rendering geometry...</span>
                    </div>
                  )}
                </div>

                {/* Right: Specs & Live Quote Price */}
                <div className="flex flex-col justify-between gap-3 text-left">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-smoke-2 block mb-1">
                      Live Quote Estimate
                    </span>
                    <div className="font-display-luxury text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-purple-300 to-purple-400 leading-none">
                      ${currentPrice.toLocaleString()}
                    </div>
                    <span className="text-[11px] text-smoke-2 block mt-1">
                      Includes 18k alloy weight + diamond appraisal
                    </span>
                  </div>

                  {/* Micro Specs Adjusters */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-smoke bg-white/5 px-2 py-1 rounded-md">
                      <span>Metal:</span>
                      <select
                        value={demoMetal}
                        onChange={(e) => onSpecsChange({ metal: e.target.value })}
                        className="bg-transparent text-ice text-right font-medium outline-none cursor-pointer"
                      >
                        <option value="18k Yellow Gold" className="bg-neutral-900">18k Yellow Gold</option>
                        <option value="18k White Gold" className="bg-neutral-900">18k White Gold</option>
                        <option value="18k Rose Gold" className="bg-neutral-900">18k Rose Gold</option>
                        <option value="Platinum" className="bg-neutral-900">Platinum</option>
                        <option value="14k Yellow Gold" className="bg-neutral-900">14k Yellow Gold</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between text-smoke bg-white/5 px-2 py-1 rounded-md">
                      <span>Center Stone:</span>
                      <span className="font-medium text-ice">{demoCenterCarats}ct {demoCenterShape}</span>
                    </div>
                  </div>

                  <Link
                    href="/signup"
                    className="btn-aurora w-full py-2 text-xs font-bold text-center justify-center mt-1"
                  >
                    Save &amp; Generate Branded Quote →
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
      <section className="py-24 sm:py-32 px-6 bg-obsidian relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-purple-600/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-5xl mx-auto text-center">
          <div className="mb-10">
            <span className="eyebrow-accent">Hyper-Realistic Visual Engine</span>
            <h2 className="display text-3xl sm:text-5xl mt-3 mb-4">
              Ideas to photoreal 3D renders. <em className="accent-italic">Zero CAD wait time.</em>
            </h2>
            <p className="text-smoke max-w-2xl mx-auto text-base sm:text-lg">
              Deliver museum-grade, light-accurate 3D jewelry renderings before your competitor can even boot their CAD workstation.
            </p>
          </div>

          {/* 3D Tilted Card Preview */}
          <div
            className="mx-auto rounded-2xl p-2 sm:p-3 relative group transition-transform duration-500 hover:scale-[1.01]"
            style={{
              perspective: "1200px",
              background: "linear-gradient(135deg, rgba(212,184,122,0.4), rgba(178,152,255,0.4), rgba(109,213,250,0.3))",
              boxShadow: "0 30px 80px -20px rgba(178,152,255,0.35), 0 0 0 1px rgba(255,255,255,0.1) inset"
            }}
          >
            <div className="relative rounded-xl overflow-hidden bg-[#0A0B14] aspect-[16/9] flex items-center justify-center">
              <img
                src="/images/catalog/cushion_pave.jpg"
                alt="Photorealistic 3D jewelry render"
                className="w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-105"
              />
              
              {/* Overlay Glass Elements */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A0B14] via-transparent to-black/30" />
              
              <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between p-4 rounded-xl glass-panel-dark">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-400 flex items-center justify-center text-xl">
                    💍
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ice">2.0ct Cushion Pavé Engagement Ring</p>
                    <p className="text-xs text-smoke">Multi-pass AI raytraced specular reflection · 18k White Gold</p>
                  </div>
                </div>
                <div className="text-right hidden sm:block">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-400 font-bold block">
                    Render Time: 12.4s
                  </span>
                  <span className="font-display-luxury text-xl font-bold text-cyan-300">$2,840</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
           4. MARQUEE BRAND STRIP
           ==================================================================== */}
      <section className="py-14 px-6 border-y border-white/10 bg-[#06070A] overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <p className="text-center font-mono text-[11px] tracking-widest uppercase text-smoke-2 mb-8">
            Trusted by premier custom ateliers &amp; retail jewelers nationwide
          </p>

          <div className="relative overflow-hidden w-full">
            {/* Edge Gradients */}
            <div className="absolute inset-y-0 left-0 w-24 sm:w-40 z-10 pointer-events-none bg-gradient-to-r from-[#06070A] to-transparent" />
            <div className="absolute inset-y-0 right-0 w-24 sm:w-40 z-10 pointer-events-none bg-gradient-to-l from-[#06070A] to-transparent" />

            {/* Marquee Track */}
            <div className="marquee-track-left flex items-center gap-12 sm:gap-20 whitespace-nowrap" style={{ width: "max-content" }}>
              {[...BRAND_LOGOS, ...BRAND_LOGOS].map((brand, i) => (
                <span
                  key={i}
                  className="font-sans text-lg sm:text-2xl font-light tracking-tight text-smoke hover:text-ice transition-colors cursor-default select-none"
                >
                  {brand}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
           5. THE PROBLEM SECTION & ANIMATED LOST-SALE CHAT SIMULATOR
           ==================================================================== */}
      <section id="the-problem" className="py-28 sm:py-36 px-6 bg-[#090A10] border-b border-white/10 relative overflow-hidden">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-16 items-center">
          
          {/* Left Narrative */}
          <div className="text-left">
            <div className="eyebrow-accent mb-4">The Custom Order Dilemma</div>
            <h2 className="display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.04] mb-6">
              Stop doing free CAD work.
              <br />
              <span className="text-aurora-rose font-semibold">1 out of 10</span> custom orders die for one reason.
            </h2>

            <p className="font-display-luxury text-2xl sm:text-3xl text-ice leading-snug mb-6">
              If they can&apos;t see it instantly,{" "}
              <span className="underline decoration-aurora-violet decoration-2 underline-offset-8 text-aurora-violet">
                they will not buy it.
              </span>
            </p>

            <p className="text-smoke text-base sm:text-lg leading-relaxed mb-8 max-w-xl">
              Customers walk into your boutique or message your Instagram with a dream photo. When you make them wait 3 days for CAD sketches and quotes, enthusiasm evaporates and they buy elsewhere.
              <br /><br />
              <strong className="text-ice">Azzure AI Quote flips the script.</strong> Instant 3D renders and mathematically precise quotes on the spot lock in deposits while interest is at its absolute peak.
            </p>

            <div className="flex items-center gap-6">
              <Link href="/signup" className="btn-aurora text-sm px-7 py-3">
                Stop Losing Custom Sales →
              </Link>
              <button onClick={replayChat} className="btn-ghost text-xs px-4 py-3 text-smoke">
                ↻ Replay Simulation
              </button>
            </div>
          </div>

          {/* Right: Interactive Animated iMessage Chat Simulator */}
          <div className="w-full max-w-md mx-auto">
            <div className="rounded-3xl glass-panel-dark p-5 sm:p-6 shadow-2xl relative border border-white/15">
              
              {/* iPhone Header Bar */}
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs flex items-center justify-center">
                    JD
                  </div>
                  <div>
                    <p className="text-xs font-bold text-ice leading-tight">Jessica Davies</p>
                    <p className="text-[10px] text-smoke">Custom Solitaire Inquiry</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-red-500/10 text-red-400 border border-red-500/20 font-bold">
                  Ghosted Client
                </span>
              </div>

              {/* Chat Thread Simulator */}
              <div key={chatKey} className="space-y-3 min-h-[310px] text-left text-xs font-sans">
                {/* Message 1 */}
                <div className="flex justify-start">
                  <div className="bg-neutral-800 text-ice px-3.5 py-2.5 rounded-2xl rounded-bl-sm max-w-[82%] leading-relaxed">
                    Hi! I love this 2ct oval ring on Pinterest. Can you make this and how much would it be? 💍
                  </div>
                </div>

                {/* Message 2 */}
                <div className="flex justify-end">
                  <div className="bg-blue-600 text-white px-3.5 py-2.5 rounded-2xl rounded-br-sm max-w-[82%] leading-relaxed shadow-md shadow-blue-500/20">
                    Hi Jessica! Sure thing! Let me talk to my CAD designer. Give us 3–4 business days to sketch specs and quote.
                  </div>
                </div>

                {/* Message 3 */}
                <div className="flex justify-end">
                  <div className="bg-blue-600 text-white px-3.5 py-2 rounded-2xl rounded-br-sm max-w-[82%] leading-relaxed">
                    Does that work for you?
                  </div>
                </div>

                {/* Message 4 */}
                <div className="flex justify-end pt-1">
                  <div className="bg-blue-600 text-white px-3.5 py-2.5 rounded-2xl rounded-br-sm max-w-[82%] leading-relaxed opacity-80">
                    Hey Jessica, still interested? Just following up!
                    <span className="block text-[9px] text-blue-200 mt-1">Read · 4 days ago</span>
                  </div>
                </div>

                {/* Typing indicator ghost */}
                <div className="flex items-center gap-2 pt-2 text-smoke-2 italic text-[11px]">
                  <span>No response. Customer purchased from competitor with instant 3D visual.</span>
                </div>

                {/* Stamp of Lost Sale */}
                <div className="pt-4 flex justify-center">
                  <div className="px-6 py-2 rounded-lg border-2 border-red-500 bg-red-500/10 text-red-400 font-mono font-black text-sm tracking-widest uppercase rotate-[-2deg] shadow-lg shadow-red-500/20 animate-pulse">
                    $6,400 SALE LOST
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ====================================================================
           6. PRODUCT DEEP-DIVE: INTERACTIVE 3-STEP STUDIO GENERATOR
           ==================================================================== */}
      <section id="features" className="py-28 sm:py-36 px-6 bg-obsidian border-b border-white/10 relative overflow-hidden">
        <div className="max-w-6xl mx-auto text-center">
          
          <div className="mb-14">
            <span className="eyebrow-accent">Interactive Demonstration</span>
            <h2 className="display text-4xl sm:text-5xl mt-3 mb-4">
              Turn any inspiration into a <em className="accent-italic">closed sale</em>.
            </h2>
            <p className="text-smoke max-w-xl mx-auto text-base sm:text-lg">
              Test how quick and effortless your customer quoting experience will be:
            </p>
          </div>

          {/* Interactive 3-Step Container */}
          <div className="glass-panel-dark rounded-3xl p-6 sm:p-10 text-left border border-white/15 max-w-4xl mx-auto relative overflow-hidden shadow-2xl">
            <div className="accent-line" />

            {/* Stepper Progress Bar */}
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                    generatorStep >= 1 ? "bg-purple-500 text-white" : "bg-neutral-800 text-smoke"
                  }`}
                >
                  1
                </span>
                <span className="text-xs font-bold text-ice">Configure Design</span>
              </div>
              <div className="h-px bg-white/20 flex-1 mx-4" />
              <div className="flex items-center gap-3">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                    generatorStep >= 2 ? "bg-purple-500 text-white" : "bg-neutral-800 text-smoke"
                  }`}
                >
                  2
                </span>
                <span className="text-xs font-bold text-ice">AI 3D Synthesis</span>
              </div>
              <div className="h-px bg-white/20 flex-1 mx-4" />
              <div className="flex items-center gap-3">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold ${
                    generatorStep >= 3 ? "bg-purple-500 text-white" : "bg-neutral-800 text-smoke"
                  }`}
                >
                  3
                </span>
                <span className="text-xs font-bold text-ice">Deposit &amp; Order</span>
              </div>
            </div>

            {/* Step 1: Design Input */}
            {generatorStep === 1 && (
              <div className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-smoke-2 mb-2 font-bold">
                      Center Gemstone
                    </label>
                    <select
                      value={genGem}
                      onChange={(e) => setGenGem(e.target.value)}
                      className="w-full bg-black/50 border border-white/15 rounded-xl p-3 text-sm text-ice outline-none focus:border-purple-400"
                    >
                      <option value="Diamond">Natural Diamond (VS1 / F Color)</option>
                      <option value="Lab Diamond">Lab Grown Diamond (VVS / E Color)</option>
                      <option value="Sapphire">Ceylon Royal Blue Sapphire</option>
                      <option value="Emerald">Colombian Emerald</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-smoke-2 mb-2 font-bold">
                      Precious Metal
                    </label>
                    <select
                      value={genMetal}
                      onChange={(e) => setGenMetal(e.target.value)}
                      className="w-full bg-black/50 border border-white/15 rounded-xl p-3 text-sm text-ice outline-none focus:border-purple-400"
                    >
                      <option value="Platinum">Platinum 950 High-Polish</option>
                      <option value="18k Yellow Gold">18k Yellow Gold</option>
                      <option value="18k White Gold">18k White Gold</option>
                      <option value="18k Rose Gold">18k Rose Gold</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-smoke-2 mb-2 font-bold">
                    Vision Description &amp; Details
                  </label>
                  <textarea
                    rows={2}
                    value={genVision}
                    onChange={(e) => setGenVision(e.target.value)}
                    className="w-full bg-black/50 border border-white/15 rounded-xl p-3 text-sm text-ice outline-none focus:border-purple-400 resize-none font-sans"
                  />
                </div>

                <button
                  type="button"
                  onClick={runGeneratorFlow}
                  className="btn-aurora w-full py-3.5 font-bold text-sm justify-center"
                >
                  ⚡ Generate 3D Concept &amp; Live Quote
                </button>
              </div>
            )}

            {/* Step 2: AI Processing Simulation */}
            {generatorStep === 2 && (
              <div className="py-12 flex flex-col items-center text-center space-y-6">
                <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin shadow-lg shadow-purple-500/30" />
                <div>
                  <h3 className="text-xl font-bold text-ice mb-1">Synthesizing 3D Render &amp; Spot Prices</h3>
                  <p className="text-xs text-smoke">
                    Connecting to live bullion metal feeds &amp; calculating labor margins...
                  </p>
                </div>
                <div className="w-full max-w-md h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-purple-400 transition-all duration-200"
                    style={{ width: `${genProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Finished Render & Deposit */}
            {generatorStep === 3 && (
              <div className="grid sm:grid-cols-2 gap-8 items-center">
                <div className="rounded-2xl overflow-hidden aspect-square bg-neutral-900 border border-white/15 shadow-inner">
                  <img
                    src="/images/catalog/oval_solitaire.jpg"
                    alt="Rendered jewelry piece"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="space-y-4">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-bold uppercase">
                    ✓ Quote Ready · 30-Day Guarantee
                  </div>
                  
                  <h3 className="display text-2xl text-ice">
                    {genMetal} {genGem} Solitaire
                  </h3>

                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-1.5 text-xs text-smoke">
                    <div className="flex justify-between">
                      <span>Live Precious Metal (Pt 950):</span>
                      <strong className="text-ice">$1,280</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Diamond Weight (2.0ct F/VS1):</span>
                      <strong className="text-ice">$4,850</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Setting &amp; Finishing Labor:</span>
                      <strong className="text-ice">$670</strong>
                    </div>
                    <div className="border-t border-white/10 pt-2 flex justify-between text-sm font-bold text-ice">
                      <span>Approved Client Price:</span>
                      <span className="font-display-luxury text-xl text-cyan-300">$6,800</span>
                    </div>
                  </div>

                  {!genDepositPaid ? (
                    <button
                      type="button"
                      onClick={() => setGenDepositPaid(true)}
                      className="btn-aurora w-full py-3 text-sm font-bold justify-center"
                    >
                      💳 Capture $500 Deposit &amp; Send to Production
                    </button>
                  ) : (
                    <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-center font-bold text-xs">
                      ✓ $500 Deposit Captured! Order dispatched to Jeweler CRM.
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setGeneratorStep(1);
                      setGenDepositPaid(false);
                    }}
                    className="text-xs text-smoke hover:text-ice underline text-center block w-full"
                  >
                    ← Configure another custom piece
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-6 max-w-4xl mx-auto mt-12 pt-8 border-t border-white/10 text-center">
            <div>
              <div className="font-display-luxury text-3xl sm:text-5xl font-bold text-aurora-cyan">20x</div>
              <div className="text-xs sm:text-sm font-mono uppercase tracking-widest text-smoke mt-1">More Leads Captured</div>
            </div>
            <div>
              <div className="font-display-luxury text-3xl sm:text-5xl font-bold text-aurora-violet">60%</div>
              <div className="text-xs sm:text-sm font-mono uppercase tracking-widest text-smoke mt-1">Higher Conversion</div>
            </div>
            <div>
              <div className="font-display-luxury text-3xl sm:text-5xl font-bold text-aurora-gold">&lt;15s</div>
              <div className="text-xs sm:text-sm font-mono uppercase tracking-widest text-smoke mt-1">Idea to Approved Quote</div>
            </div>
          </div>

        </div>
      </section>

      {/* ====================================================================
           7. WORKFLOW: "LIVE IN 1 MINUTE. CLOSING IN SECONDS."
           ==================================================================== */}
      <section id="how-it-works" className="py-28 sm:py-36 px-6 bg-[#08090D] border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="eyebrow-accent">Effortless Integration</span>
            <h2 className="display text-4xl sm:text-6xl mt-3 mb-4">
              Live in 1 minute. <em className="accent-italic">Closing in seconds.</em>
            </h2>
            <p className="text-smoke max-w-xl mx-auto text-base sm:text-lg">
              No software developers required. Embeds on any site or showroom iPad with one line of code.
            </p>
          </div>

          {/* 4 Tabs Layout */}
          <div className="grid lg:grid-cols-[1fr_420px] gap-8 items-stretch">
            
            {/* Visual Display Left */}
            <div className="glass-panel-dark rounded-3xl p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden min-h-[380px]">
              <div className="accent-line" />

              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  <span className="font-mono text-xs uppercase tracking-widest text-ice font-bold">
                    Azzure Studio Engine · Step 0{workflowTab + 1}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 font-bold">
                  Active
                </span>
              </div>

              {/* Dynamic Step Previews */}
              <div className="my-auto py-6">
                {workflowTab === 0 && (
                  <div className="text-left space-y-4">
                    <h3 className="display text-2xl text-ice">Connect to Shopify, WooCommerce, Wix, or Custom Website</h3>
                    <p className="text-smoke text-sm leading-relaxed">
                      Embed our lightning-fast 3D quotation widget onto your website with a single copy-paste script tag. Integrates seamlessly with your existing luxury brand theme.
                    </p>
                    <div className="p-3 rounded-xl bg-black/60 font-mono text-xs text-cyan-300 border border-white/10">
                      &lt;script src=&quot;https://cdn.azzureaiquote.com/embed.js&quot; data-store=&quot;your-store&quot;&gt;&lt;/script&gt;
                    </div>
                  </div>
                )}

                {workflowTab === 1 && (
                  <div className="text-left space-y-4">
                    <h3 className="display text-2xl text-ice">Set Your Metal Formulas &amp; Retail Markups</h3>
                    <p className="text-smoke text-sm leading-relaxed">
                      Control your margins down to the dollar. Set custom multipliers on precious metal spot prices, diamond carat weight tiers, and labor setting costs.
                    </p>
                    <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                      <div className="p-3 bg-black/50 rounded-lg border border-white/10">
                        <span className="text-smoke block">Gold Spot Markup</span>
                        <strong className="text-emerald-400 text-base">+35% Retail</strong>
                      </div>
                      <div className="p-3 bg-black/50 rounded-lg border border-white/10">
                        <span className="text-smoke block">Deposit Requirement</span>
                        <strong className="text-purple-300 text-base">20% or $500 Min</strong>
                      </div>
                    </div>
                  </div>
                )}

                {workflowTab === 2 && (
                  <div className="text-left space-y-4">
                    <h3 className="display text-2xl text-ice">Shoppers Describe Dreams &amp; Get Photoreal Visuals</h3>
                    <p className="text-smoke text-sm leading-relaxed">
                      Clients upload photos from Instagram, Pinterest, or camera roll. Azzure generates hyper-realistic 3D images and quotes immediately.
                    </p>
                    <div className="flex items-center gap-3 p-3 bg-black/50 rounded-xl border border-white/10">
                      <span className="text-2xl">📸</span>
                      <span className="text-xs text-smoke">
                        Photo merged with live pricing matrix in &lt; 15 seconds.
                      </span>
                    </div>
                  </div>
                )}

                {workflowTab === 3 && (
                  <div className="text-left space-y-4">
                    <h3 className="display text-2xl text-ice">Automated Lead Capture &amp; Direct Manufacturing Queue</h3>
                    <p className="text-smoke text-sm leading-relaxed">
                      Customer deposits are securely processed before they leave your site. Quote specs automatically export to PDF and push directly to CAD/CAM casting.
                    </p>
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 font-bold">
                      ✓ Instant Stripe checkout deposit + PDF quote reference link generated.
                    </div>
                  </div>
                )}
              </div>

              {/* Progress Indicator */}
              <div className="flex items-center gap-2 pt-4 border-t border-white/10">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    onClick={() => setWorkflowTab(idx)}
                    className={`h-1.5 rounded-full flex-1 cursor-pointer transition-all ${
                      workflowTab === idx ? "bg-gradient-to-r from-cyan-400 to-purple-400" : "bg-white/10"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Selector Buttons Right */}
            <div className="flex flex-col gap-3">
              {[
                {
                  step: "01",
                  title: "Connect to your website",
                  desc: "One snippet, one minute, any platform."
                },
                {
                  step: "02",
                  title: "Set up pricing & formulas",
                  desc: "Match your colors, logo, markups, and catalog."
                },
                {
                  step: "03",
                  title: "Customers design live",
                  desc: "AI visual builder with instant 3D renders."
                },
                {
                  step: "04",
                  title: "Lead capture & deposit secured",
                  desc: "Hot buyers land in your CRM with deposits attached."
                }
              ].map((item, idx) => {
                const isActive = workflowTab === idx;
                return (
                  <button
                    key={item.step}
                    type="button"
                    onClick={() => setWorkflowTab(idx)}
                    className={`text-left p-5 rounded-2xl border transition-all flex items-start gap-4 ${
                      isActive
                        ? "bg-purple-500/10 border-purple-400 text-white shadow-lg shadow-purple-500/15"
                        : "bg-white/[0.03] border-white/10 text-smoke hover:bg-white/[0.06] hover:text-ice"
                    }`}
                  >
                    <span
                      className={`font-mono text-sm font-bold pt-0.5 ${
                        isActive ? "text-purple-400" : "text-smoke-2"
                      }`}
                    >
                      {item.step}
                    </span>
                    <div>
                      <h4 className="font-bold text-sm text-ice mb-1">{item.title}</h4>
                      <p className="text-xs text-smoke">{item.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

          </div>
        </div>
      </section>

      {/* ====================================================================
           8. JEWELER DASHBOARD SPOTLIGHT ("Zero Guesswork. Total Visibility.")
           ==================================================================== */}
      <section id="dashboard" className="py-28 sm:py-36 px-6 bg-obsidian border-b border-white/10">
        <div className="max-w-6xl mx-auto">
          
          <div className="text-left mb-12 max-w-2xl">
            <span className="eyebrow-accent">Jeweler Back-Office Portal</span>
            <h2 className="display text-4xl sm:text-5xl mt-3 mb-4">
              Zero guesswork.<br />
              <em className="accent-italic">Total pipeline visibility.</em>
            </h2>
            <p className="text-smoke text-base sm:text-lg">
              Every lead, custom design, metal spot rate, and deposit tracked in real time. One unified dashboard for your sales staff and bench jewelers.
            </p>
          </div>

          {/* Dashboard Glass Mockup */}
          <div className="glass-panel-dark rounded-3xl p-6 sm:p-8 border border-white/15 shadow-2xl relative overflow-hidden">
            <div className="accent-line" />

            {/* Top Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 text-left">
              
              <div className="p-5 rounded-2xl bg-black/40 border border-white/10">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[11px] font-mono uppercase text-smoke font-bold">Designs Generated</span>
                  <span className="text-xs text-emerald-400 font-mono font-bold">+24%</span>
                </div>
                <div className="font-display-luxury text-3xl sm:text-4xl font-bold text-ice">245</div>
                <span className="text-[11px] text-smoke-2 mt-1 block">This month across all devices</span>
              </div>

              <div className="p-5 rounded-2xl bg-black/40 border border-white/10">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[11px] font-mono uppercase text-smoke font-bold">Qualified Leads</span>
                  <span className="text-xs text-emerald-400 font-mono font-bold">+18%</span>
                </div>
                <div className="font-display-luxury text-3xl sm:text-4xl font-bold text-cyan-300">84</div>
                <span className="text-[11px] text-smoke-2 mt-1 block">With customer inspiration photos</span>
              </div>

              <div className="p-5 rounded-2xl bg-black/40 border border-white/10">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[11px] font-mono uppercase text-smoke font-bold">Deposits Secured</span>
                  <span className="text-xs text-emerald-400 font-mono font-bold">+31%</span>
                </div>
                <div className="font-display-luxury text-3xl sm:text-4xl font-bold text-purple-300">$34,800</div>
                <span className="text-[11px] text-smoke-2 mt-1 block">Collected directly before CAD</span>
              </div>

            </div>

            {/* Recent Live Activity Stream */}
            <div className="text-left">
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs uppercase tracking-widest text-smoke font-bold">
                  Recent Quotation Activity
                </span>
                <span className="text-xs text-purple-400 font-medium">Real-Time Sync</span>
              </div>

              <div className="space-y-2.5">
                {[
                  {
                    client: "Sarah M.",
                    item: "1.8ct Pear Halo Engagement Ring",
                    amount: "$4,500",
                    status: "Deposit Secured",
                    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                  },
                  {
                    client: "Marcus T.",
                    item: "Platinum 3-Stone Emerald Diamond Band",
                    amount: "$8,450",
                    status: "Quote Sent",
                    color: "text-cyan-300 bg-cyan-500/10 border-cyan-500/30"
                  },
                  {
                    client: "Jenna L.",
                    item: "14k Gold Custom Monogram Iced Pendant",
                    amount: "$3,200",
                    status: "In Production",
                    color: "text-purple-300 bg-purple-500/10 border-purple-500/30"
                  }
                ].map((row, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl bg-black/30 border border-white/10 flex items-center justify-between gap-4 flex-wrap"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-purple-500/20 text-purple-300 font-bold text-xs flex items-center justify-center">
                        {row.client.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <strong className="text-sm text-ice block">{row.client}</strong>
                        <span className="text-xs text-smoke">{row.item}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="font-display-luxury text-base font-bold text-ice">{row.amount}</span>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono uppercase font-bold border ${row.color}`}>
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
           9. SHOWROOM KIOSK MODE (Ultra In-Store iPad WOW Feature)
           ==================================================================== */}
      <section id="showroom" className="py-28 sm:py-36 px-6 bg-[#06070A] border-b border-white/10 relative overflow-hidden">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
          
          <div className="text-left">
            <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-[11px] uppercase font-bold tracking-widest inline-block mb-4">
              ★ Enterprise Flagship Studio
            </span>
            <h2 className="display text-4xl sm:text-5xl font-bold mb-6 leading-tight">
              Turn your showroom floor into a <em className="accent-italic-gold">self-service quote studio</em>.
            </h2>
            <p className="text-smoke text-base sm:text-lg leading-relaxed mb-8">
              Place an iPad or touchscreen kiosk in your store. Walk-in shoppers upload inspiration images, adjust diamond specs, and receive an instant private quote code (<strong className="text-ice">QT-4821</strong>).
              <br /><br />
              Your sales reps pull up the exact specifications in the jeweler portal, confirm metal weight, and dispatch to manufacturing instantly.
            </p>
            <button onClick={openKioskModal} className="btn-aurora text-sm px-8 py-3.5">
              Launch Showroom Kiosk Simulation →
            </button>
          </div>

          {/* Showroom Kiosk Preview Card */}
          <div className="w-full max-w-md mx-auto">
            <div className="glass-panel-dark rounded-3xl p-6 border border-amber-500/30 shadow-2xl relative text-center">
              <p className="font-display-luxury text-2xl font-bold text-amber-300 mb-1">Crown Jewellers</p>
              <p className="text-xs font-mono uppercase text-smoke tracking-widest mb-6">In-Store Interactive Kiosk</p>
              
              <div className="p-6 rounded-2xl bg-black/60 border border-white/10 mb-4">
                <div className="w-20 h-20 mx-auto mb-3 rounded-xl overflow-hidden bg-neutral-900">
                  <img src="/images/catalog/oval_solitaire.jpg" alt="Showroom ring" className="w-full h-full object-cover" />
                </div>
                <span className="text-xs text-smoke block">Private Quote Reference</span>
                <span className="font-mono text-2xl font-bold text-amber-400 tracking-widest block my-1">QT-4821</span>
                <span className="font-display-luxury text-3xl font-bold text-ice">$2,380</span>
              </div>

              <span className="text-xs text-smoke-2">
                Customer takes photo of code · Sales rep looks up in dashboard
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* ====================================================================
           10. PRICING SECTION (Built for Scale)
           ==================================================================== */}
      <section id="pricing" className="py-28 sm:py-36 px-6 bg-obsidian border-b border-white/10 relative overflow-hidden">
        <div className="max-w-6xl mx-auto text-center">
          
          <div className="mb-12">
            <span className="eyebrow-accent">Transparent Pricing</span>
            <h2 className="display text-4xl sm:text-6xl mt-3 mb-4">
              Simple pricing. <em className="accent-italic">Built for Scale.</em>
            </h2>
            <p className="text-smoke max-w-lg mx-auto text-base sm:text-lg">
              14-day free trial on all plans. No setup fee. Cancel anytime.
            </p>
          </div>

          {/* Monthly / Annual Toggle Switch */}
          <div className="flex justify-center mb-12">
            <div className="inline-flex items-center p-1.5 rounded-full bg-neutral-900 border border-white/15 shadow-inner">
              <button
                type="button"
                onClick={() => setIsAnnual(false)}
                className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${
                  !isAnnual ? "bg-gradient-to-r from-cyan-400 to-purple-400 text-neutral-950 shadow-md" : "text-smoke hover:text-ice"
                }`}
              >
                Monthly Billing
              </button>
              <button
                type="button"
                onClick={() => setIsAnnual(true)}
                className={`px-6 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  isAnnual ? "bg-gradient-to-r from-cyan-400 to-purple-400 text-neutral-950 shadow-md" : "text-smoke hover:text-ice"
                }`}
              >
                Annual Billing
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-400 text-neutral-950 text-[10px] font-black">
                  Save 20%
                </span>
              </button>
            </div>
          </div>

          {/* 3 Luxury Pricing Cards */}
          <div className="grid md:grid-cols-3 gap-6 text-left items-stretch">
            
            {/* Starter Plan */}
            <div className="glass-panel-dark rounded-3xl p-7 flex flex-col justify-between border border-white/10 hover:border-white/25 transition-all">
              <div>
                <div className="mb-6">
                  <h3 className="font-display-luxury text-2xl font-bold text-ice mb-1">Starter</h3>
                  <p className="text-xs text-smoke mb-4">For solo jewelers &amp; boutique ateliers</p>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display-luxury text-4xl sm:text-5xl font-bold text-ice">
                      ${isAnnual ? 79 : 99}
                    </span>
                    <span className="text-xs text-smoke">/ month</span>
                  </div>
                </div>

                <ul className="space-y-3 text-xs text-smoke pt-4 border-t border-white/10">
                  <li className="flex items-center gap-2 text-ice">✓ <strong>300 quotes / month</strong></li>
                  <li className="flex items-center gap-2">✓ Full 3-pass AI + manual override</li>
                  <li className="flex items-center gap-2">✓ Branded PDFs (Logo + brand name)</li>
                  <li className="flex items-center gap-2">✓ Complete quote history &amp; CRM</li>
                  <li className="flex items-center gap-2">✓ Up to 3 staff seats</li>
                  <li className="flex items-center gap-2">✓ Live precious metal spot rates</li>
                </ul>

                {expandedCards["starter"] && (
                  <ul className="space-y-3 text-xs text-smoke pt-3 mt-3 border-t border-white/10 animate-rise">
                    <li>✓ Standard email &amp; chat support</li>
                    <li>✓ Alloy weight density conversions</li>
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => toggleExpand("starter")}
                  className="text-[11px] text-aurora-violet mt-3 font-semibold hover:underline block"
                >
                  {expandedCards["starter"] ? "Hide features ↑" : "View all features ↓"}
                </button>
              </div>

              <Link href="/signup?plan=starter" className="btn-ghost w-full py-3 text-xs font-bold text-center justify-center mt-8">
                Start 14-Day Free Trial
              </Link>
            </div>

            {/* Professional Plan (Most Popular with Aurora Glow) */}
            <div className="glass-panel-dark rounded-3xl p-7 flex flex-col justify-between border-2 border-purple-400 relative shadow-2xl shadow-purple-500/20 scale-[1.02]">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-cyan-400 to-purple-400 text-neutral-950 font-bold font-mono text-[10px] uppercase tracking-wider whitespace-nowrap shadow-md">
                ★ Most Popular · 14-Day Trial
              </div>

              <div>
                <div className="mb-6">
                  <h3 className="font-display-luxury text-2xl font-bold text-ice mb-1">Professional</h3>
                  <p className="text-xs text-smoke mb-4">For growing jewelry stores quoting daily</p>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display-luxury text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-purple-300 to-purple-400">
                      ${isAnnual ? 159 : 199}
                    </span>
                    <span className="text-xs text-smoke">/ month</span>
                  </div>
                </div>

                <ul className="space-y-3 text-xs text-smoke pt-4 border-t border-white/10">
                  <li className="flex items-center gap-2 text-ice">✓ <strong>1,200 quotes / month</strong></li>
                  <li className="flex items-center gap-2 text-ice">✓ Everything in Starter</li>
                  <li className="flex items-center gap-2">✓ Unlimited staff seats + role access</li>
                  <li className="flex items-center gap-2">✓ Shareable branded quote links</li>
                  <li className="flex items-center gap-2">✓ Custom pricing markups &amp; formulas</li>
                  <li className="flex items-center gap-2">✓ Embed on unlimited website domains</li>
                </ul>

                {expandedCards["pro"] && (
                  <ul className="space-y-3 text-xs text-smoke pt-3 mt-3 border-t border-white/10 animate-rise">
                    <li>✓ Priority 24/7 support response</li>
                    <li>✓ Multi-photo merge analysis</li>
                    <li>✓ Direct Zapier &amp; webhook integrations</li>
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => toggleExpand("pro")}
                  className="text-[11px] text-aurora-violet mt-3 font-semibold hover:underline block"
                >
                  {expandedCards["pro"] ? "Hide features ↑" : "View all features ↓"}
                </button>
              </div>

              <Link href="/signup?plan=professional" className="btn-aurora w-full py-3.5 text-xs font-bold text-center justify-center mt-8">
                Start 14-Day Free Trial
              </Link>
            </div>

            {/* Enterprise Plan (Showroom Kiosk + 3D Renders) */}
            <div className="glass-panel-dark rounded-3xl p-7 flex flex-col justify-between border border-amber-500/40 hover:border-amber-400 transition-all">
              <div>
                <div className="mb-6">
                  <h3 className="font-display-luxury text-2xl font-bold text-amber-300 mb-1">Enterprise</h3>
                  <p className="text-xs text-smoke mb-4">Showrooms, tablet kiosks &amp; high volume</p>
                  <div className="flex items-baseline gap-1">
                    <span className="font-display-luxury text-4xl sm:text-5xl font-bold text-amber-300">
                      ${isAnnual ? 239 : 299}
                    </span>
                    <span className="text-xs text-smoke">/ month</span>
                  </div>
                </div>

                <ul className="space-y-3 text-xs text-smoke pt-4 border-t border-white/10">
                  <li className="flex items-center gap-2 text-ice">✓ <strong>2,500 quotes / month</strong></li>
                  <li className="flex items-center gap-2 text-ice">✓ Everything in Professional</li>
                  <li className="flex items-center gap-2 text-amber-300 font-bold">★ Photorealistic 3D Concept Renders</li>
                  <li className="flex items-center gap-2 text-amber-300 font-bold">★ In-Store Tablet (Kiosk Mode)</li>
                  <li className="flex items-center gap-2">✓ Full Auto-Push to Custom King / CAD</li>
                  <li className="flex items-center gap-2">✓ Dedicated account manager &amp; VIP queue</li>
                </ul>

                {expandedCards["ent"] && (
                  <ul className="space-y-3 text-xs text-smoke pt-3 mt-3 border-t border-white/10 animate-rise">
                    <li>✓ Custom showroom branding &amp; logo lockup</li>
                    <li>✓ SLA &amp; 1-on-1 staff onboarding session</li>
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => toggleExpand("ent")}
                  className="text-[11px] text-amber-300 mt-3 font-semibold hover:underline block"
                >
                  {expandedCards["ent"] ? "Hide features ↑" : "View all features ↓"}
                </button>
              </div>

              <Link
                href="/signup?plan=enterprise"
                className="btn-ghost w-full py-3 text-xs font-bold text-center justify-center mt-8 border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
              >
                Start Enterprise Trial
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* ====================================================================
           11. FREQUENTLY ASKED QUESTIONS (Accordion)
           ==================================================================== */}
      <section id="faq" className="py-28 sm:py-36 px-6 bg-obsidian border-b border-white/10">
        <div className="max-w-3xl mx-auto text-left">
          
          <div className="mb-14 text-center">
            <span className="eyebrow-accent">FAQ</span>
            <h2 className="display text-4xl sm:text-5xl mt-3 mb-4">
              Got a <em className="accent-italic">question?</em>
            </h2>
            <p className="text-smoke text-sm sm:text-base">Everything you need to know about Azzure AI Quote.</p>
          </div>

          <div className="space-y-3">
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
                <div
                  key={idx}
                  className="rounded-2xl glass-panel-dark border border-white/10 transition-all overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left gap-4 hover:text-white"
                  >
                    <span className="text-sm sm:text-base font-semibold text-ice">{item.q}</span>
                    <span className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center shrink-0 text-sm text-purple-300">
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-5 pt-1 text-xs sm:text-sm text-smoke leading-relaxed border-t border-white/10 animate-rise">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* ====================================================================
           12. FINAL AURORA CALL TO ACTION
           ==================================================================== */}
      <section className="py-32 sm:py-44 px-6 bg-obsidian relative overflow-hidden text-center">
        {/* Background Beams */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-[40%] left-[10%] w-[80%] h-[120%] bg-gradient-to-b from-purple-600/20 via-cyan-500/15 to-transparent blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
          <span className="eyebrow-accent">Get Started Today</span>
          
          <h2 className="display text-4xl sm:text-6xl font-bold mt-4 mb-6 leading-tight">
            Your next customer is already<br />
            looking for this <span className="aurora-text">ring</span>.
          </h2>

          <p className="text-smoke text-base sm:text-lg mb-8 max-w-lg mx-auto">
            Stop losing custom orders to slow sketches. Deliver instant 3D quotes that turn casual browsers into paying clients.
          </p>

          <Link href="/signup" className="btn-aurora text-base px-10 py-4 shadow-xl">
            Start 14-Day Free Trial →
          </Link>

          <div className="flex items-center justify-center gap-6 mt-8 text-xs font-medium text-smoke-2">
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
      <footer className="border-t border-white/10 py-12 px-6 bg-[#050608] text-xs text-smoke-2">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center text-xs text-neutral-950 font-bold">
              A
            </div>
            <span className="font-display-luxury text-sm font-bold text-ice">Azzure AI Quote</span>
            <span>· Built by azzuresolutions.com</span>
          </div>

          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-ice transition-colors">Features</a>
            <a href="#pricing" className="hover:text-ice transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-ice transition-colors">FAQ</a>
            <Link href="/signin" className="text-aurora-violet font-semibold hover:underline">
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <div className="glass-panel-dark rounded-3xl p-6 sm:p-8 max-w-lg w-full text-center relative border border-white/20 shadow-2xl">
            <button
              onClick={() => setKioskOpen(false)}
              className="absolute top-4 right-4 text-smoke hover:text-white p-2 text-xl"
            >
              ✕
            </button>

            {/* Kiosk Slide 1 */}
            {kioskSlide === 1 && (
              <div className="space-y-6 py-4">
                <span className="font-display-luxury text-xl font-bold text-amber-300 block">Crown Jewellers</span>
                <h3 className="display text-2xl text-ice">Design Your Dream Piece</h3>
                <p className="text-xs text-smoke leading-relaxed max-w-sm mx-auto">
                  Showroom floor touchscreen mode: customer taps to upload their inspiration photo and receive instant quote specs.
                </p>
                <button onClick={startKioskUpload} className="btn-aurora text-xs px-8 py-3">
                  Start Kiosk Simulation →
                </button>
              </div>
            )}

            {/* Kiosk Slide 2 */}
            {kioskSlide === 2 && (
              <div className="space-y-6 py-4">
                <span className="font-display-luxury text-xl font-bold text-amber-300 block">Crown Jewellers</span>
                <h3 className="text-lg font-bold text-ice">Customer Inspiration Upload</h3>
                <div className="p-8 border-2 border-dashed border-purple-400/50 bg-purple-500/10 rounded-2xl">
                  {kioskUploadLoaded ? (
                    <p className="text-xs text-emerald-400 font-bold">✓ client_ring_photo.jpg (Uploaded)</p>
                  ) : (
                    <p className="text-xs text-smoke">Simulating customer photo tap...</p>
                  )}
                </div>
                <button
                  onClick={runKioskAnalysis}
                  disabled={!kioskUploadLoaded}
                  className="btn-aurora text-xs px-8 py-3 disabled:opacity-50"
                >
                  Analyze &amp; Generate Quote →
                </button>
              </div>
            )}

            {/* Kiosk Slide 3 */}
            {kioskSlide === 3 && (
              <div className="space-y-6 py-4">
                <span className="font-display-luxury text-xl font-bold text-amber-300 block">Crown Jewellers</span>
                <h3 className="text-lg font-bold text-ice">Multi-Pass Geometry Analysis</h3>
                <div className="p-4 bg-black/40 rounded-xl space-y-2 text-left font-mono text-xs text-smoke">
                  <div>{kioskLine1}</div>
                  <div>{kioskLine2}</div>
                  <div>{kioskLine3}</div>
                </div>
              </div>
            )}

            {/* Kiosk Slide 4 */}
            {kioskSlide === 4 && (
              <div className="space-y-5 py-2">
                <span className="font-display-luxury text-xl font-bold text-amber-300 block">Crown Jewellers</span>
                <div className="p-4 bg-black/50 rounded-2xl border border-white/10 text-center">
                  <span className="text-[10px] font-mono uppercase text-smoke">Quote Reference Code</span>
                  <span className="font-mono text-3xl font-bold text-amber-400 tracking-widest block my-1">QT-4821</span>
                  <span className="font-display-luxury text-3xl font-bold text-ice">$2,380</span>
                </div>
                <p className="text-xs text-smoke">
                  Customer tells this code to sales rep or takes a photo.
                </p>
                <button onClick={() => setKioskSlide(5)} className="btn-aurora text-xs px-8 py-3 w-full justify-center">
                  Open Jeweler Counter Lookup View →
                </button>
              </div>
            )}

            {/* Kiosk Slide 5 */}
            {kioskSlide === 5 && (
              <div className="space-y-4 text-left py-2">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs text-purple-400 font-bold uppercase">Jeweler Sales Portal</span>
                  <span className="text-xs text-emerald-400">● Live Connection</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value="QT-4821"
                    readOnly
                    className="bg-black/50 border border-white/15 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-400 flex-1 outline-none"
                  />
                  <button
                    onClick={() => setJewelerResultShow(true)}
                    className="btn-aurora text-xs px-4 py-2 font-bold"
                  >
                    Fetch Specs
                  </button>
                </div>

                {jewelerResultShow && (
                  <div className="p-4 bg-black/60 rounded-xl border border-purple-500/30 text-xs space-y-1.5 animate-rise">
                    <strong className="text-ice block">18k Yellow Gold · 1.5ct Oval VS1</strong>
                    <p className="text-smoke">Instant margin calculated at +40% retail markup ($2,380 approved price).</p>
                    <button
                      onClick={() => {
                        alert("Quote sent directly to CAD casting queue!");
                        setKioskOpen(false);
                      }}
                      className="btn-aurora w-full py-2 text-xs font-bold justify-center mt-2"
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
