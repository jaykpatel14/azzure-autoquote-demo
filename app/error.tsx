"use client";
import { useEffect } from "react";
import Link from "next/link";
export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void; }) {
  useEffect(() => {
    fetch("/api/report-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message || error.toString(), digest: error.digest, path: window.location.pathname, url: window.location.href })
    }).catch(console.error);
  }, [error]);

  return (
    <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", padding: "20px", textAlign: "center", minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      <div style={{ maxWidth: 500, padding: 40, backgroundColor: "#ffffff", borderRadius: 16, boxShadow: "0 20px 40px rgba(0,0,0,0.1)", border: "1px solid #e2e8f0" }}>
        <div style={{ marginBottom: 24 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: "#ef4444" }}>error</span>
        </div>
        <h2 style={{ marginTop: 0, fontSize: 24, color: "#0f172a" }}>We encountered a hiccup!</h2>
        <p style={{ color: "#64748b", lineHeight: 1.6, marginBottom: 30 }}>
          An unexpected error occurred while loading this page. Our technical team has been notified and we are working to resolve the issue.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <button onClick={() => reset()} className="button primary" style={{ width: "100%" }}>Try again</button>
          <form action="/api/admin/tenants/exit-context" method="post" style={{ width: "100%" }}>
            <button type="submit" className="button secondary" style={{ width: "100%", background: "#f1f5f9" }}>
              Exit Admin Preview / Clear Session
            </button>
          </form>
          <Link href="/" className="button secondary" style={{ width: "100%" }}>Return to Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
