"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import React, { useEffect, useState, useRef, Suspense } from "react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const tokenParam = searchParams.get("token") || "";
  const emailParam = searchParams.get("email") || "";
  const errorParam = searchParams.get("error") || "";

  const [email, setEmail] = useState(emailParam);
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(Boolean(tokenParam));
  const [resending, setResending] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(
    () => (errorParam ? { type: "error", text: "That verification link was invalid or has expired. Please enter your code." } : null)
  );
  const [isVerified, setIsVerified] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // If token is in URL (magic link), attempt instant verification
  useEffect(() => {
    let isMounted = true;
    if (tokenParam) {
      fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: tokenParam })
      })
        .then(async (res) => {
          if (!isMounted) return;
          const data = await res.json();
          if (res.ok) {
            setIsVerified(true);
            setStatusMessage({ type: "success", text: "Email verified successfully! Redirecting to sign in..." });
            setTimeout(() => {
              router.push(`/signin?verified=1&email=${encodeURIComponent(data.email || email)}`);
            }, 1800);
          } else {
            setStatusMessage({ type: "error", text: data.error || "Invalid or expired verification link." });
          }
        })
        .catch(() => {
          if (isMounted) {
            setStatusMessage({ type: "error", text: "Failed to verify token. Please try entering your 6-digit code below." });
          }
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [tokenParam, email, router]);

  // Resend countdown timer
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  const handleDigitChange = (index: number, value: string) => {
    // If multiple digits pasted in single box
    const cleanVal = value.replace(/\D/g, "");
    if (cleanVal.length > 1) {
      handlePaste(cleanVal);
      return;
    }

    const nextDigits = [...digits];
    nextDigits[index] = cleanVal.slice(-1);
    setDigits(nextDigits);

    // Auto-focus next input
    if (cleanVal && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (pastedData: string) => {
    const cleanNumbers = pastedData.replace(/\D/g, "").slice(0, 6);
    if (!cleanNumbers) return;

    const nextDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      nextDigits[i] = cleanNumbers[i] || "";
    }
    setDigits(nextDigits);

    const targetFocus = Math.min(cleanNumbers.length, 5);
    inputRefs.current[targetFocus]?.focus();

    // If all 6 digits are filled, automatically trigger submit
    if (cleanNumbers.length === 6) {
      submitCode(cleanNumbers);
    }
  };

  const submitCode = async (codeToVerify?: string) => {
    const code = codeToVerify || digits.join("");
    if (code.length < 6) {
      setStatusMessage({ type: "error", text: "Please enter all 6 digits of your verification code." });
      return;
    }

    setLoading(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });

      const data = await res.json();
      if (!res.ok) {
        setStatusMessage({ type: "error", text: data.error || "Invalid or expired code." });
        setLoading(false);
        return;
      }

      setIsVerified(true);
      setStatusMessage({ type: "success", text: "Email verified successfully! Redirecting to sign in..." });
      setTimeout(() => {
        router.push(`/signin?verified=1&email=${encodeURIComponent(data.email || email)}`);
      }, 1500);
    } catch {
      setStatusMessage({ type: "error", text: "Network error. Please try again." });
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setStatusMessage({ type: "info", text: "Please enter your email address to receive a new code." });
      return;
    }

    setResending(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ type: "success", text: "A fresh 6-digit code has been sent to your email!" });
        setResendCountdown(60);
      } else {
        setStatusMessage({ type: "error", text: data.error || "Failed to resend code." });
      }
    } catch {
      setStatusMessage({ type: "error", text: "Unable to reach the server. Please try again." });
    } finally {
      setResending(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#040711",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        position: "relative",
        overflow: "hidden"
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
          background: "radial-gradient(circle, rgba(14, 165, 233, 0.15) 0%, transparent 70%)",
          filter: "blur(60px)",
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
          background: "radial-gradient(circle, rgba(245, 208, 97, 0.1) 0%, transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none"
        }}
      />

      <div
        className="js-glass-card"
        style={{
          maxWidth: "480px",
          width: "100%",
          padding: "40px 32px",
          textAlign: "center",
          position: "relative",
          zIndex: 10
        }}
      >
        <div className="js-accent-line" />

        {/* Logo Mark */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #38bdf8, #2563eb)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              boxShadow: "0 0 14px rgba(56, 189, 248, 0.5)"
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polygon points="6 3 18 3 22 9 12 22 2 9" />
            </svg>
          </div>
          <span className="js-display" style={{ fontSize: "20px", color: "#f8fafc" }}>Azzure</span>
          <span className="js-logo-badge">AI Quote</span>
        </div>

        <h1 className="js-display" style={{ fontSize: "28px", margin: "0 0 10px", color: "#f8fafc" }}>
          Verify your <em className="js-accent-italic">email</em>
        </h1>

        <p style={{ fontSize: "14px", color: "#94a3b8", lineHeight: "1.6", margin: "0 0 24px" }}>
          {email ? (
            <>
              We sent a 6-digit verification code to <br />
              <strong style={{ color: "#38bdf8" }}>{email}</strong>
            </>
          ) : (
            "Enter the 6-digit verification code sent to your email address."
          )}
        </p>

        {/* Status Alerts */}
        {statusMessage && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "10px",
              marginBottom: "20px",
              fontSize: "13px",
              fontWeight: 500,
              background:
                statusMessage.type === "success"
                  ? "rgba(52, 211, 153, 0.15)"
                  : statusMessage.type === "error"
                  ? "rgba(244, 63, 94, 0.15)"
                  : "rgba(56, 189, 248, 0.15)",
              border: `1px solid ${
                statusMessage.type === "success"
                  ? "#34d399"
                  : statusMessage.type === "error"
                  ? "#f43f5e"
                  : "#38bdf8"
              }`,
              color:
                statusMessage.type === "success"
                  ? "#34d399"
                  : statusMessage.type === "error"
                  ? "#f43f5e"
                  : "#38bdf8"
            }}
          >
            {statusMessage.text}
          </div>
        )}

        {!isVerified ? (
          <div>
            {/* 6-Digit OTP Inputs */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "10px",
                margin: "24px 0"
              }}
              onPaste={(e) => {
                e.preventDefault();
                handlePaste(e.clipboardData.getData("text"));
              }}
            >
              {digits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => {
                    inputRefs.current[idx] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  style={{
                    width: "48px",
                    height: "56px",
                    textAlign: "center",
                    fontSize: "24px",
                    fontWeight: 700,
                    fontFamily: "var(--font-mono-loaded, monospace)",
                    color: "#f8fafc",
                    background: "rgba(4, 7, 17, 0.8)",
                    border: `1.5px solid ${digit ? "#38bdf8" : "rgba(56, 189, 248, 0.25)"}`,
                    borderRadius: "12px",
                    outline: "none",
                    boxShadow: digit ? "0 0 12px rgba(56, 189, 248, 0.35)" : "none",
                    transition: "all 0.2s ease"
                  }}
                />
              ))}
            </div>

            {/* Email input field if not provided in URL */}
            {!emailParam && (
              <div style={{ marginBottom: "16px", textAlign: "left" }}>
                <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>
                  Account Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "rgba(4, 7, 17, 0.8)",
                    border: "1px solid rgba(56, 189, 248, 0.25)",
                    borderRadius: "10px",
                    color: "#f8fafc",
                    fontSize: "14px"
                  }}
                />
              </div>
            )}

            {/* Submit Button */}
            <button
              type="button"
              onClick={() => submitCode()}
              disabled={loading || digits.some((d) => !d)}
              className="js-btn-aurora"
              style={{
                width: "100%",
                padding: "14px",
                fontSize: "15px",
                opacity: loading || digits.some((d) => !d) ? 0.6 : 1,
                cursor: loading || digits.some((d) => !d) ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "Verifying Code..." : "Verify Email & Continue →"}
            </button>

            {/* Resend Action */}
            <div style={{ marginTop: "24px", fontSize: "13px", color: "#94a3b8" }}>
              <span>Didn&apos;t receive the code? </span>
              {resendCountdown > 0 ? (
                <span style={{ color: "#64748b" }}>Resend in {resendCountdown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "#38bdf8",
                    fontWeight: 600,
                    cursor: "pointer",
                    textDecoration: "underline"
                  }}
                >
                  {resending ? "Sending..." : "Resend Code"}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ marginTop: "20px" }}>
            <Link
              href={`/signin?verified=1&email=${encodeURIComponent(email)}`}
              className="js-btn-aurora"
              style={{ width: "100%", padding: "14px", fontSize: "15px" }}
            >
              Sign In to Your Workspace →
            </Link>
          </div>
        )}

        <div style={{ marginTop: "28px", paddingTop: "18px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", fontSize: "13px", color: "#64748b" }}>
          Already verified?{" "}
          <Link href="/signin" style={{ color: "#38bdf8", textDecoration: "none", fontWeight: 600 }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", background: "#040711", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
          Loading verification...
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
