"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";

export default function SignInForm({
  initialEmail,
  verified
}: {
  initialEmail: string;
  verified: boolean;
}) {
  const router = useRouter();
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
          ? "Invalid credentials or unverified email."
          : result.error
      );
      setLoading(false);
      return;
    }

    router.push(result?.url || "/");
    router.refresh();
  }

  return (
    <div className="authShell">
      <section className="authCard">
        <h1 className="heading">Sign in</h1>
        <p className="muted">Use your email and password to access your company workspace.</p>
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
      </section>
    </div>
  );
}
