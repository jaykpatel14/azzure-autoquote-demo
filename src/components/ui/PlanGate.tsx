import Link from "next/link";
import type { ReactNode } from "react";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getFeaturesForPlan, resolvePlanId, type PlanFeature } from "@/src/stripe/plans";

const GATE_COPY: Partial<Record<PlanFeature, { eyebrow: string; title: string; description: string; cta: string }>> = {
  canShareQuoteLink: { eyebrow: "Professional sharing", title: "Present quotes with a private customer link", description: "Professional creates a secure, branded page your customer can review from any device.", cta: "Upgrade to Professional" },
  canPlaceManufacturingOrder: { eyebrow: "Enterprise manufacturing", title: "Auto-push approved quotes to Custom King", description: "Enterprise connects finalized quotes directly to Custom King manufacturing without manual entry.", cta: "Upgrade to Enterprise" },
  canViewQuoteHistory: { eyebrow: "Quote history", title: "Keep every quote and image together", description: "All plans include complete quote history and image storage.", cta: "Upgrade Plan" },
  canUseCustomPricingProfile: { eyebrow: "Professional pricing", title: "Use custom markups tailored to your business", description: "Professional lets your company configure custom pricing profiles across every quote.", cta: "Upgrade to Professional" },
  canGenerateAIImages: { eyebrow: "Enterprise 3D rendering", title: "Photorealistic 3D Concept Generation", description: "Enterprise generates studio-grade 3D visual jewelry renders from confirmed specifications.", cta: "Upgrade to Enterprise" },
  canUseShowroomMode: { eyebrow: "Enterprise in-store tablet", title: "In-Store Tablet Kiosk Mode", description: "Enterprise unlocks a branded customer-facing kiosk touchscreen for walk-in consultations.", cta: "Upgrade to Enterprise" },
  canCustomizeShowroomBranding: { eyebrow: "Enterprise tablet branding", title: "Store logo & custom showroom branding", description: "Enterprise lets you add your custom logo and branding assets across all tablet consultations.", cta: "Upgrade to Enterprise" },
  canAccessLeads: { eyebrow: "Professional & Enterprise CRM", title: "Customer Leads & Inquiries Dashboard", description: "Professional and Enterprise plans include a dedicated Leads CRM with customer contact details, jewelry types, and conversion tracking.", cta: "Upgrade to Professional" }
};

export async function PlanGate({
  feature,
  children,
  fallbackHref = "/settings",
  requireCkVerification = false
}: {
  feature?: PlanFeature;
  children: ReactNode;
  fallbackHref?: string;
  requireCkVerification?: boolean;
}) {
  const context = await getAuthenticatedCompanyContext();
  if (requireCkVerification) {
    const isAllowed = Boolean(
      context &&
        context.company.accountStatus === "APPROVED" &&
        context.company.ckCustomerVerified
    );

    if (isAllowed) {
      return <>{children}</>;
    }

    return (
      <div className="card">
        <p className="eyebrow">Manufacturing order</p>
        <h2>Custom King verification required</h2>
        <p className="muted">
          Manufacturing orders require a Custom King account. Contact Azzure to get verified.
        </p>
        <a className="button secondary" href="mailto:support@azzuresolutions.com">
          Contact Azzure
        </a>
      </div>
    );
  }

  const subscription = context?.company.subscription;
  const allowed = Boolean(subscription && feature && getFeaturesForPlan(resolvePlanId(subscription.plan, subscription.status))[feature]);
  if (allowed) {
    return <>{children}</>;
  }
  const copy = feature ? GATE_COPY[feature] : undefined;

  return (
    <div className="card">
      <p className="eyebrow">{copy?.eyebrow ?? "Plan feature"}</p>
      <h2>{copy?.title ?? "Unlock this feature"}</h2>
      <p className="muted">
        {copy?.description ?? "Choose a plan that includes this capability to add it to your workspace."}
      </p>
      <Link className="button secondary" href={fallbackHref}>
        {copy?.cta ?? "Review plans"}
      </Link>
    </div>
  );
}
