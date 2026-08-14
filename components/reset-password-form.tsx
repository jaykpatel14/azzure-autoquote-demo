"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password })
    });
    const result = await response.json();

    if (!response.ok) {
      setStatus(result.error || "Unable to reset password.");
      setLoading(false);
      return;
    }

    router.push("/signin?verified=1");
    router.refresh();
  }

  return (
    <div className="authShell">
      <section className="authCard">
        <div className="authGrid">
          <aside className="authAside">
            <p className="eyebrow">Azzure AutoQuote</p>
            <h1 className="heading">Reset password</h1>
            <p className="muted">Choose a new password for your account.</p>
            <div className="detailCard" style={{ marginTop: "1.5rem" }}>
              <span>Security</span>
              <strong>Protecting quote history and billing access</strong>
              <p className="muted small">This password update applies to the workspace tied to your reset token.</p>
            </div>
          </aside>

          <div>
            <h2 className="heading">Choose a new password</h2>
            <p className="muted">Use at least one strong password you can keep private.</p>
            <form className="authForm" onSubmit={handleSubmit}>
              <label className="field">
                <span>New password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
              <button className="button primary" disabled={loading || !token} type="submit">
                {loading ? "Updating..." : "Reset password"}
              </button>
            </form>
            {status && <div className="status">{status}</div>}
            {!token && <p className="muted">The reset link is missing or invalid.</p>}
            <p className="muted">
              Back to <Link href="/signin">sign in</Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
