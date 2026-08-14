"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
  const modalRef = useRef<HTMLDivElement>(null);
  const closeLinkRef = useRef<HTMLAnchorElement>(null);
  const router = useRouter();

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeLinkRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        router.push("/settings/billing");
        return;
      }

      if (event.key !== "Tab" || !modalRef.current) return;

      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [router]);

  return (
    <div className="upgradeOverlay" role="dialog" aria-modal="true" aria-label="Upgrade plan">
      <div className="upgradeModal" ref={modalRef}>
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Billing</p>
            <h2>Which plan is right for you?</h2>
            <p className="muted">
              Current plan: {currentPlanName}. Changes are applied immediately for upgrades and at the period end for downgrades.
            </p>
          </div>
          <Link ref={closeLinkRef} className="button secondary" href="/settings/billing">
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
