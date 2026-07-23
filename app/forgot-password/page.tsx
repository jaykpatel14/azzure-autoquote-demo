"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");

    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const result = await response.json();
    setStatus(result.message || result.error || "If that email exists, we sent reset instructions.");
    setLoading(false);
  }

  return (
    <div className="authShell">
      <section className="authCard">
        <h1 className="heading">Forgot password</h1>
        <p className="muted">We’ll send a password reset link if the email is known.</p>
        <form className="authForm" onSubmit={handleSubmit}>
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <button className="button primary" disabled={loading} type="submit">
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>
        {status && <div className="status">{status}</div>}
        <p className="muted">
          Back to <Link href="/signin">sign in</Link>
        </p>
      </section>
    </div>
  );
}
