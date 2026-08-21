export default function AdminImpersonationBanner({ companyName }: { companyName: string }) {
  return (
    <div
      role="status"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
        padding: "10px 16px",
        marginBottom: "var(--space-4)",
        background: "#0f172a",
        color: "#e2e8f0",
        borderRadius: "var(--radius-md)",
        fontSize: "0.8125rem"
      }}
    >
      <span>
        <strong style={{ color: "#38bdf8" }}>Admin preview</strong> &mdash; viewing{" "}
        <strong>{companyName}</strong>&rsquo;s workspace read-only. No changes made here are saved.
      </span>
      <form action="/api/admin/tenants/exit-context" method="post">
        <button
          type="submit"
          className="button secondary button--sm"
          style={{ background: "#1e293b", color: "#e2e8f0", border: "1px solid #334155" }}
        >
          Exit to Admin Console
        </button>
      </form>
    </div>
  );
}
