import Link from "next/link";
import { consumeEmailVerificationToken } from "@/lib/auth-tokens";

export default async function VerifyEmailPage({
  searchParams
}: {
  searchParams: Promise<{ token?: string; error?: string; email?: string }>;
}) {
  const params = await searchParams;
  const token = params.token;
  const error = params.error;
  const email = params.email;
  const verifiedUser = token ? await consumeEmailVerificationToken(token) : null;

  return (
    <div className="authShell">
      <section className="authCard">
        <h1 className="heading">Verify email</h1>
        {verifiedUser ? (
          <p className="muted">
            Your email for {verifiedUser.email} has been verified. You can now sign in.
          </p>
        ) : error ? (
          <p className="muted">That verification link is invalid or expired.</p>
        ) : (
          <p className="muted">
            {email
              ? `We sent a verification link to ${email}.`
              : "Check your inbox for a verification link."}
          </p>
        )}
        <p className="muted">
          Go to <Link href="/signin">sign in</Link>
        </p>
      </section>
    </div>
  );
}
