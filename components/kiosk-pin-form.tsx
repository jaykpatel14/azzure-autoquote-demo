"use client";

import { useState } from "react";

export default function KioskPinForm({ hasPin }: { hasPin: boolean }) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "warning" } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    if (!/^\d{4}$/.test(pin)) {
      setMessage({ text: "PIN must be exactly 4 numeric digits (0-9).", type: "error" });
      return;
    }

    if (pin !== confirmPin) {
      setMessage({ text: "PINs do not match.", type: "error" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/settings/kiosk-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to set PIN.");

      setPin("");
      setConfirmPin("");
      setMessage({
        text: data.warning ? `PIN saved successfully. Note: ${data.warning}` : "Kiosk PIN saved successfully.",
        type: data.warning ? "warning" : "success"
      });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Failed to save PIN.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="stack">
      <div className="grid twoUp">
        <label className="field">
          <span>New 4-Digit PIN</span>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="••••"
            required
          />
        </label>
        <label className="field">
          <span>Confirm PIN</span>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="••••"
            required
          />
        </label>
      </div>

      {message ? (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: "0.875rem",
            background:
              message.type === "success"
                ? "rgba(16, 185, 129, 0.15)"
                : message.type === "warning"
                ? "rgba(245, 158, 11, 0.15)"
                : "rgba(239, 68, 68, 0.15)",
            color:
              message.type === "success"
                ? "#34d399"
                : message.type === "warning"
                ? "#fbbf24"
                : "#fca5a5",
            border: `1px solid ${
              message.type === "success"
                ? "rgba(16, 185, 129, 0.3)"
                : message.type === "warning"
                ? "rgba(245, 158, 11, 0.3)"
                : "rgba(239, 68, 68, 0.3)"
            }`
          }}
        >
          {message.text}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button className="button primary" type="submit" disabled={saving} style={{ width: "fit-content" }}>
          {saving ? "Saving…" : hasPin ? "Update PIN" : "Save PIN"}
        </button>
      </div>
    </form>
  );
}
