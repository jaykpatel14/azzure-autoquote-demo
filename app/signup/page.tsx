"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, companyName })
    });
    const result = await response.json();

    if (!response.ok) {
      setStatus(result.error || "Unable to create account.");
      setLoading(false);
      return;
    }

    if (result.emailSent === false && result.verificationToken) {
      router.push(
        `/verify-email?token=${encodeURIComponent(result.verificationToken)}&email=${encodeURIComponent(
          result.email
        )}`
      );
    } else {
      router.push(`/verify-email?email=${encodeURIComponent(result.email)}`);
    }
    router.refresh();
  }

  return (
    <div className="authShell">
      <section className="authCard">
        <h1 className="heading">Create account</h1>
        <p className="muted">Set up your company and owner account in one step.</p>
        <form className="authForm" onSubmit={handleSubmit}>
          <label className="field">
            <span>Your name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label className="field">
            <span>Company name</span>
            <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} required />
          </label>
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          <button className="button primary" disabled={loading} type="submit">
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>
        {status && <div className="status">{status}</div>}
        <p className="muted">
          Already have an account? <Link href="/signin">Sign in</Link>
        </p>
      </section>
    </div>
  );
}
