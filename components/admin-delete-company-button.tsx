"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminDeleteCompanyButton({
  companyId,
  companyName,
  redirectTo = "/admin/companies"
}: {
  companyId: string;
  companyName: string;
  redirectTo?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmInput.trim() !== companyName.trim()) {
      setError("Entered company name does not match.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/companies/${companyId}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: confirmInput.trim(), redirectTo })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete company.");
      }

      setIsOpen(false);
      router.push(redirectTo);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An error occurred while deleting the company.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="button destructive"
        style={{ padding: "6px 12px", fontSize: "12px", cursor: "pointer" }}
        onClick={() => {
          setIsOpen(true);
          setConfirmInput("");
          setError(null);
        }}
      >
        Delete company
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
              padding: "28px",
              maxWidth: "480px",
              width: "100%",
              boxShadow: "0 20px 48px rgba(0, 0, 0, 0.2)",
              border: "1px solid #E2E8F0"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ margin: 0, fontSize: "18px", color: "#BA1A1A", fontWeight: 700 }}>
                Delete Customer Account
              </h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{ fontSize: "20px", color: "#64748B", cursor: "pointer", border: "none", background: "none" }}
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: "14px", color: "#334155", lineHeight: 1.5, marginBottom: "16px" }}>
              Are you sure you want to permanently delete <strong>{companyName}</strong>?
              This will remove all associated quotes, subscriptions, showroom sessions, analyses, and orphan user accounts.
            </p>

            <form onSubmit={handleDelete} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748B", marginBottom: "6px" }}>
                  Type <span style={{ color: "#0F172A", userSelect: "all" }}>{companyName}</span> to confirm:
                </label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder={companyName}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    fontSize: "14px"
                  }}
                  autoFocus
                />
              </div>

              {error && (
                <div style={{ padding: "8px 12px", background: "#FEF2F2", color: "#991B1B", borderRadius: "6px", fontSize: "13px" }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button destructive"
                  disabled={loading || confirmInput.trim() !== companyName.trim()}
                >
                  {loading ? "Deleting..." : "Permanently Delete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
