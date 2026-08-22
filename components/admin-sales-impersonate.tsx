"use client";
import { useState } from "react";

export function AdminSalesImpersonate({ companies }: { companies: { id: string; name: string }[] }) {
  const [selected, setSelected] = useState(companies[0]?.id || "");

  return (
    <form action={`/api/admin/tenants/${selected}/impersonate`} method="post" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <select 
        value={selected} 
        onChange={(e) => setSelected(e.target.value)} 
        style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid var(--color-outline)", background: "var(--color-surface)", color: "var(--color-on-surface)" }}
      >
        {companies.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <button type="submit" className="button primary button--sm" disabled={!selected}>
        Create Quote for Tenant
      </button>
    </form>
  );
}
