"use client";

import Link from "next/link";
import { useState } from "react";

type UpgradeModalProps = {
  currentPlanCode: string;
  currentPlanName: string;
  currentPeriodEnd: string;
  plans: Array<{
    code: string;
    name: string;
    price: string;
    monthlyLimit: number;
  }>;
};

export default function UpgradeModal({
  currentPlanCode,
  currentPlanName,
  currentPeriodEnd,
  plans
}: UpgradeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState(currentPlanCode);

  return (
    <div className="upgradeOverlay" role="dialog" aria-modal="true" aria-label="Upgrade plan">
      <div className="upgradeModal">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Billing</p>
            <h2>Which plan is right for you?</h2>
            <p className="muted">
              Current plan: {currentPlanName}. Changes are applied immediately for upgrades and at the period end for downgrades.
            </p>
          </div>
          <Link className="button secondary" href="/settings/billing">
            Close
          </Link>
        </div>

        <p className="muted small">Current billing period ends on {currentPeriodEnd}.</p>

        <form className="upgradeGrid" action="/api/subscription/change" method="post">
          <input type="hidden" name="planCode" value={selectedPlan} />
          {plans.map((plan) => {
            const isSelected = plan.code === selectedPlan;
            const isCurrent = plan.code === currentPlanCode;
            return (
              <button
                key={plan.code}
                type="button"
                className={isSelected ? "upgradeCard isSelected" : "upgradeCard"}
                onClick={() => setSelectedPlan(plan.code)}
              >
                <span className="eyebrow">{plan.name}</span>
                <strong>{plan.price}</strong>
                <p className="muted small">{plan.monthlyLimit} quotes per month</p>
                <span className="upgradeCardMeta">
                  {isCurrent ? "Current" : isSelected ? "Selected" : "Choose"}
                </span>
              </button>
            );
          })}

          <div className="upgradeActions">
            <button className="button primary button--lg" type="submit">
              Apply plan change
            </button>
            <Link className="button secondary button--lg" href="/settings/billing">
              Back to billing
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
