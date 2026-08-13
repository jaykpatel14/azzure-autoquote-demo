"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type QuoteRowActionsProps = {
  quoteId: string;
  viewHref: string;
  pdfHref: string;
  publicHref: string;
  canCopyLink: boolean;
  copyLinkTitle?: string;
  canDelete?: boolean;
  deleteRedirectTo?: string;
};

export default function QuoteRowActions({
  quoteId,
  viewHref,
  pdfHref,
  publicHref,
  canCopyLink,
  copyLinkTitle = "Upgrade to share quotes",
  canDelete = true,
  deleteRedirectTo = "/quotes"
}: QuoteRowActionsProps) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(new URL(publicHref, window.location.origin).toString());
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1800);
    } catch {
      setCopyState("idle");
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
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="quoteActionGroup">
      <Link className="textLink" href={viewHref}>
        View
      </Link>
      <Link className="textLink" href={pdfHref} target="_blank">
        PDF
      </Link>
      <button
        className="textLink"
        type="button"
        onClick={handleCopyLink}
        disabled={!canCopyLink}
        title={canCopyLink ? "Copy public quote link" : copyLinkTitle}
      >
        {copyState === "copied" ? "Copied" : "Copy link"}
      </button>
      {canDelete ? (
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
