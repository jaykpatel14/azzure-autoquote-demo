"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminCreateUserModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminRole, setAdminRole] = useState("OPERATIONS_MANAGER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, adminRole })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create backend user.");
      }

      setIsOpen(false);
      setName("");
      setEmail("");
      setPassword("");
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
        className="button primary"
        onClick={() => {
          setIsOpen(true);
          setError(null);
        }}
      >
        + Create Backend User
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
              borderRadius: "14px",
              padding: "32px",
              maxWidth: "520px",
              width: "100%",
              boxShadow: "0 24px 50px rgba(0, 0, 0, 0.25)",
              border: "1px solid #E2E8F0"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "19px", color: "#0F172A", fontWeight: 700 }}>
                  Create Backend Admin User
                </h3>
                <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748B" }}>
                  Add a staff member with access to work on customer orders, quotes, and operations.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{ fontSize: "22px", color: "#64748B", cursor: "pointer", border: "none", background: "none" }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Staff Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "14px"
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@azzuresolutions.com"
                  required
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "14px"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Password * (Min. 8 characters)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  minLength={8}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "14px"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Role & Permissions
                </label>
                <select
                  value={adminRole}
                  onChange={(e) => setAdminRole(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "14px",
                    background: "#F8FAFC"
                  }}
                >
                  <option value="OPERATIONS_MANAGER">Operations & Order Specialist (Manage CustomKing orders, status, notes)</option>
                  <option value="SUPER_ADMIN">Super Administrator (Full platform & tenant access)</option>
                  <option value="ESTIMATOR_ADMIN">Estimator Admin (Manage live metals & quote diagnostics)</option>
                  <option value="SUPPORT_ADMIN">Support Specialist (Tenant onboarding & support)</option>
                </select>
              </div>

              {error && (
                <div style={{ padding: "10px 14px", background: "#FEF2F2", color: "#991B1B", borderRadius: "8px", fontSize: "13px" }}>
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
                  className="button primary"
                  disabled={loading}
                >
                  {loading ? "Creating..." : "Create Backend User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
