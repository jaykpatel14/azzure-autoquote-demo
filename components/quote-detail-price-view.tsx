"use client";

import React, { useState } from "react";
import type { MakingPriceBreakdown } from "@/src/services/pricing";
import { CurrencySelector } from "@/components/currency-selector";
import { formatMoneyWithFx, type SupportedCurrency } from "@/lib/currency";
import { QuoteCostBreakdown, RestrictedQuoteCostBreakdown } from "@/components/quote-cost-breakdown";

type QuoteDetailPriceViewProps = {
  price: number;
  costBreakdown: MakingPriceBreakdown | null;
  canSeeFullPricing: boolean;
  defaultCurrency?: SupportedCurrency;
};

export function QuoteDetailPriceView({
  price,
  costBreakdown,
  canSeeFullPricing: allowFullPricing,
  defaultCurrency = "USD"
}: QuoteDetailPriceViewProps) {
  const [currency, setCurrency] = useState<SupportedCurrency>(defaultCurrency);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <CurrencySelector currency={currency} onChange={setCurrency} size="sm" />
      </div>

      <div className="quotePreview" style={{ margin: "8px 0 16px 0" }}>
        <span className="muted small">Quote price ({currency})</span>
        <strong className="quotePrice">
          {formatMoneyWithFx(price, currency)}
        </strong>
      </div>

      {costBreakdown ? (
        allowFullPricing ? (
          <QuoteCostBreakdown breakdown={costBreakdown} currency={currency} />
        ) : (
          <RestrictedQuoteCostBreakdown breakdown={costBreakdown} currency={currency} />
        )
      ) : (
        <section className="card" style={{ marginTop: 20 }}>
          <p className="muted">A detailed cost breakdown is not available for this legacy quote.</p>
        </section>
      )}
    </div>
  );
}
