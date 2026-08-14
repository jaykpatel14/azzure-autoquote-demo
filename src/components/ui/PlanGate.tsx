import Link from "next/link";
import type { ReactNode } from "react";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getFeaturesForPlan, resolvePlanId, type PlanFeature } from "@/src/stripe/plans";

const GATE_COPY: Partial<Record<PlanFeature, { eyebrow: string; title: string; description: string; cta: string }>> = {
  canShareQuoteLink: { eyebrow: "Enterprise sharing", title: "Present quotes with a private customer link", description: "Enterprise creates a secure, branded page your customer can review from any device.", cta: "Upgrade to Enterprise" },
  canPlaceManufacturingOrder: { eyebrow: "Enterprise manufacturing", title: "Send approved quotes to manufacturing", description: "Enterprise connects finalized quotes to Azzure's manufacturing workflow.", cta: "Upgrade to Enterprise" },
  canViewQuoteHistory: { eyebrow: "Professional quote history", title: "Keep every quote and image together", description: "Professional securely stores quote images and gives your team access to complete history.", cta: "Upgrade to Professional" },
  canUseCustomPricingProfile: { eyebrow: "Professional pricing", title: "Use pricing tailored to your business", description: "Professional lets your company use a custom pricing profile across every quote.", cta: "Upgrade to Professional" }
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
