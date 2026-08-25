"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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
  displayCode: string;
  status: string;
  createdAt: string;
  customerNotes: string | null;
  estimatedPrice: number;
  metalType: string;
  jewelryType: string;
  renderingImageUrl: string | null;
  specs: {
    metalType: string;
    metalWeightGrams: number | null;
    centerCarats: number | null;
    centerShape: string | null;
    sideCarats: number | null;
    sideDiamondQuantity: number | null;
    settingType: string | null;
    hasWeddingBand: boolean;
    isTwoTone: boolean;
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

type KioskStaffViewProps = {
  staffName: string;
  sessionToken: string;
  brandColor?: string;
  onExit: () => void;
};

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
    fetchRecentQuotes();
  }, [fetchRecentQuotes]);

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
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Quote not found.");
    } finally {
      setSearching(false);
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
        fontFamily: "system-ui, -apple-system, sans-serif",
        overflowY: "auto",
        userSelect: "none"
      }}
    >
      {/* Top Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 32px",
          background: "rgba(255, 255, 255, 0.03)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          position: "sticky",
          top: 0,
          zIndex: 10,
          backdropFilter: "blur(12px)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: brandColor
            }}
          />
          <span style={{ fontSize: "1.15rem", fontWeight: 700, color: "#ffffff" }}>
            Welcome, {staffName}
          </span>
          <span
            style={{
              fontSize: "0.75rem",
              background: "rgba(201, 168, 76, 0.15)",
              color: brandColor,
              padding: "4px 10px",
              borderRadius: 999,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}
          >
            Staff View
          </span>
        </div>

        <button
          type="button"
          onClick={exitSession}
          style={{
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            color: "#e2e8f0",
            fontSize: "0.95rem",
            fontWeight: 600,
            padding: "10px 22px",
            borderRadius: 12,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8
          }}
        >
          Exit staff mode
        </button>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, maxWidth: 900, width: "100%", margin: "0 auto", padding: "32px 24px" }}>
        {selectedQuote ? (
          /* ── Quote Detail View ── */
          <div
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: 24,
              padding: "32px",
              boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
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
                  fontWeight: 600
                }}
              >
                ← Back to quote list
              </button>
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
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 28 }}>
              {/* Photo / Render */}
              <div>
                {selectedQuote.renderingImageUrl ? (
                  <img
                    src={selectedQuote.renderingImageUrl}
                    alt="Jewelry Design"
                    style={{ width: "100%", maxHeight: 340, objectFit: "contain", borderRadius: 16, background: "#000" }}
                  />
                ) : (
                  <div
                    style={{
                      height: 240,
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px dashed rgba(255, 255, 255, 0.1)",
                      borderRadius: 16,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#64748b"
                    }}
                  >
                    No render available
                  </div>
                )}
              </div>

              {/* Specs Breakdown */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <span style={{ fontSize: "0.8125rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>
                    Estimated Selling Price
                  </span>
                  <div style={{ fontSize: "2.25rem", fontWeight: 700, color: "#ffffff", marginTop: 4 }}>
                    {formatPrice(selectedQuote.estimatedPrice)}
                  </div>
                </div>

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
                </div>

                <p className="muted small" style={{ margin: 0, color: "#64748b" }}>
                  Generated {formatRelativeTime(selectedQuote.createdAt)} · Status: {selectedQuote.status}
                </p>
              </div>
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
