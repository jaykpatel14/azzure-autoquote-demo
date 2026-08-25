"use client";

import { useState, useEffect } from "react";

type DeviceRegistrationScreenProps = {
  showroomToken: string;
  branding?: {
    companyName?: string | null;
    logoUrl?: string | null;
    primaryColor?: string | null;
  };
  onRegistered: (deviceToken: string) => void;
};

export default function DeviceRegistrationScreen({
  showroomToken,
  branding,
  onRegistered
}: DeviceRegistrationScreenProps) {
  const [deviceName, setDeviceName] = useState("Kiosk 1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const brandColor = branding?.primaryColor || "#c9a84c";

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const trimmed = deviceName.trim();
    if (!trimmed) {
      setError("Please enter a name for this screen.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const platform = /android/i.test(navigator.userAgent) ? "android" : "web";
      const res = await fetch("/api/showroom/devices/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showroomToken,
          deviceName: trimmed,
          platform,
          userAgent: navigator.userAgent
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to register this device.");
      }

      onRegistered(data.deviceToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please check your connection and retry.");
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "radial-gradient(ellipse at center, #181920 0%, #0a0b0e 100%)",
        color: "#f8fafc",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "system-ui, -apple-system, sans-serif",
        userSelect: "none"
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 580,
          background: "rgba(255, 255, 255, 0.04)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 24,
          padding: "44px 36px",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.7)",
          textAlign: "center"
        }}
      >
        {/* Jeweler Logo */}
        {branding?.logoUrl ? (
          <div style={{ marginBottom: 24 }}>
            <img
              src={branding.logoUrl}
              alt={branding.companyName || "Store logo"}
              style={{ maxHeight: 64, maxWidth: 220, objectFit: "contain", margin: "0 auto" }}
            />
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <span
              style={{
                display: "inline-block",
                background: "rgba(201, 168, 76, 0.15)",
                color: brandColor,
                padding: "8px 18px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase"
              }}
            >
              {branding?.companyName || "Azzure AI Quote"}
            </span>
          </div>
        )}

        <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: "0 0 10px", color: "#ffffff", letterSpacing: "-0.02em" }}>
          Setting up this kiosk
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "1.05rem", lineHeight: 1.5, margin: "0 0 32px" }}>
          Give this screen a name so you can identify it in your jeweler dashboard.
        </p>

        <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ textAlign: "left" }}>
            <label
              htmlFor="deviceInput"
              style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#cbd5e1", marginBottom: 8 }}
            >
              Device Name / Location
            </label>
            <input
              id="deviceInput"
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder='e.g. "Front Entrance" or "Counter Display"'
              maxLength={64}
              required
              disabled={submitting}
              style={{
                width: "100%",
                minHeight: 72,
                fontSize: "1.25rem",
                fontWeight: 500,
                color: "#ffffff",
                background: "rgba(0, 0, 0, 0.4)",
                border: "2px solid rgba(255, 255, 255, 0.15)",
                borderRadius: 14,
                padding: "0 20px",
                outline: "none",
                transition: "border-color 0.2s ease",
                boxSizing: "border-box"
              }}
              onFocus={(e) => (e.target.style.borderColor = brandColor)}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255, 255, 255, 0.15)")}
            />
          </div>

          {error ? (
            <div
              style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: 10,
                padding: "12px 16px",
                color: "#fca5a5",
                fontSize: "0.95rem",
                textAlign: "left"
              }}
            >
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%",
              minHeight: 76,
              background: `linear-gradient(135deg, ${brandColor}, #dfc674)`,
              color: "#0a0b0e",
              fontSize: "1.25rem",
              fontWeight: 700,
              border: "none",
              borderRadius: 14,
              cursor: submitting ? "not-allowed" : "pointer",
              boxShadow: "0 10px 30px rgba(201, 168, 76, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              marginTop: 8
            }}
          >
            {submitting ? "Linking Kiosk Screen…" : "Set up this kiosk →"}
          </button>
        </form>

        <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <p style={{ color: "#64748b", fontSize: "0.875rem", margin: 0, lineHeight: 1.5 }}>
            This device will be securely linked to your account.
            <br />
            Manage it anytime from <strong>Settings → Showroom → Devices</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
