import Link from "next/link";
import type { ReactNode } from "react";
import CompanySwitcher from "@/components/company-switcher";
import SignOutButton from "@/components/sign-out-button";

type WorkspaceNavItem = {
  href: string;
  label: string;
  icon: string;
  active?: boolean;
};

type WorkspaceShellProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  navItems: WorkspaceNavItem[];
  actions?: ReactNode;
  banner?: ReactNode;
  sidebarExtra?: ReactNode;
  children: ReactNode;
};

export default function WorkspaceShell({
  eyebrow = "Azzure AI Quote",
  title,
  description,
  navItems,
  actions,
  banner,
  sidebarExtra,
  children
}: WorkspaceShellProps) {
  const activePage = navItems.find((n) => n.active);

  return (
    <div className="workspaceShell">
      <a className="skipLink" href="#content">
        Skip to content
      </a>

      {/* ── Sidebar ── */}
      <aside className="workspaceSidebar" aria-label="Workspace navigation">
        {/* Brand */}
        <div className="brandBlock">
          <div className="brandMark" aria-hidden="true">
            A
          </div>
          <div>
            <strong className="brandTitleText">Azzure</strong>
            <p className="brandSubtitleText" style={{ margin: 0 }}>AI Quote</p>
          </div>
        </div>

        {/* New Quote CTA */}
        <Link href="/quotes/new" className="sidebarNewQuoteBtn">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">add</span>
          <span>New Quote</span>
        </Link>

        {/* Primary Navigation */}
        <nav className="workspaceNav" aria-label="Primary navigation">
          {navItems.map((item) => (
            <Link
              key={item.href}
              className={`workspaceNavItem${item.active ? " isActive" : ""}`}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
            >
              <span
                className="material-symbols-outlined workspaceNavIcon"
                style={item.active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                aria-hidden="true"
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Company Switcher */}
        <section className="sidebarPanel" aria-label="Company context" style={{ marginTop: "auto" }}>
          <CompanySwitcher />
        </section>

        {sidebarExtra ? sidebarExtra : null}

        {/* Footer */}
        <section className="sidebarFooter" aria-label="Session actions">
          <div className="sidebarFooterHeader">
            <span className="footerStatusDot" aria-hidden="true" />
            <span className="muted small">Tenant Secured</span>
          </div>
          <SignOutButton />
        </section>
      </aside>

      {/* ── Main Content ── */}
      <main className="workspaceMain" id="content">
        {/* Mobile top bar */}
        <header className="mobileTopBar" aria-label="Mobile workspace header">
          <div className="mobileBrandBlock">
            <strong className="brand" style={{ fontSize: "1.25rem" }}>Azzure</strong>
          </div>
          <div className="mobileTopActions">
            <SignOutButton />
          </div>
        </header>
        <nav className="mobileWorkspaceNav" aria-label="Mobile workspace navigation">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={`mobileWorkspaceNavItem${item.active ? " isActive" : ""}`} aria-current={item.active ? "page" : undefined}>
              <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Sticky top nav bar for desktop */}
        <header className="workspacePageHeader" aria-label="Page header">
          <div>
            {/* Breadcrumb */}
            <nav className="breadcrumbs" aria-label="Breadcrumb" style={{ marginBottom: 12 }}>
              <span>Azzure AI Quote</span>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }} aria-hidden="true">chevron_right</span>
              <span className="active">{activePage?.label ?? title}</span>
            </nav>
            <h1 className="pageTitle">{title}</h1>
            {description ? <p className="pageLead">{description}</p> : null}
          </div>
          {actions ? <div className="heroActions">{actions}</div> : null}
        </header>

        {banner ? <div className="pageBannerWrap">{banner}</div> : null}
        {children}
      </main>
    </div>
  );
}
