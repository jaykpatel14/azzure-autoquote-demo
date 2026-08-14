"use client";

import Link from "next/link";
import { useCallback, useSyncExternalStore } from "react";

type TrialBannerProps = {
  companyId: string;
  daysRemaining: number;
  quoteCap: number;
  quotesRemaining: number;
};

const STORAGE_PREFIX = "azzure-trial-banner-dismissed";
const STORAGE_EVENT = "azzure-trial-banner-change";

export default function TrialBanner({
  companyId,
  daysRemaining,
  quoteCap,
  quotesRemaining
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

  const isUrgent = daysRemaining <= 3;
  const daysLabel = `${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;

  function dismiss() {
    const key = `${STORAGE_PREFIX}:${companyId}`;
    window.sessionStorage.setItem(key, "1");
    window.dispatchEvent(new Event(STORAGE_EVENT));
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
