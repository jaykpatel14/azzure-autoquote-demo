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
  fallbackHref = "/settings"
}: {
  minimumPlan?: keyof typeof PLAN_RANK;
  children: ReactNode;
  fallbackHref?: string;
}) {
  const context = await getAuthenticatedCompanyContext();
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
