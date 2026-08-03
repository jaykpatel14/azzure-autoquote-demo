"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type QuoteHistoryActionsProps = {
  quoteId: string;
  quoteNumber: string;
  hasStoredPdf: boolean;
};

type DeleteTarget = "pdf" | "quote" | null;

export default function QuoteHistoryActions({
  quoteId,
  quoteNumber,
  hasStoredPdf
}: QuoteHistoryActionsProps) {
  const router = useRouter();
  const [busyTarget, setBusyTarget] = useState<DeleteTarget>(null);
  const [error, setError] = useState("");

  async function deletePdf() {
    if (!window.confirm(`Delete the stored PDF for ${quoteNumber}?`)) {
      return;
    }

    setBusyTarget("pdf");
    setError("");

    try {
      const response = await fetch(`/api/quotes/${quoteId}/pdf`, {
        method: "DELETE"
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to delete PDF.");
      }

      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete PDF.");
    } finally {
      setBusyTarget(null);
    }
  }

  async function deleteQuote() {
    if (!window.confirm(`Delete saved quote ${quoteNumber}? This cannot be undone.`)) {
      return;
    }

    setBusyTarget("quote");
    setError("");

    try {
      const response = await fetch(`/api/quotes/${quoteId}`, {
        method: "DELETE"
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to delete quote.");
      }

      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete quote.");
    } finally {
      setBusyTarget(null);
    }
  }

  return (
    <div className="stack" style={{ gap: "0.5rem" }}>
      <div className="buttonRow" style={{ flexWrap: "wrap" }}>
        <a className="button secondary" href={`/api/quotes/${quoteId}/pdf`} target="_blank" rel="noreferrer">
          Download PDF
        </a>
        <button
          className="button secondary"
          type="button"
          onClick={deletePdf}
          disabled={!hasStoredPdf || busyTarget !== null}
        >
          {busyTarget === "pdf" ? "Deleting PDF..." : "Delete PDF"}
        </button>
        <button
          className="button destructive"
          type="button"
          onClick={deleteQuote}
          disabled={busyTarget !== null}
        >
          {busyTarget === "quote" ? "Deleting quote..." : "Delete quote"}
        </button>
      </div>
      {error ? <p className="warningBanner">{error}</p> : null}
      {!hasStoredPdf ? <p className="muted small">No stored PDF has been generated yet.</p> : null}
    </div>
  );
}
