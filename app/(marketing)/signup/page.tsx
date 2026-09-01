"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import React, { useState, Suspense } from "react";
import { z } from "zod";
import { isPlanCode, type PlanCode } from "@/lib/subscription-plans";
import { validateEmail } from "@/lib/email-validation";

const signupSchema = z.object({
  companyName: z.string().trim().min(2, "Please enter your business or studio name."),
  email: z.string().trim().superRefine((val, ctx) => {
    const check = validateEmail(val);
    if (!check.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: check.error || "Please enter a valid business email address."
      });
    }
  }),
  password: z.string().min(8, "Password must be at least 8 characters."),
  planCode: z.enum(["starter", "professional", "enterprise"])
});

type SignupForm = z.infer<typeof signupSchema>;
type FieldName = keyof SignupForm;

const EMPTY_ERRORS: Record<FieldName, string> = {
  companyName: "",
  email: "",
  password: "",
  planCode: ""
};

function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score >= 4 ? "strong" : score >= 2 ? "good" : "weak";
}

function strengthWidth(strength: ReturnType<typeof getPasswordStrength>) {
  if (strength === "strong") return "100%";
  if (strength === "good") return "66%";
  return "33%";
}

function strengthColor(strength: ReturnType<typeof getPasswordStrength>) {
  if (strength === "strong") return "#34d399";
  if (strength === "good") return "#38bdf8";
  return "#f43f5e";
}

function normalizePlanCode(value: string | null): PlanCode {
  return isPlanCode(value || "") ? (value as PlanCode) : "professional";
}

function SignUpContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialPlan = normalizePlanCode(searchParams.get("plan"));

  const [form, setForm] = useState<SignupForm>({
    companyName: "",
    email: "",
    password: "",
    planCode: initialPlan
  });
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({
    companyName: false,
    email: false,
    password: false,
    planCode: true
  });
  const [errors, setErrors] = useState<Record<FieldName, string>>(EMPTY_ERRORS);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  function setField<K extends FieldName>(name: K, value: SignupForm[K]) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function validateField(name: FieldName, value: SignupForm[FieldName]) {
    const result = signupSchema.shape[name].safeParse(value);
    setErrors((current) => ({
      ...current,
      [name]: result.success ? "" : result.error.issues[0]?.message ?? "Please check this field."
    }));
    setTouched((current) => ({ ...current, [name]: true }));
    return result.success;
  }

  function validateForm() {
    const result = signupSchema.safeParse(form);
    if (result.success) {
      setErrors(EMPTY_ERRORS);
      return true;
    }

    const nextErrors = { ...EMPTY_ERRORS };
    for (const issue of result.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && key in nextErrors) {
        nextErrors[key as FieldName] = issue.message;
      }
    }
    setErrors(nextErrors);
    setTouched({
      companyName: true,
      email: true,
      password: true,
      planCode: true
    });
    return false;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const result = await response.json();

      if (!response.ok) {
        setStatus(result.error || "Unable to start trial checkout.");
        setLoading(false);
        return;
      }

      if (result.url) {
        window.location.assign(result.url);
      } else {
        router.push(`/verify-email?email=${encodeURIComponent(form.email)}`);
      }
    } catch {
      setStatus("Network error. Please try again.");
      setLoading(false);
    }
  }

  const passwordStrength = getPasswordStrength(form.password);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#040711",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
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
          background: "radial-gradient(circle, rgba(14, 165, 233, 0.18) 0%, transparent 70%)",
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
        className="js-glass-card"
        style={{
          maxWidth: "580px",
          width: "100%",
          padding: "36px 36px 44px",
          position: "relative",
          zIndex: 10
        }}
      >
        <div className="js-accent-line" />

        {/* Back Link */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <Link
            href="/#pricing"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              color: "#94a3b8",
              fontSize: "13px",
              textDecoration: "none",
              transition: "color 0.2s"
            }}
          >
            ← Back to Pricing
          </Link>
          <Link
            href="/"
            style={{
              color: "#64748b",
              fontSize: "12px",
              textDecoration: "none"
            }}
          >
            Home
          </Link>
        </div>

        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "9px",
                background: "linear-gradient(135deg, #38bdf8, #2563eb)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "0 0 14px rgba(56, 189, 248, 0.5)"
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <polygon points="6 3 18 3 22 9 12 22 2 9" />
              </svg>
            </div>
            <span className="js-display" style={{ fontSize: "22px", color: "#f8fafc" }}>Azzure</span>
            <span className="js-logo-badge">AI Quote</span>
          </div>

          <h1 className="js-display" style={{ fontSize: "32px", margin: "0 0 8px", color: "#f8fafc" }}>
            Start your <em className="js-accent-italic">14-day free trial</em>
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0 }}>
            Full feature access · Cancel anytime · Setup in under 60 seconds
          </p>
        </div>

        {/* Plan Selector Pills */}
        <div style={{ marginBottom: "24px" }}>
          <label style={{ display: "block", fontSize: "11px", color: "#64748b", fontFamily: "var(--font-mono-loaded, monospace)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>
            Select Trial Tier
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
            {[
              { code: "starter", name: "Starter", price: "$99/mo" },
              { code: "professional", name: "Professional", price: "$199/mo", popular: true },
              { code: "enterprise", name: "Enterprise", price: "$299/mo" }
            ].map((p) => {
              const isSelected = form.planCode === p.code;
              return (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => setField("planCode", p.code as PlanCode)}
                  style={{
                    padding: "10px 6px",
                    borderRadius: "12px",
                    border: `1.5px solid ${isSelected ? "#38bdf8" : "rgba(56, 189, 248, 0.15)"}`,
                    background: isSelected ? "rgba(14, 165, 233, 0.2)" : "rgba(4, 7, 17, 0.6)",
                    color: isSelected ? "#ffffff" : "#94a3b8",
                    cursor: "pointer",
                    textAlign: "center",
                    transition: "all 0.2s ease",
                    position: "relative"
                  }}
                >
                  {p.popular && (
                    <span style={{ position: "absolute", top: "-8px", left: "50%", transform: "translateX(-50%)", fontSize: "9px", background: "linear-gradient(135deg, #38bdf8, #2563eb)", color: "#ffffff", padding: "1px 6px", borderRadius: "9999px", fontWeight: "bold", whiteSpace: "nowrap" }}>
                      ★ POPULAR
                    </span>
                  )}
                  <strong style={{ display: "block", fontSize: "13px" }}>{p.name}</strong>
                  <span style={{ fontSize: "11px", color: isSelected ? "#38bdf8" : "#64748b" }}>{p.price}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Error / Status Alert */}
        {status && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "10px",
              marginBottom: "20px",
              fontSize: "13px",
              fontWeight: 500,
              background: "rgba(244, 63, 94, 0.15)",
              border: "1px solid #f43f5e",
              color: "#f43f5e"
            }}
            role="alert"
          >
            {status}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }} noValidate>
          <div>
            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", fontWeight: 600, marginBottom: "6px" }}>
              Jewelry Business / Atelier Name *
            </label>
            <input
              value={form.companyName}
              onChange={(e) => setField("companyName", e.target.value)}
              onBlur={() => validateField("companyName", form.companyName)}
              placeholder="e.g. Mayfair Fine Atelier"
              required
              style={{
                width: "100%",
                padding: "12px 16px",
                background: "rgba(4, 7, 17, 0.8)",
                border: `1px solid ${touched.companyName && errors.companyName ? "#f43f5e" : "rgba(56, 189, 248, 0.25)"}`,
                borderRadius: "12px",
                color: "#f8fafc",
                fontSize: "14px",
                outline: "none"
              }}
            />
            {touched.companyName && errors.companyName && (
              <p style={{ color: "#f43f5e", fontSize: "12px", margin: "4px 0 0" }}>{errors.companyName}</p>
            )}
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", fontWeight: 600, marginBottom: "6px" }}>
              Business Email Address *
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
              onBlur={() => validateField("email", form.email)}
              placeholder="owner@atelier.com"
              required
              style={{
                width: "100%",
                padding: "12px 16px",
                background: "rgba(4, 7, 17, 0.8)",
                border: `1px solid ${touched.email && errors.email ? "#f43f5e" : "rgba(56, 189, 248, 0.25)"}`,
                borderRadius: "12px",
                color: "#f8fafc",
                fontSize: "14px",
                outline: "none"
              }}
            />
            {touched.email && errors.email && (
              <p style={{ color: "#f43f5e", fontSize: "12px", margin: "4px 0 0" }}>{errors.email}</p>
            )}
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", fontWeight: 600, marginBottom: "6px" }}>
              Password (min. 8 characters) *
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
                onBlur={() => validateField("password", form.password)}
                placeholder="••••••••"
                required
                minLength={8}
                style={{
                  width: "100%",
                  padding: "12px 48px 12px 16px",
                  background: "rgba(4, 7, 17, 0.8)",
                  border: `1px solid ${touched.password && errors.password ? "#f43f5e" : "rgba(56, 189, 248, 0.25)"}`,
                  borderRadius: "12px",
                  color: "#f8fafc",
                  fontSize: "14px",
                  outline: "none"
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

            {/* Password strength meter */}
            {form.password.length > 0 && (
              <div style={{ marginTop: "8px", height: "4px", width: "100%", background: "rgba(255,255,255,0.1)", borderRadius: "2px", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: strengthWidth(passwordStrength),
                    background: strengthColor(passwordStrength),
                    transition: "all 0.2s"
                  }}
                />
              </div>
            )}

            {touched.password && errors.password && (
              <p style={{ color: "#f43f5e", fontSize: "12px", margin: "4px 0 0" }}>{errors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="js-btn-aurora"
            style={{
              width: "100%",
              padding: "14px",
              fontSize: "15px",
              marginTop: "8px",
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            {loading ? "Creating your workspace..." : "Start 14-Day Free Trial →"}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: "12px", color: "#64748b", margin: "16px 0 0" }}>
          You won&apos;t be charged today. Verification code sent immediately upon sign up.
        </p>

        <div style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px solid rgba(255, 255, 255, 0.08)", textAlign: "center", fontSize: "13px", color: "#94a3b8" }}>
          Already have an account?{" "}
          <Link href="/signin" style={{ color: "#38bdf8", fontWeight: 600, textDecoration: "none" }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", background: "#040711", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>
          Loading signup...
        </div>
      }
    >
      <SignUpContent />
    </Suspense>
  );
}
