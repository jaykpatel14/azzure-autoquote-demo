"use client";

import Link from "next/link";
import { useCallback, useSyncExternalStore } from "react";

type TrialBannerProps = {
  companyId: string;
  daysRemaining: number;
  quoteCap: number;
  quotesRemaining: number;
  hasPaymentMethod?: boolean;
};

const STORAGE_PREFIX = "azzure-trial-banner-dismissed";
const STORAGE_EVENT = "azzure-trial-banner-change";

export default function TrialBanner({
  companyId,
  daysRemaining,
  quoteCap,
  quotesRemaining,
  hasPaymentMethod = true
}: TrialBannerProps) {
  const subscribe = useCallback((notify: () => void) => {
    window.addEventListener(STORAGE_EVENT, notify);
    window.addEventListener("storage", notify);
    return () => {
      window.removeEventListener(STORAGE_EVENT, notify);
      window.removeEventListener("storage", notify);
    };
  }, []);
  const getSnapshot = useCallback(
    () => window.sessionStorage.getItem(`${STORAGE_PREFIX}:${companyId}`) === "1",
    [companyId]
  );
  const dismissed = useSyncExternalStore(subscribe, getSnapshot, () => true);

  if (dismissed) {
    return null;
  }

  const isMissingPayment = !hasPaymentMethod;
  const isUrgent = daysRemaining <= 3 || isMissingPayment;
  const daysLabel = `${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;

  function dismiss() {
    const key = `${STORAGE_PREFIX}:${companyId}`;
    window.sessionStorage.setItem(key, "1");
    window.dispatchEvent(new Event(STORAGE_EVENT));
  }

  return (
    <section className={isUrgent ? "trialBannerCard trialBannerCard--urgent" : "trialBannerCard"}>
      <div>
        <p className="trialBannerLabel">
          {isMissingPayment ? "Action Required · Payment Method Needed" : "Trial active"}
        </p>
        <strong>
          {isMissingPayment
            ? `Trial active (${daysLabel} left) — Add a payment method to ensure uninterrupted access`
            : `Your free trial ends in ${daysLabel}`}
        </strong>
        <p className="muted small">
          {isMissingPayment
            ? `You have ${quotesRemaining} of ${quoteCap} trial quotes remaining. Add your payment details before your trial period concludes.`
            : `You have ${quotesRemaining} of ${quoteCap} trial quotes remaining.`}
        </p>
      </div>
      <div className="trialBannerActions">
        <Link
          className="button primary button--sm"
          href="/settings/billing?upgrade=1"
          style={isMissingPayment ? { background: "linear-gradient(135deg, #f59e0b, #d97706)", borderColor: "#f59e0b" } : undefined}
        >
          {isMissingPayment ? "Add payment details →" : "Upgrade now"}
        </Link>
        <button className="button secondary button--sm" type="button" onClick={dismiss}>
          Dismiss
        </button>
      </div>
    </section>
  );
}

