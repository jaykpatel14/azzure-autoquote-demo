import Link from "next/link";
import type { ReactNode } from "react";
import CompanySwitcher from "@/components/company-switcher";
import SignOutButton from "@/components/sign-out-button";

type WorkspaceNavItem = {
  href: string;
  label: string;
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
  eyebrow = "AI AutoQuote",
  title,
  description,
  navItems,
  actions,
  banner,
  sidebarExtra,
  children
}: WorkspaceShellProps) {
  return (
    <div className="workspaceShell">
      <a className="skipLink" href="#content">
        Skip to content
      </a>
      <aside className="workspaceSidebar">
        <div className="brandBlock">
          <div className="brandMark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 3h12l4 6-10 12L2 9l4-6z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2 9h20" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 3l-2 6 4 12 4-12-2-6" />
            </svg>
          </div>
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <strong className="brand">AutoQuote</strong>
            <p className="muted small">Multi-tenant jewelry quoting &amp; AI analysis.</p>
          </div>
        </div>

        <nav className="workspaceNav" aria-label="Workspace navigation">
          {navItems.map((item) => (
            <Link
              key={item.href}
              className={`workspaceNavItem${item.active ? " isActive" : ""}`}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
            >
              <span className="navItemBullet" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <section className="sidebarPanel" aria-label="Company context">
          <CompanySwitcher />
        </section>

        {sidebarExtra ? sidebarExtra : null}

        <section className="sidebarPanel sidebarFooter" aria-label="Session actions">
          <div className="sidebarFooterHeader">
            <span className="footerStatusDot" aria-hidden="true" />
            <span className="muted small">Tenant Secured</span>
          </div>
          <SignOutButton />
        </section>
      </aside>

      <main className="workspaceMain" id="content">
        <header className="pageHero">
          <div>
            <p className="eyebrow">{eyebrow}</p>
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
