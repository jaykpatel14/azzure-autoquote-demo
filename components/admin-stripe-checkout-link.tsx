"use client";

import React, { useState } from "react";

type AdminStripeCheckoutLinkProps = {
  companyId: string;
  companyName: string;
  ownerEmail?: string | null;
  planCode?: string;
};

export default function AdminStripeCheckoutLink({
  companyId,
  companyName,
  ownerEmail,
  planCode = "professional"
}: AdminStripeCheckoutLinkProps) {
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(sendEmail = false) {
    if (sendEmail) {
      setEmailSending(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(`/api/admin/tenants/${companyId}/checkout-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendEmail, planCode })
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to generate checkout link.");
        return;
      }

      setCheckoutUrl(data.checkoutUrl);
      if (sendEmail) {
        setEmailSent(true);
        setTimeout(() => setEmailSent(false), 4000);
      }
    } catch {
      setError("Network error. Could not connect to billing service.");
    } finally {
      setLoading(false);
      setEmailSending(false);
    }
  }

  async function handleCopy() {
    if (!checkoutUrl) return;
    try {
      await navigator.clipboard.writeText(checkoutUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Failed to copy to clipboard.");
    }
  }

  return (
    <div
      style={{
        marginTop: "12px",
        padding: "16px",
        borderRadius: "10px",
        background: "rgba(245, 158, 11, 0.06)",
        border: "1px solid rgba(245, 158, 11, 0.35)",
        display: "flex",
        flexDirection: "column",
        gap: "12px"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <strong style={{ color: "#d97706", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
            <span>⚡</span> Stripe Payment Details Missing
          </strong>
          <p className="muted small" style={{ margin: "2px 0 0" }}>
            This tenant is currently on trial without a Stripe customer ID. Generate a checkout session to collect their card details.
          </p>
        </div>
        {!checkoutUrl && (
          <button
            type="button"
            className="button secondary button--sm"
            onClick={() => handleGenerate(false)}
            disabled={loading}
            style={{ borderColor: "#f59e0b", color: "#b45309", background: "rgba(245, 158, 11, 0.1)" }}
          >
            {loading ? "Generating Link..." : "Generate Stripe Checkout Link"}
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: "8px 12px", borderRadius: "6px", background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", fontSize: "13px" }}>
          {error}
        </div>
      )}

      {checkoutUrl && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="text"
              readOnly
              value={checkoutUrl}
              style={{
                flex: 1,
                fontSize: "12px",
                padding: "8px 12px",
                background: "rgba(255, 255, 255, 0.8)",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                color: "#1f2937",
                fontFamily: "monospace"
              }}
            />
            <button
              type="button"
              className="button primary button--sm"
              onClick={handleCopy}
              style={{ minWidth: "90px" }}
            >
              {copied ? "Copied! ✓" : "Copy Link"}
            </button>
            <a
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button secondary button--sm"
            >
              Open ↗
            </a>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
            <span className="muted small">
              Owner recipient: <strong>{ownerEmail || "No email on record"}</strong>
            </span>
            <button
              type="button"
              className="button secondary button--sm"
              onClick={() => handleGenerate(true)}
              disabled={emailSending || !ownerEmail}
            >
              {emailSending ? "Sending Email..." : emailSent ? "Email Sent! ✓" : "Email Link to Owner"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
