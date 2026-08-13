"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type TeamMemberRowProps = {
  membershipId: string;
  name: string;
  email: string;
  role: string;
  removable: boolean;
};

export default function TeamMemberRow({
  membershipId,
  name,
  email,
  role,
  removable
}: TeamMemberRowProps) {
  const router = useRouter();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  async function removeMember() {
    setIsRemoving(true);
    try {
      const response = await fetch(`/api/settings/team/${membershipId}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        throw new Error("Unable to remove member.");
      }

      router.refresh();
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div className="detailCard">
      <div className="detailRow">
        <div>
          <strong>{name}</strong>
          <p className="muted small">{email}</p>
        </div>
        <span className="statusBadge">{role}</span>
      </div>
      {removable ? (
        confirmRemove ? (
          <div className="inlineConfirm">
            <p>Remove this team member? They will lose access immediately.</p>
            <div className="buttonRow">
              <button className="button secondary button--sm" type="button" onClick={() => setConfirmRemove(false)}>
                Cancel
              </button>
              <button className="button destructive button--sm" type="button" onClick={removeMember} disabled={isRemoving}>
                {isRemoving ? "Removing..." : "Remove"}
              </button>
            </div>
          </div>
        ) : (
          <button className="textLink destructive" type="button" onClick={() => setConfirmRemove(true)}>
            Remove
          </button>
        )
      ) : (
        <p className="muted small">Owner access cannot be removed here.</p>
      )}
    </div>
  );
}
