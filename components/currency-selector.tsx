"use client";

import React from "react";
import type { SupportedCurrency } from "@/lib/currency";

type CurrencySelectorProps = {
  currency: SupportedCurrency;
  onChange: (currency: SupportedCurrency) => void;
  size?: "sm" | "md";
  className?: string;
};

export function CurrencySelector({
  currency,
  onChange,
  size = "md",
  className = ""
}: CurrencySelectorProps) {
  const isSmall = size === "sm";

  return (
    <div
      className={`currencyToggleGroup ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: "var(--color-surface-container-highest, #f1f5f9)",
        borderRadius: "9999px",
        padding: isSmall ? "2px" : "3px",
        border: "1px solid var(--color-outline-variant, #e2e8f0)",
        userSelect: "none"
      }}
      role="group"
      aria-label="Currency selection"
    >
      <button
        type="button"
        onClick={() => onChange("USD")}
        style={{
          border: "none",
          background: currency === "USD" ? "var(--color-primary, #005ab7)" : "transparent",
          color: currency === "USD" ? "#ffffff" : "var(--color-on-surface-variant, #64748b)",
          fontWeight: currency === "USD" ? 700 : 500,
          fontSize: isSmall ? "0.75rem" : "0.825rem",
          padding: isSmall ? "2px 8px" : "4px 12px",
          borderRadius: "9999px",
          cursor: "pointer",
          transition: "all 0.15s ease",
          boxShadow: currency === "USD" ? "0 1px 3px rgba(0,0,0,0.12)" : "none"
        }}
      >
        USD ($)
      </button>
      <button
        type="button"
        onClick={() => onChange("CAD")}
        style={{
          border: "none",
          background: currency === "CAD" ? "var(--color-primary, #005ab7)" : "transparent",
          color: currency === "CAD" ? "#ffffff" : "var(--color-on-surface-variant, #64748b)",
          fontWeight: currency === "CAD" ? 700 : 500,
          fontSize: isSmall ? "0.75rem" : "0.825rem",
          padding: isSmall ? "2px 8px" : "4px 12px",
          borderRadius: "9999px",
          cursor: "pointer",
          transition: "all 0.15s ease",
          boxShadow: currency === "CAD" ? "0 1px 3px rgba(0,0,0,0.12)" : "none"
        }}
      >
        CAD (CA$)
      </button>
    </div>
  );
}
