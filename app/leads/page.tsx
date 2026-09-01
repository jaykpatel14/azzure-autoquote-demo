import Link from "next/link";
import { redirect } from "next/navigation";
import WorkspaceShell from "@/components/workspace-shell";
import { PlanGate } from "@/src/components/ui/PlanGate";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import { getLeadsData } from "@/src/services/leads";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value);
}

function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  if (diffMinutes < 60) return `${Math.max(1, diffMinutes)}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getJewelryIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes("ring")) return "💍";
  if (t.includes("pendant")) return "✨";
  if (t.includes("bracelet")) return "💎";
  if (t.includes("necklace")) return "📿";
  if (t.includes("earring")) return "💫";
  if (t.includes("grill")) return "👑";
  return "💎";
}

type LeadsPageProps = {
  searchParams?: Promise<{
    query?: string;
    jewelryType?: string;
  }>;
};

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  if (context.company.subscription && !context.company.subscription.onboardingComplete) {
    redirect("/onboarding");
  }
  if (context.company.accountStatus !== "APPROVED") redirect("/pending-approval");
  if (!context.company.pricingTier) redirect("/configuration");

  const params = searchParams ? await searchParams : {};
  const activeQuery = params.query || "";
  const activeType = params.jewelryType || "all";

  const summary = await getLeadsData(context.company.id, {
    query: activeQuery,
    jewelryType: activeType
  });

  const filterTypes = ["all", ...summary.jewelryTypes];

  return (
    <WorkspaceShell
      title="Customer Leads"
      description="Capture and follow up on customer inquiries, contact details, and jewelry design consultations."
      navItems={getWorkspaceNav("/leads")}
      actions={
        <>
          <Link className="button secondary" href="/showroom">
            Showroom Kiosk
          </Link>
          <Link className="button primary" href="/quotes/new">
            New Quote
          </Link>
        </>
      }
    >
      <PlanGate feature="canAccessLeads" fallbackHref="/settings/billing">
        {/* KPI Stats */}
        <section className="statGrid" style={{ marginBottom: "24px" }}>
          <article className="statCard">
            <span className="eyebrow">Total Inquiries</span>
            <strong>{summary.totalLeads}</strong>
            <p className="muted small">All prospect &amp; customer consultations.</p>
          </article>
          <article className="statCard">
            <span className="eyebrow">Contactable Leads</span>
            <strong>{summary.contactableCount}</strong>
            <p className="muted small">
              {summary.phoneCount} phone · {summary.emailCount} email
            </p>
          </article>
          <article className="statCard">
            <span className="eyebrow">Showroom Kiosk Leads</span>
            <strong>{summary.showroomCount}</strong>
            <p className="muted small">In-store walk-in guest sessions.</p>
          </article>
          <article className="statCard">
            <span className="eyebrow">Pipeline Value</span>
            <strong>{formatCurrency(summary.totalPipelineValue)}</strong>
            <p className="muted small">Combined estimated retail quote value.</p>
          </article>
        </section>

        {/* Filter Bar */}
        <section className="card" style={{ marginBottom: "20px", padding: "16px 20px" }}>
          <form
            method="get"
            action="/leads"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <div style={{ display: "flex", gap: "12px", flex: 1, minWidth: "280px" }}>
              <input
                type="search"
                name="query"
                defaultValue={activeQuery}
                placeholder="Search leads by name, email, phone, quote #..."
                style={{
                  flex: 1,
                  padding: "8px 14px",
                  borderRadius: "8px",
                  background: "var(--color-surface-container-high)",
                  border: "1px solid var(--color-outline-variant)",
                  color: "var(--color-on-surface)",
                  fontSize: "13px"
                }}
              />
              <button className="button secondary" type="submit">
                Search
              </button>
              {activeQuery || activeType !== "all" ? (
                <Link className="button ghost" href="/leads" style={{ fontSize: "12px" }}>
                  Clear
                </Link>
              ) : null}
            </div>

            {/* Jewelry Type Filter Chips */}
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
              <span className="small muted" style={{ marginRight: "4px" }}>
                Type:
              </span>
              {filterTypes.map((type) => {
                const isSelected = activeType.toLowerCase() === type.toLowerCase();
                const targetUrl = new URLSearchParams();
                if (activeQuery) targetUrl.set("query", activeQuery);
                if (type !== "all") targetUrl.set("jewelryType", type);
                const href = targetUrl.toString() ? `/leads?${targetUrl.toString()}` : "/leads";

                return (
                  <Link
                    key={type}
                    href={href}
                    style={{
                      padding: "4px 10px",
                      borderRadius: "9999px",
                      fontSize: "12px",
                      textDecoration: "none",
                      background: isSelected
                        ? "var(--color-primary)"
                        : "var(--color-surface-container-high)",
                      color: isSelected ? "var(--color-on-primary)" : "var(--color-on-surface-variant)",
                      fontWeight: isSelected ? 600 : 400,
                      border: "1px solid var(--color-outline-variant)",
                      transition: "all 0.15s"
                    }}
                  >
                    {type === "all" ? "All Types" : `${getJewelryIcon(type)} ${type}`}
                  </Link>
                );
              })}
            </div>
          </form>
        </section>

        {/* Leads Table Card */}
        <section className="card">
          <div className="sectionHeader" style={{ marginBottom: "16px" }}>
            <div>
              <h2>Active Leads ({summary.leads.length})</h2>
              <p className="muted small">
                Customer contact records aggregated from completed estimates and showroom sessions.
              </p>
            </div>
          </div>

          {summary.leads.length === 0 ? (
            <div className="emptyState" style={{ padding: "48px 24px", textAlign: "center" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "var(--color-primary)", marginBottom: "12px" }}>
                contact_mail
              </span>
              <h3>No leads found</h3>
              <p className="muted small" style={{ maxWidth: "420px", margin: "8px auto 20px" }}>
                {activeQuery || activeType !== "all"
                  ? "No customer inquiries matched your active search filters."
                  : "Leads will automatically appear here as customers receive quotes or interact with your Showroom Kiosk."}
              </p>
              <Link className="button primary" href="/quotes/new">
                Create New Quote
              </Link>
            </div>
          ) : (
            <div className="tableShell">
              <table className="dataTable">
                <thead>
                  <tr>
                    <th scope="col">Customer Name</th>
                    <th scope="col">Contact Info</th>
                    <th scope="col">Jewelry Interest</th>
                    <th scope="col">Quoted Value</th>
                    <th scope="col">Channel / Source</th>
                    <th scope="col">Captured</th>
                    <th scope="col" style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.leads.map((lead) => (
                    <tr key={lead.id}>
                      <td>
                        <strong>{lead.customerName}</strong>
                        {lead.showroomDisplayCode && (
                          <div className="small muted" style={{ fontSize: "11px", marginTop: "2px" }}>
                            Code: <span className="monoCell">{lead.showroomDisplayCode}</span>
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                          {lead.customerPhone ? (
                            <a
                              href={`tel:${lead.customerPhone}`}
                              style={{
                                color: "var(--color-primary)",
                                textDecoration: "none",
                                fontSize: "12px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                                call
                              </span>
                              {lead.customerPhone}
                            </a>
                          ) : null}
                          {lead.customerEmail ? (
                            <a
                              href={`mailto:${lead.customerEmail}`}
                              style={{
                                color: "var(--color-on-surface-variant)",
                                textDecoration: "none",
                                fontSize: "12px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                                mail
                              </span>
                              {lead.customerEmail}
                            </a>
                          ) : null}
                          {!lead.customerPhone && !lead.customerEmail && (
                            <span className="small muted" style={{ fontStyle: "italic" }}>
                              No contact info saved
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "14px" }}>{getJewelryIcon(lead.jewelryType)}</span>
                          <div>
                            <strong style={{ fontSize: "13px" }}>{lead.jewelryType}</strong>
                            <div className="small muted" style={{ fontSize: "11px" }}>
                              {lead.metalType}
                              {lead.centerDiamondCarats > 0 ? ` · ${lead.centerDiamondCarats}ct` : ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong className="quoteValue" style={{ fontSize: "14px" }}>
                          {formatCurrency(lead.estimatedPrice)}
                        </strong>
                        <div className="small muted" style={{ fontSize: "11px" }}>
                          Quote #{lead.quoteNumber}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "3px 8px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 500,
                            background:
                              lead.source === "Showroom Kiosk"
                                ? "rgba(245, 208, 97, 0.15)"
                                : lead.source === "Private Share"
                                ? "rgba(56, 189, 248, 0.15)"
                                : "rgba(148, 163, 184, 0.15)",
                            color:
                              lead.source === "Showroom Kiosk"
                                ? "#f5d061"
                                : lead.source === "Private Share"
                                ? "#38bdf8"
                                : "var(--color-on-surface-variant)"
                          }}
                        >
                          {lead.source}
                        </span>
                      </td>
                      <td title={lead.createdAt.toLocaleString()}>
                        <span style={{ fontSize: "12px" }}>{formatRelativeTime(lead.createdAt)}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link
                          className="button secondary"
                          href={`/quotes/${lead.id}`}
                          style={{ padding: "4px 10px", fontSize: "12px" }}
                        >
                          View Quote →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </PlanGate>
    </WorkspaceShell>
  );
}
