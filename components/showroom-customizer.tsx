"use client";

import { useState } from "react";
import { useToast } from "@/components/toast-provider";

interface ShowroomCustomizerProps {
  initialPrimaryColor: string | null;
  initialAboutUs: string | null;
  companyName: string;
  logoUrl: string | null;
}

const LUXURY_PALETTES = [
  {
    name: "Imperial Obsidian & Gold",
    primaryColor: "#c9a84c",
    bgPreview: "#0a0b0e",
    accentPreview: "#e6cb78",
    description: "Deep obsidian backdrop with rich 18K gold luster"
  },
  {
    name: "Royal Sapphire & Ice",
    primaryColor: "#0284c7",
    bgPreview: "#060b14",
    accentPreview: "#38bdf8",
    description: "Midnight sapphire with ice platinum highlights"
  },
  {
    name: "Emerald Atelier & Mint",
    primaryColor: "#10b981",
    bgPreview: "#06120e",
    accentPreview: "#34d399",
    description: "Velvet forest green with radiant emerald luster"
  },
  {
    name: "Burgundy Velvet & Rose",
    primaryColor: "#e11d48",
    bgPreview: "#12070c",
    accentPreview: "#fda4af",
    description: "Haute burgundy with warm rose gold radiance"
  },
  {
    name: "Haute Champagne & Bronze",
    primaryColor: "#9a6b38",
    bgPreview: "#fcfaf7",
    accentPreview: "#b48a56",
    description: "Warm ivory silk with brushed artisan bronze"
  }
];

export default function ShowroomCustomizer({
  initialPrimaryColor,
  initialAboutUs,
  companyName,
  logoUrl
}: ShowroomCustomizerProps) {
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor || "#c9a84c");
  const [aboutUs, setAboutUs] = useState(initialAboutUs || "");
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      const response = await fetch("/api/settings/showroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ primaryColor, aboutUs })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update showroom customization.");
      }

      showToast({
        message: "Showroom luxury theme & branding saved successfully!",
        variant: "success",
        autoDismiss: true
      });
    } catch (err) {
      showToast({
        message: err instanceof Error ? err.message : "Error saving showroom settings.",
        variant: "error",
        autoDismiss: false
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack" style={{ gap: "var(--space-6)" }}>
      <section className="card">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow" style={{ color: "var(--color-primary)" }}>✦ Luxury Kiosk Customization</span>
            <h2>Showroom Theme &amp; Color Palette</h2>
            <p className="muted">
              Customize the look, button colors, and greeting experience your walk-in clients see on the showroom tablet kiosk.
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="stack" style={{ gap: "var(--space-5)" }}>
          {/* ── 1. Curated Luxury Palettes ── */}
          <div>
            <label style={{ fontWeight: 600, display: "block", marginBottom: 8 }}>
              Curated Luxury Themes:
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              {LUXURY_PALETTES.map((palette) => (
                <button
                  key={palette.name}
                  type="button"
                  onClick={() => setPrimaryColor(palette.primaryColor)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 6,
                    padding: 14,
                    borderRadius: 12,
                    border: primaryColor === palette.primaryColor ? `2px solid ${palette.primaryColor}` : "1px solid var(--color-outline-variant)",
                    background: primaryColor === palette.primaryColor ? "rgba(201, 168, 76, 0.08)" : "var(--color-surface)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 150ms ease"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: palette.primaryColor, boxShadow: `0 0 10px ${palette.primaryColor}80` }} />
                    <strong style={{ fontSize: "0.9rem", color: "var(--color-on-surface)" }}>{palette.name}</strong>
                  </div>
                  <span className="muted small" style={{ fontSize: "0.75rem", lineHeight: 1.3 }}>
                    {palette.description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── 2. Custom Color Picker ── */}
          <div className="field">
            <label htmlFor="customPrimaryColor" style={{ fontWeight: 600 }}>
              Primary Button &amp; Accent Color:
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <input
                id="customPrimaryColor"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                style={{ width: 64, height: 44, borderRadius: 8, cursor: "pointer", border: "1px solid var(--color-outline-variant)", padding: 2 }}
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#c9a84c"
                style={{ width: 140, fontWeight: 700, textTransform: "uppercase" }}
              />
              <span className="muted small">Live preview applied below</span>
            </div>
          </div>

          {/* ── 3. Custom Tagline / Greeting ── */}
          <div className="field">
            <label htmlFor="showroomAboutUs" style={{ fontWeight: 600 }}>
              Showroom Welcome Tagline (Optional):
            </label>
            <textarea
              id="showroomAboutUs"
              rows={2}
              maxLength={300}
              value={aboutUs}
              onChange={(e) => setAboutUs(e.target.value)}
              placeholder="e.g. Bespoke bridal and artisan custom jewelry studio. Experience 3D custom quoting in 30 seconds."
            />
            <span className="muted small">{aboutUs.length} / 300 characters</span>
          </div>

          {/* ── 4. Live Tablet Kiosk Mockup Preview ── */}
          <div>
            <span className="eyebrow" style={{ color: primaryColor, marginBottom: 8, display: "block" }}>
              Live Kiosk Mockup Preview
            </span>
            <div
              style={{
                borderRadius: 16,
                background: "#0a0b0e",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                padding: 24,
                color: "#ffffff",
                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
                maxWidth: 640
              }}
            >
              {/* Header Preview */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: 12, marginBottom: 16 }}>
                <div>
                  {logoUrl ? (
                    <img src={logoUrl} alt={companyName} style={{ maxHeight: 28 }} />
                  ) : (
                    <strong style={{ fontSize: "1.1rem", letterSpacing: "0.05em" }}>{companyName}</strong>
                  )}
                </div>
                <span className="badge" style={{ background: "rgba(255, 255, 255, 0.08)", color: "#e2e8f0", fontSize: 11 }}>
                  Showroom Mode
                </span>
              </div>

              {/* Sample Card Preview */}
              <div style={{ background: "#13151b", borderRadius: 12, border: "1px solid rgba(255, 255, 255, 0.08)", padding: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: primaryColor, color: "#000", fontWeight: 800, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    01
                  </span>
                  <strong style={{ fontSize: "0.95rem" }}>Show us what you love</strong>
                </div>
                <p style={{ fontSize: "0.8rem", color: "#94a3b8", margin: 0 }}>
                  {aboutUs || "Upload a reference photo or describe your custom design for an instant AI quote."}
                </p>
              </div>

              {/* Sample Action Button Preview */}
              <button
                type="button"
                style={{
                  width: "100%",
                  padding: "12px 20px",
                  borderRadius: 10,
                  background: primaryColor,
                  color: primaryColor === "#c9a84c" || primaryColor === "#e6cb78" ? "#000" : "#fff",
                  fontWeight: 700,
                  border: "none",
                  cursor: "default",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow: `0 4px 14px ${primaryColor}40`
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>
                Save Showroom Consultation Quote
              </button>
            </div>
          </div>

          <button
            className="button primary button--lg fitContent"
            type="submit"
            disabled={saving}
            style={{ marginTop: "var(--space-2)" }}
          >
            {saving ? (
              <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>hourglass_top</span> Saving Customization…</>
            ) : (
              <><span className="material-symbols-outlined" style={{ fontSize: 18 }}>palette</span> Save Showroom Customization</>
            )}
          </button>
        </form>
      </section>
    </div>
  );
}
