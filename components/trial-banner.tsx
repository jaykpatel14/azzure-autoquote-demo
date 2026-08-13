"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type TrialBannerProps = {
  companyId: string;
  daysRemaining: number;
  quoteCap: number;
  quotesRemaining: number;
};

const STORAGE_PREFIX = "azzure-trial-banner-dismissed";

export default function TrialBanner({
  companyId,
  daysRemaining,
  quoteCap,
  quotesRemaining
}: TrialBannerProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const key = `${STORAGE_PREFIX}:${companyId}`;
    setDismissed(window.sessionStorage.getItem(key) === "1");
  }, [companyId]);

  if (dismissed) {
    return null;
  }

  const isUrgent = daysRemaining <= 3;
  const daysLabel = `${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;

  function dismiss() {
    const key = `${STORAGE_PREFIX}:${companyId}`;
    window.sessionStorage.setItem(key, "1");
    setDismissed(true);
  }

  return (
    <section className={isUrgent ? "trialBannerCard trialBannerCard--urgent" : "trialBannerCard"}>
      <div>
        <p className="trialBannerLabel">Trial active</p>
        <strong>Your free trial ends in {daysLabel}</strong>
        <p className="muted small">
          You have {quotesRemaining} of {quoteCap} trial quotes remaining.
        </p>
      </div>
      <div className="trialBannerActions">
        <Link className="button primary button--sm" href="/settings/billing?upgrade=1">
          Upgrade now
        </Link>
        <button className="button secondary button--sm" type="button" onClick={dismiss}>
          Dismiss
        </button>
      </div>
    </section>
  );
}
