"use client";

import React, { useState } from "react";
import { CurrencySelector } from "@/components/currency-selector";
import { formatMoneyWithFx, type SupportedCurrency } from "@/lib/currency";

type PublicQuotePriceCardProps = {
  price: number;
  customerName: string;
  displayMetal: string;
  displayCenterColor: string | null;
  centerDiamondCarats: number;
  sideDiamondQuantity: number;
  quoteCreatedAt: string;
  validUntil: string;
};

export function PublicQuotePriceCard({
  price,
  customerName,
  displayMetal,
  displayCenterColor,
  centerDiamondCarats,
  sideDiamondQuantity,
  quoteCreatedAt,
  validUntil
}: PublicQuotePriceCardProps) {
  const [currency, setCurrency] = useState<SupportedCurrency>("USD");

  return (
    <div className="quotePreview publicQuotePreview">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: 8 }}>
        <p className="eyebrow" style={{ margin: 0 }}>Estimated price</p>
        <CurrencySelector currency={currency} onChange={setCurrency} size="sm" />
      </div>

      <p className="publicQuotePrice">
        {formatMoneyWithFx(price, currency)}
        {currency === "CAD" ? (
          <span style={{ fontSize: "0.85rem", fontWeight: 500, marginLeft: 8, color: "var(--color-primary, #005ab7)" }}>
            CAD
          </span>
        ) : null}
      </p>

      <div className="quoteMeta publicQuoteMeta">
        <div>
          <span>Customer</span>
          <strong>{customerName || "Unassigned"}</strong>
        </div>
        <div>
          <span>Metal</span>
          <strong>{displayMetal}</strong>
        </div>
        <div>
          <span>Stone layout</span>
          <strong>
            {displayCenterColor ? `${displayCenterColor} ` : ""}
            {Number(centerDiamondCarats).toFixed(2)} ct center, {sideDiamondQuantity} side stones
          </strong>
        </div>
        <div>
          <span>Quote date</span>
          <strong>{quoteCreatedAt}</strong>
        </div>
        <div>
          <span>Valid until</span>
          <strong>{validUntil}</strong>
        </div>
      </div>
    </div>
  );
}
