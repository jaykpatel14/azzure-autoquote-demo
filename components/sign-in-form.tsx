"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";

export default function SignInForm({
  initialEmail,
  verified
}: {
  initialEmail: string;
  verified: boolean;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(
    verified ? "Email verified. You can sign in now." : ""
  );
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/"
    });

    if (result?.error) {
      setStatus(
        result.error === "CredentialsSignin"
          ? "Check your email and password, then try again. If you recently registered, verify your email first."
          : "We couldn't sign you in right now. Try again in a moment."
      );
      setLoading(false);
      return;
    }

    // Force a new document request after Auth.js writes the session cookie.
    // A client-side transition can reuse the anonymous home-page response and
    // leave a successfully signed-in user looking at the public pricing page.
    window.location.assign(result?.url || "/");
  }

  return (
    <div className="authShell">
      <section className="authCard">
        <div className="authGrid">
          <aside className="authAside">
            <p className="eyebrow">Azzure AutoQuote</p>
            <h1 className="heading">Sign in</h1>
            <p className="muted">
              Use your email and password to access the private workspace, quote history, and billing controls.
            </p>
            <div className="stack" style={{ marginTop: "1.5rem" }}>
              <div className="detailCard">
                <span>Workspace</span>
                <strong>Luxury quote operations</strong>
                <p className="muted small">Everything stays tenant-aware, so customer data and pricing stay scoped to your shop.</p>
              </div>
              <div className="detailCard">
                <span>After sign-in</span>
                <strong>Analyze, approve, and share</strong>
                <p className="muted small">Move from image upload to approved price without switching tools.</p>
              </div>
            </div>
          </aside>

          <div>
            <h2 className="heading">Welcome back</h2>
            <p className="muted">Enter your workspace credentials to continue.</p>
            <form className="authForm" onSubmit={handleSubmit}>
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
              <button className="button primary" disabled={loading} type="submit">
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </form>
            {status && <div className="status">{status}</div>}
            <p className="muted">
              New here? <Link href="/signup">Create an account</Link>
            </p>
            <p className="muted">
              Forgot your password? <Link href="/forgot-password">Reset it here</Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
