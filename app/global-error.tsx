"use client";
import { useEffect } from "react";
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void; }) {
  useEffect(() => {
    fetch("/api/report-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message || error.toString(), digest: error.digest, path: window.location.pathname, url: window.location.href })
    }).catch(console.error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", padding: "20px", textAlign: "center", minHeight: "100vh", backgroundColor: "#f8fafc" }}>
          <div style={{ maxWidth: 500, padding: 40, backgroundColor: "#ffffff", borderRadius: 16, boxShadow: "0 20px 40px rgba(0,0,0,0.1)", border: "1px solid #e2e8f0", fontFamily: "system-ui, sans-serif" }}>
            <h2 style={{ marginTop: 0, fontSize: 24, color: "#0f172a" }}>A critical error occurred</h2>
            <p style={{ color: "#64748b", lineHeight: 1.6, marginBottom: 30 }}>
              The application encountered a critical error. Our team has been notified.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button onClick={() => reset()} style={{ padding: "10px 16px", background: "#0284c7", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>Try again</button>
              <form action="/api/admin/tenants/exit-context" method="post">
                <button type="submit" style={{ width: "100%", padding: "10px 16px", background: "#f1f5f9", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 8, cursor: "pointer", fontWeight: 600 }}>
                  Exit Admin Preview / Clear Session
                </button>
              </form>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
