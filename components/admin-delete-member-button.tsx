"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminDeleteMemberButton({
  companyId,
  userId,
  userEmail,
  userName
}: {
  companyId: string;
  userId: string;
  userEmail: string;
  userName?: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleRemove = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/companies/${companyId}/members/${userId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to remove member.");
      }

      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="button destructive"
        style={{ padding: "4px 8px", fontSize: "11px", cursor: "pointer" }}
        onClick={() => {
          setIsOpen(true);
          setError(null);
        }}
      >
        Remove
      </button>

      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px"
          }}
          role="dialog"
          aria-modal="true"
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "440px",
              width: "100%",
              boxShadow: "0 20px 48px rgba(0, 0, 0, 0.2)",
              border: "1px solid #E2E8F0"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", color: "#BA1A1A", fontWeight: 700 }}>
                Remove User Account
              </h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{ fontSize: "18px", color: "#64748B", cursor: "pointer", border: "none", background: "none" }}
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: "14px", color: "#334155", lineHeight: 1.5, marginBottom: "16px" }}>
              Remove <strong>{userName ? `${userName} (${userEmail})` : userEmail}</strong> from this company?
              If this user has no other company memberships, their login account will be deleted.
            </p>

            {error && (
              <div style={{ padding: "8px 12px", background: "#FEF2F2", color: "#991B1B", borderRadius: "6px", fontSize: "13px", marginBottom: "14px" }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => setIsOpen(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button destructive"
                onClick={handleRemove}
                disabled={loading}
              >
                {loading ? "Removing..." : "Remove User"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
