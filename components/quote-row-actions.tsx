"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast-provider";

type QuoteRowActionsProps = {
  quoteId: string;
  viewHref: string;
  pdfHref: string;
  publicHref: string;
  canCopyLink: boolean;
  copyLinkTitle?: string;
  canDelete?: boolean;
  deleteRedirectTo?: string;
  showView?: boolean;
  showPdf?: boolean;
  showCopy?: boolean;
  showDelete?: boolean;
};

export default function QuoteRowActions({
  quoteId,
  viewHref,
  pdfHref,
  publicHref,
  canCopyLink,
  copyLinkTitle = "Upgrade to share quotes",
  canDelete = true,
  deleteRedirectTo = "/quotes",
  showView = true,
  showPdf = true,
  showCopy = true,
  showDelete = true
}: QuoteRowActionsProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleCopyLink() {
    try {
      const response = await fetch(`/api/quotes/${quoteId}/share`, { method: "POST" });
      if (!response.ok) throw new Error("Unable to create quote link.");
      const payload = (await response.json()) as { url: string };
      await navigator.clipboard.writeText(new URL(payload.url || publicHref, window.location.origin).toString());
      setCopyState("copied");
      showToast({
        message: "Quote link copied.",
        variant: "success"
      });
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("idle");
      showToast({
        message: "Unable to copy the quote link.",
        variant: "error",
        autoDismiss: false
      });
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/quotes/${quoteId}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        throw new Error("Unable to delete quote.");
      }

      setConfirmDelete(false);
      router.refresh();
      if (deleteRedirectTo) {
        router.push(deleteRedirectTo);
      }
      showToast({
        message: "Quote deleted.",
        variant: "success"
      });
    } catch {
      showToast({ message: "We couldn't delete this quote. Try again.", variant: "error", autoDismiss: false });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="quoteActionGroup">
      {showView ? (
        <Link className="textLink" href={viewHref}>
          View
        </Link>
      ) : null}
      {showPdf ? (
        <Link className="textLink" href={pdfHref} target="_blank">
          PDF
        </Link>
      ) : null}
      {showCopy ? (
        <button
          className="textLink"
          type="button"
          onClick={handleCopyLink}
          disabled={!canCopyLink}
          title={canCopyLink ? "Copy public quote link" : copyLinkTitle}
        >
          {copyState === "copied" ? "Copied" : "Copy link"}
        </button>
      ) : null}
      {showDelete && canDelete ? (
        <button
          className="textLink destructive"
          type="button"
          onClick={() => setConfirmDelete((current) => !current)}
        >
          Delete
        </button>
      ) : null}

      {confirmDelete ? (
        <div className="inlineConfirm">
          <p>Delete this quote? This cannot be undone.</p>
          <div className="buttonRow">
            <button className="button secondary button--sm" type="button" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
            <button className="button destructive button--sm" type="button" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
