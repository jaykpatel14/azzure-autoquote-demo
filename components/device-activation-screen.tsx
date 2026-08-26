"use client";

import { useState } from "react";

type DeviceActivationScreenProps = {
  serialNumber: string;
  showroomToken: string;
  defaultDeviceName?: string;
  branding?: {
    companyName?: string | null;
    logoUrl?: string | null;
    primaryColor?: string | null;
  };
};

export default function DeviceActivationScreen({
  serialNumber,
  showroomToken,
  defaultDeviceName,
  branding
}: DeviceActivationScreenProps) {
  const [deviceName, setDeviceName] = useState(defaultDeviceName || "Kiosk 1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const brandColor = branding?.primaryColor || "#c9a84c";

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const trimmed = deviceName.trim();
    if (!trimmed) {
      setError("Please enter a name for this kiosk.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const platform = /android/i.test(navigator.userAgent) ? "android" : "web";
      const response = await fetch("/api/showroom/devices/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serialNumber,
          showroomToken,
          deviceName: trimmed,
          platform,
          userAgent: navigator.userAgent
        })
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Failed to activate this kiosk.");
      }

      try {
        localStorage.setItem("azzure_device_token", data.deviceToken);
      } catch {}
      window.location.replace(`/showroom?token=${encodeURIComponent(showroomToken)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed. Please retry.");
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
          maxWidth: 620,
          background: "rgba(255, 255, 255, 0.04)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: 24,
          padding: "44px 36px",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.7)",
          textAlign: "center"
        }}
      >
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
          Setting up your Azzure kiosk
        </h1>
        <p style={{ color: "#94a3b8", fontSize: "1.05rem", lineHeight: 1.5, margin: "0 0 28px" }}>
          This kiosk was pre-provisioned before shipping. Give it a name so your team can identify it in the hardware inventory.
        </p>

        <div
          style={{
            display: "grid",
            gap: 12,
            marginBottom: 24,
            padding: "18px 20px",
            borderRadius: 16,
            border: "1px solid rgba(201, 168, 76, 0.2)",
            background: "rgba(0, 0, 0, 0.25)",
            textAlign: "left"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <strong style={{ color: "#cbd5e1" }}>Serial number</strong>
            <span style={{ color: "#f8fafc", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>{serialNumber}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <strong style={{ color: "#cbd5e1" }}>Device type</strong>
            <span style={{ color: "#f8fafc" }}>Azzure kiosk</span>
          </div>
        </div>

        <form onSubmit={handleActivate} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ textAlign: "left" }}>
            <label
              htmlFor="deviceInput"
              style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#cbd5e1", marginBottom: 8 }}
            >
              Give this screen a name
            </label>
            <input
              id="deviceInput"
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder='e.g. "Front Entrance"'
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
              minHeight: 80,
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
            {submitting ? "Activating kiosk…" : "Activate kiosk →"}
          </button>
        </form>

        <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <p style={{ color: "#64748b", fontSize: "0.875rem", margin: 0, lineHeight: 1.5 }}>
            This device will be linked to your account and appear in the hardware inventory.
          </p>
        </div>
      </div>
    </div>
  );
}
