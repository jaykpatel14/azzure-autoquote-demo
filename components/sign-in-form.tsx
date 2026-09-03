"use client";

import Link from "next/link";
import React, { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";

export default function SignInForm({
  initialEmail,
  verified,
  next
}: {
  initialEmail: string;
  verified: boolean;
  next?: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState(
    verified ? "✓ Email verified! You can now sign in to your workspace." : ""
  );
  const [loading, setLoading] = useState(false);
  const [showVerifyLink, setShowVerifyLink] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    setShowVerifyLink(false);

    const isKnownAdmin = ["admin@azzure.com", "admin@azzuresolutions.com", "approvals@azzuresolutions.com"].includes(email.trim().toLowerCase());
    const targetUrl = next || (isKnownAdmin ? "/admin" : "/");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: targetUrl
    });

    if (result?.error) {
      if (result.error === "CredentialsSignin") {
        setStatus("Invalid credentials or unverified account. If you just registered, please verify your email.");
        setShowVerifyLink(true);
      } else {
        setStatus("We couldn't sign you in right now. Please try again in a moment.");
      }
      setLoading(false);
      return;
    }

    // Force a new document request after Auth.js writes the session cookie
    window.location.assign(next || (isKnownAdmin ? "/admin" : (result?.url || "/")));
  }

  return (
    <div
      className="js-signin-surface"
      style={{
        minHeight: "100vh",
        background: "#040711",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
        fontFamily: "var(--font-ui-loaded, Inter, sans-serif)"
      }}
    >
      {/* Ambient background glows */}
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: "-10%",
          width: "80%",
          height: "80%",
          background: "radial-gradient(circle, rgba(14, 165, 233, 0.16) 0%, transparent 70%)",
          filter: "blur(70px)",
          pointerEvents: "none"
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-20%",
          right: "-10%",
          width: "80%",
          height: "80%",
          background: "radial-gradient(circle, rgba(245, 208, 97, 0.12) 0%, transparent 70%)",
          filter: "blur(70px)",
          pointerEvents: "none"
        }}
      />

      <div
        className="js-glass-card js-signin-card"
        style={{
          maxWidth: "920px",
          width: "100%",
          padding: 0,
          position: "relative",
          zIndex: 10,
          display: "grid",
          gridTemplateColumns: "1fr 1.2fr"
        }}
      >
        <div className="js-accent-line" />

        {/* Left Aside (Branding & Perks) */}
        <aside
          className="js-signin-aside"
          style={{
            padding: "48px 36px",
            background: "linear-gradient(180deg, rgba(8, 14, 34, 0.95), rgba(4, 7, 17, 0.95))",
            borderRight: "1px solid rgba(56, 189, 248, 0.15)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between"
          }}
        >
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "28px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #38bdf8, #2563eb)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  boxShadow: "0 0 12px rgba(56, 189, 248, 0.4)"
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polygon points="6 3 18 3 22 9 12 22 2 9" />
                </svg>
              </div>
              <span className="js-display" style={{ fontSize: "20px", color: "#f8fafc" }}>Azzure</span>
              <span className="js-logo-badge">AI Quote</span>
            </div>

            <h1 className="js-display" style={{ fontSize: "32px", margin: "0 0 12px", color: "#f8fafc", lineHeight: 1.15 }}>
              Jeweler <em className="js-accent-italic">Workspace</em>
            </h1>
            <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: "1.6", margin: "0 0 28px" }}>
              Access your bespoke pricing formulas, live quotation stream, 3D renders, and customer CRM.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  padding: "14px",
                  borderRadius: "12px",
                  background: "rgba(4, 7, 17, 0.6)",
                  border: "1px solid rgba(56, 189, 248, 0.12)"
                }}
              >
                <strong style={{ display: "block", color: "#38bdf8", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
                  Tenant Isolated
                </strong>
                <span style={{ fontSize: "13px", color: "#94a3b8" }}>
                  All pricing multipliers, markup formulas, and CAD catalogs are strictly confidential to your store.
                </span>
              </div>

              <div
                style={{
                  padding: "14px",
                  borderRadius: "12px",
                  background: "rgba(4, 7, 17, 0.6)",
                  border: "1px solid rgba(56, 189, 248, 0.12)"
                }}
              >
                <strong style={{ display: "block", color: "#f5d061", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>
                  Real-Time Spot Rates
                </strong>
                <span style={{ fontSize: "13px", color: "#94a3b8" }}>
                  Spot bullion prices automatically adjust your quotes for guaranteed margins.
                </span>
              </div>
            </div>
          </div>

          <div style={{ paddingTop: "24px", fontSize: "12px", color: "#64748b" }}>
            Need showroom assistance? <a href="mailto:support@azzuresolutions.com" style={{ color: "#38bdf8", textDecoration: "none" }}>Contact Atelier Support</a>
          </div>
        </aside>

        {/* Right Form */}
        <div className="js-signin-panel" style={{ padding: "48px 40px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ marginBottom: "20px" }}>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                color: "#94a3b8",
                fontSize: "13px",
                textDecoration: "none",
                marginBottom: "16px",
                transition: "color 0.2s"
              }}
            >
              ← Back to Home
            </Link>
            <span className="js-eyebrow" style={{ display: "block", marginBottom: "6px" }}>Secure Sign In</span>
            <h2 className="js-display" style={{ fontSize: "28px", margin: "0 0 6px", color: "#f8fafc" }}>
              Welcome back
            </h2>
            <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>
              Enter your credentials to manage your store quotes.
            </p>
          </div>

          {/* Status Message */}
          {status && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: "10px",
                marginBottom: "20px",
                fontSize: "13px",
                fontWeight: 500,
                background: status.includes("✓")
                  ? "rgba(52, 211, 153, 0.15)"
                  : "rgba(244, 63, 94, 0.15)",
                border: `1px solid ${status.includes("✓") ? "#34d399" : "#f43f5e"}`,
                color: status.includes("✓") ? "#34d399" : "#f43f5e"
              }}
              role="alert"
            >
              {status}
              {showVerifyLink && (
                <div style={{ marginTop: "8px" }}>
                  <Link
                    href={`/verify-email?email=${encodeURIComponent(email)}`}
                    style={{
                      color: "#38bdf8",
                      textDecoration: "underline",
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                  >
                    Enter 6-digit OTP code to verify →
                  </Link>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", fontWeight: 600, marginBottom: "6px" }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jeweler@atelier.com"
                required
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  background: "rgba(4, 7, 17, 0.8)",
                  border: "1px solid rgba(56, 189, 248, 0.25)",
                  borderRadius: "12px",
                  color: "#f8fafc",
                  fontSize: "14px",
                  outline: "none",
                  transition: "all 0.2s"
                }}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <label style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600 }}>
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  style={{ fontSize: "12px", color: "#38bdf8", textDecoration: "none" }}
                >
                  Forgot password?
                </Link>
              </div>

              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: "100%",
                    padding: "12px 48px 12px 16px",
                    background: "rgba(4, 7, 17, 0.8)",
                    border: "1px solid rgba(56, 189, 248, 0.25)",
                    borderRadius: "12px",
                    color: "#f8fafc",
                    fontSize: "14px",
                    outline: "none",
                    transition: "all 0.2s"
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    color: "#64748b",
                    fontSize: "12px",
                    cursor: "pointer",
                    padding: "4px"
                  }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="js-btn-aurora"
              style={{
                width: "100%",
                padding: "14px",
                fontSize: "15px",
                marginTop: "6px",
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "Signing in..." : "Sign In to Workspace →"}
            </button>
          </form>

          <div style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", textAlign: "center", fontSize: "13px", color: "#94a3b8" }}>
            New luxury jeweler?{" "}
            <Link href="/signup" style={{ color: "#38bdf8", fontWeight: 600, textDecoration: "none" }}>
              Start 14-Day Free Trial
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
