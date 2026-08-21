"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { isPlanCode, type PlanCode } from "@/lib/subscription-plans";
import { validateEmail } from "@/lib/email-validation";

const signupSchema = z.object({
  companyName: z.string().trim().min(2, "Please enter a business name."),
  name: z.string().trim().min(1, "Please enter your name."),
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
  name: "",
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

function normalizePlanCode(value: string | null): PlanCode {
  return isPlanCode(value || "") ? (value as PlanCode) : "professional";
}

export default function SignUpPage() {
  const searchParams = useSearchParams();
  const initialPlan = normalizePlanCode(searchParams.get("plan"));
  const [form, setForm] = useState<SignupForm>({
    companyName: "",
    name: "",
    email: "",
    password: "",
    planCode: initialPlan
  });
  const [touched, setTouched] = useState<Record<FieldName, boolean>>({
    companyName: false,
    name: false,
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
      name: true,
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
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const result = await response.json();

    if (!response.ok) {
      setStatus(result.error || "Unable to start checkout.");
      setLoading(false);
      return;
    }

    window.location.assign(result.url);
  }

  const passwordStrength = getPasswordStrength(form.password);

  return (
    <main className="signupShell">
      <section className="signupCard">
        <div className="signupHeader">
          <p className="eyebrow">Azzure AI Quote</p>
          <h1 className="signupTitle">Start your free 14-day trial</h1>
          <p className="signupLead">Full Professional features - No charge today</p>
        </div>

        <form className="signupForm" onSubmit={handleSubmit} noValidate>
          <label className="field signupField">
            <span>Business name *</span>
            <input
              id="companyName"
              value={form.companyName}
              onChange={(event) => setField("companyName", event.target.value)}
              onBlur={() => validateField("companyName", form.companyName)}
              aria-invalid={touched.companyName && Boolean(errors.companyName)}
              aria-describedby={touched.companyName && errors.companyName ? "companyName-error" : undefined}
              required
            />
            {touched.companyName && errors.companyName ? (
              <p className="fieldError" id="companyName-error">{errors.companyName}</p>
            ) : null}
          </label>

          <label className="field signupField">
            <span>Your name *</span>
            <input
              id="name"
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              onBlur={() => validateField("name", form.name)}
              aria-invalid={touched.name && Boolean(errors.name)}
              aria-describedby={touched.name && errors.name ? "name-error" : undefined}
              required
            />
            {touched.name && errors.name ? <p className="fieldError" id="name-error">{errors.name}</p> : null}
          </label>

          <label className="field signupField">
            <span>Email address *</span>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={(event) => setField("email", event.target.value)}
              onBlur={() => validateField("email", form.email)}
              aria-invalid={touched.email && Boolean(errors.email)}
              aria-describedby={touched.email && errors.email ? "email-error" : undefined}
              required
            />
            {touched.email && errors.email ? <p className="fieldError" id="email-error">{errors.email}</p> : null}
          </label>

          <label className="field signupField">
            <span>Password *</span>
            <div className="passwordField">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) => setField("password", event.target.value)}
                onBlur={() => validateField("password", form.password)}
                aria-invalid={touched.password && Boolean(errors.password)}
                aria-describedby={touched.password && errors.password ? "password-error" : undefined}
                required
                minLength={8}
              />
              <button
                className="passwordToggle"
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <div className="strengthTrack" aria-hidden="true">
              <div
                className={`strengthFill strengthFill--${passwordStrength}`}
                style={{ width: strengthWidth(passwordStrength) }}
              />
            </div>
            {touched.password && errors.password ? (
              <p className="fieldError" id="password-error">{errors.password}</p>
            ) : null}
          </label>

          <button className="button primary button--lg signupButton" disabled={loading} type="submit">
            {loading ? "Redirecting to checkout..." : "Continue to payment"}
          </button>

          <p className="signupFootnote">You won&apos;t be charged today. Cancel anytime before day 14.</p>
          {status ? <div className="signupStatus" role="alert">{status}</div> : null}
        </form>

        <div className="signupFooter">
          <p>
            Already have an account? <Link href="/signin">Sign in</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
