"use client";

import { useState } from "react";
import QuoteCalculator from "@/components/QuoteCalculator";
import { normalizePricingProfile } from "@/lib/metal-pricing";
import type { PricingProfileInput } from "@/lib/pricing";

export type AdminSalesCompanyData = {
  id: string;
  name: string;
  pricingTier?: string | null;
  customerMarginPct?: number | null;
  subscription?: {
    status: string;
    plan: string;
  } | null;
  pricingProfile?: {
    goldSpotPerOz: string;
    platinumSpotPerOz: string;
    silverSpotPerOz: string;
    cadCharge: string;
    centerSettingPerCarat: string;
    sideSettingPerStone: string;
    sellingMarginDivisor: string;
    finalMultiplier: string;
  } | null;
};

export function AdminSalesQuotingContainer({
  companies,
  cadCost,
  livePricing
}: {
  companies: AdminSalesCompanyData[];
  cadCost: number;
  livePricing: {
    pricingProfile: PricingProfileInput;
    source: string;
  };
}) {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");

  const selectedCompany = companies.find(c => c.id === selectedCompanyId);

  // If a company has custom base metal profiles, we merge them into the live pricing
  // (matching the logic in app/quotes/new/page.tsx)
  const basePricingProfile = selectedCompany?.pricingProfile
    ? normalizePricingProfile({
        goldSpotPerOz: Number(selectedCompany.pricingProfile.goldSpotPerOz),
        platinumSpotPerOz: Number(selectedCompany.pricingProfile.platinumSpotPerOz),
        silverSpotPerOz: Number(selectedCompany.pricingProfile.silverSpotPerOz),
        cadCharge: Number(selectedCompany.pricingProfile.cadCharge),
        centerSettingPerCarat: Number(selectedCompany.pricingProfile.centerSettingPerCarat),
        sideSettingPerStone: Number(selectedCompany.pricingProfile.sideSettingPerStone),
        sellingMarginDivisor: Number(selectedCompany.pricingProfile.sellingMarginDivisor),
        finalMultiplier: Number(selectedCompany.pricingProfile.finalMultiplier)
      })
    : undefined;

  const effectivePricingProfile = basePricingProfile
    ? { ...livePricing.pricingProfile, ...basePricingProfile }
    : livePricing.pricingProfile;

  return (
    <div className="flex-col gap-6" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <section className="card" style={{ padding: "24px" }}>
        <div className="sectionHeader" style={{ marginBottom: "16px" }}>
          <div>
            <h2>Select a Tenant</h2>
            <p className="muted small">Choose the tenant to create this quote for. The system will apply their specific tier pricing markup automatically.</p>
          </div>
        </div>
        
        <select 
          className="input" 
          value={selectedCompanyId} 
          onChange={(e) => setSelectedCompanyId(e.target.value)}
          style={{ maxWidth: "400px" }}
        >
          <option value="" disabled>-- Select Tenant --</option>
          {companies.map(c => (
            <option key={c.id} value={c.id}>{c.name} {c.subscription?.status === 'TRIALING' ? '(Trial)' : ''}</option>
          ))}
        </select>
      </section>

      {selectedCompany ? (
        <QuoteCalculator
          canEdit={true}
          companyName={selectedCompany.name}
          pricingTier={selectedCompany.pricingTier as any ?? "TIER_2"}
          customerMarginPct={selectedCompany.customerMarginPct ?? 0}
          cadCost={cadCost}
          pricingProfile={effectivePricingProfile}
          pricingSourceLabel="Creating quote as Sales admin"
          assignedCompanyId={selectedCompany.id}
        />
      ) : (
        <div className="emptyState card" style={{ padding: "40px", textAlign: "center" }}>
          <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "var(--text-muted)" }}>storefront</span>
          <h3 style={{ marginTop: "16px" }}>Ready to create a quote</h3>
          <p className="muted">Please select a tenant from the dropdown above to begin.</p>
        </div>
      )}
    </div>
  );
}