import Link from "next/link";
import { redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav, requireAdminRouteAccess } from "@/lib/internal-admin-nav";
import { getAllGemstoneRates } from "@/src/services/gemstone-rates";

export const dynamic = "force-dynamic";

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function fmtPerCt(low: number, high: number): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
  return `${fmt(low)}–${fmt(high)}/ct`;
}

export default async function AdminGemstoneRatesPage() {
  const context = await getInternalAdminContext();
  if (!context) redirect("/signin");

  requireAdminRouteAccess("/admin/platform/gemstone-rates", context.user.adminRole);

  const rates = await getAllGemstoneRates();
  const activeCount = rates.filter((r) => r.isActive).length;
  const reviewedCount = rates.filter((r) => r.reviewedAt).length;
  const reviewer = context.user.email || context.user.name || "admin";

  return (
    <InternalAdminShell
      title="Gemstone rates"
      description="Manage colored-stone pricing tiers for accent stone estimates. The commercial tier is used for AutoQuote estimates."
      navItems={getInternalAdminNav("/admin/platform/gemstone-rates", context.user.adminRole)}
      adminName={context.user.name || context.user.email}
      actions={
        <Link className="button secondary" href="/admin/platform/settings">
          Settings
        </Link>
      }
    >
      <section className="statGrid">
        <article className="statCard statCard--admin">
          <span className="eyebrow">Total stones</span>
          <strong>{rates.length}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Active</span>
          <strong>{activeCount}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Reviewed</span>
          <strong>{reviewedCount}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Pending review</span>
          <strong>{rates.length - reviewedCount}</strong>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow">Accent stone pricing</span>
            <h2>Gemstone Rate Tiers</h2>
            <p className="muted">
              Edit the per-carat USD ranges for each tier. Commercial is the default for AutoQuote
              estimates; fine and premium are reference tiers for jeweler review. Use{" "}
              <strong>Mark as reviewed</strong> after confirming rates are current.
            </p>
          </div>
        </div>
        <div className="stack">
          {rates.map((rate) => (
            <form
              key={rate.id}
              className="planCard"
              action="/api/admin/gemstone-rates"
              method="post"
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              <input type="hidden" name="action" value="update" />
              <input type="hidden" name="id" value={rate.id} />
              <input type="hidden" name="reviewedBy" value={reviewer} />
              <input type="hidden" name="redirectTo" value="/admin/platform/gemstone-rates" />

              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <p className="planName" style={{ textTransform: "capitalize" }}>{rate.displayName || rate.stone}</p>
                  <p className="muted small" style={{ margin: "2px 0 0" }}>
                    Refreshed: {formatDate(rate.refreshedAt)} · Reviewed: {formatDate(rate.reviewedAt)}
                    {rate.reviewedBy ? ` by ${rate.reviewedBy}` : ""}
                  </p>
                </div>
                <span
                  className="badge"
                  style={{
                    background: rate.isActive ? "rgba(16, 185, 129, 0.15)" : "rgba(107, 114, 126, 0.15)",
                    color: rate.isActive ? "#10b981" : "#6b7280"
                  }}
                >
                  {rate.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <TierField label="Commercial" lowName="commercialLow" highName="commercialHigh" low={rate.commercial.low} high={rate.commercial.high} />
                <TierField label="Fine" lowName="fineLow" highName="fineHigh" low={rate.fine.low} high={rate.fine.high} />
                <TierField label="Premium" lowName="premiumLow" highName="premiumHigh" low={rate.premium.low} high={rate.premium.high} />
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <label className="muted small" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" name="isActive" defaultChecked={rate.isActive} /> Active
                </label>

                <div style={{ display: "flex", gap: 8 }}>
                  <button className="button primary button--sm" type="submit" name="action" value="update">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span> Save
                  </button>

                  <button className="button secondary button--sm" type="submit" name="action" value="review">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                    {rate.reviewedAt ? "Re-review" : "Mark as reviewed"}
                  </button>

                  <button className="button secondary button--sm" type="submit" name="action" value="refresh">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>sync</span>
                    Refresh
                  </button>
                </div>
              </div>
            </form>
          ))}
        </div>
      </section>
    </InternalAdminShell>
  );
}

function TierField({
  label,
  lowName,
  highName,
  low,
  high
}: {
  label: string;
  lowName: string;
  highName: string;
  low: number;
  high: number;
}) {
  return (
    <div>
      <label className="muted small" style={{ display: "block", marginBottom: 4, fontWeight: 600 }}>
        {label} <span style={{ color: "#6b7280", fontWeight: 400 }}>({fmtPerCt(low, high)})</span>
      </label>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="number"
          name={lowName}
          min="0"
          step="0.01"
          defaultValue={low}
          style={{ flex: 1, minWidth: 60 }}
        />
        <span className="muted small">–</span>
        <input
          type="number"
          name={highName}
          min="0"
          step="0.01"
          defaultValue={high}
          style={{ flex: 1, minWidth: 60 }}
        />
      </div>
    </div>
  );
}