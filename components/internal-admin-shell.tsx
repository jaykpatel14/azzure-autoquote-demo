import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import SignOutButton from "@/components/sign-out-button";
import type { InternalAdminNavItem } from "@/lib/internal-admin-nav";
import { ACTIVE_COMPANY_COOKIE } from "@/lib/company";
import { prisma } from "@/lib/prisma";

type InternalAdminShellProps = {
  title: string;
  description?: string;
  navItems: InternalAdminNavItem[];
  actions?: ReactNode;
  adminName?: string;
  children: ReactNode;
};

export default async function InternalAdminShell({
  title,
  description,
  navItems,
  actions,
  adminName,
  children
}: InternalAdminShellProps) {
  const pendingCount = await prisma.company.count({ where: { accountStatus: "PENDING_APPROVAL" } });
  const cookieStore = await cookies();
  const hasActiveCompanyContext = Boolean(cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value);

  return (
    <div className="workspaceShell">
      <a className="skipLink" href="#content">
        Skip to content
      </a>

      {/* ── Admin Sidebar Navigation ── */}
      <aside className="workspaceSidebar workspaceSidebar--admin">
        <div className="brandBlock">
          <div className="brandMark" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", color: "#38bdf8" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>shield_person</span>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <strong className="brand" style={{ fontSize: "var(--text-base)" }}>Azzure Admin</strong>
              <span className="adminBadge" style={{ background: "#0284c7", color: "white", padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700 }}>OPERATIONS</span>
            </div>
            <p className="muted small" style={{ margin: "2px 0 0", fontSize: "var(--text-xs)" }}>
              Platform console &amp; tenant controls
            </p>
          </div>
        </div>

        <nav className="workspaceNav" aria-label="Admin navigation">
          {navItems.map((item) => (
            <Link
              key={item.href}
              className={`workspaceNavItem${item.active ? " isActive" : ""}`}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: item.active ? "var(--color-primary)" : "var(--color-on-surface-variant)" }}>
                {item.icon}
              </span>
              <span>{item.label}</span>
              {item.href === "/admin/tenants/pending" && pendingCount > 0 ? (
                <span className="badge" style={{ background: "#f59e0b", color: "#111", marginLeft: "auto" }}>{pendingCount}</span>
              ) : null}
            </Link>
          ))}
        </nav>

        <section className="sidebarPanel sidebarFooter" aria-label="Admin session actions">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: "#10b981" }}>verified_user</span>
            <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--color-on-surface)" }}>
              {adminName || "Admin Session"}
            </span>
          </div>
          <SignOutButton />
        </section>
      </aside>

      {/* ── Main Operations Content ── */}
      <main className="workspaceMain workspaceMain--admin" id="content">
        <header className="adminTopbar">
          <div className="adminTopbarIdentity">
            <span className="adminTopbarLabel" style={{ background: "#0284c7", color: "white", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
              AZZURE OPERATIONS
            </span>
            <span className="adminTopbarDivider" aria-hidden="true" />
            <span className="adminTopbarTitle">Platform Console</span>
          </div>
          <div className="adminTopbarActions">
            <Link
              className="button secondary button--sm"
              href={hasActiveCompanyContext ? "/" : "/admin/tenants"}
              title={hasActiveCompanyContext ? "Return to the tenant workspace you're previewing" : "Pick a tenant to preview their workspace"}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>store</span>
              {hasActiveCompanyContext ? "Jeweler Workspace" : "Preview a Tenant"}
            </Link>
          </div>
        </header>
        <nav className="mobileWorkspaceNav" aria-label="Mobile admin navigation">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={`mobileWorkspaceNavItem${item.active ? " isActive" : ""}`} aria-current={item.active ? "page" : undefined}>
              <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <header className="pageHero">
          <div>
            <p className="eyebrow" style={{ color: "#0284c7" }}>Platform Overview</p>
            <h1 className="pageTitle">{title}</h1>
            {description ? <p className="pageLead">{description}</p> : null}
          </div>
          {actions ? <div className="heroActions">{actions}</div> : null}
        </header>

        {children}
      </main>
    </div>
  );
}
