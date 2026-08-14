"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type BillingCancelFormProps = {
  returnTo: string;
};

export default function BillingCancelForm({ returnTo }: BillingCancelFormProps) {
  const [reason, setReason] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = useMemo(() => confirmCode.trim().toUpperCase() === "CANCEL", [confirmCode]);

  return (
    <form
      className="onboardingForm"
      action="/api/subscription/cancel"
      method="post"
      onSubmit={() => setSubmitted(true)}
      noValidate
    >
      <input type="hidden" name="returnTo" value={returnTo} />
      <label className="field">
        <span>Optional reason</span>
        <textarea
          name="reason"
          rows={4}
          placeholder="Tell us why you are cancelling, or leave this blank."
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Type CANCEL to confirm</span>
        <input
          name="confirmCode"
          value={confirmCode}
          onChange={(event) => setConfirmCode(event.target.value)}
          placeholder="CANCEL"
          autoComplete="off"
          spellCheck={false}
        />
        {submitted && !canSubmit ? <p className="fieldError">Type CANCEL to confirm this cancellation.</p> : null}
      </label>
      <div className="onboardingStepActions">
        <button className="button destructive button--lg" type="submit" disabled={!canSubmit}>
          Cancel at period end
        </button>
        <Link className="button secondary button--lg" href="/settings/billing">
          Keep plan
        </Link>
      </div>
    </form>
  );
}
