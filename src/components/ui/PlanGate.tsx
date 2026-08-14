import Link from "next/link";
import type { ReactNode } from "react";
import { getAuthenticatedCompanyContext } from "@/lib/company";

const PLAN_RANK: Record<string, number> = {
  starter: 1,
  professional: 2,
  enterprise: 3
};

export async function PlanGate({
  minimumPlan = "enterprise",
  children,
  fallbackHref = "/settings",
  requireCkVerification = false
}: {
  minimumPlan?: keyof typeof PLAN_RANK;
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

  const currentPlan = context?.company.subscription?.plan.code;
  const currentRank = currentPlan ? PLAN_RANK[currentPlan] ?? 0 : 0;
  const requiredRank = PLAN_RANK[minimumPlan];

  if (currentRank >= requiredRank) {
    return <>{children}</>;
  }

  return (
    <div className="card">
      <p className="eyebrow">Enterprise feature</p>
      <h2>Upgrade required</h2>
      <p className="muted">
        This feature is reserved for Enterprise accounts. Upgrade to unlock share links, order management, and the public quote surface.
      </p>
      <Link className="button secondary" href={fallbackHref}>
        Review plans
      </Link>
    </div>
  );
}
