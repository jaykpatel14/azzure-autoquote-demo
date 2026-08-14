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
  eyebrow = "Azzure AutoQuote",
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
          <div className="brandMark">A</div>
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <strong className="brand">AutoQuote</strong>
            <p className="muted small">Multi-tenant quoting, billing, and analysis in one focused workspace.</p>
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
              {item.label}
            </Link>
          ))}
        </nav>

        <section className="sidebarPanel" aria-label="Company context">
          <CompanySwitcher />
        </section>

        {sidebarExtra ? sidebarExtra : null}

        <section className="sidebarPanel sidebarFooter" aria-label="Session actions">
          <p className="muted small">
            Signed in workspace controls stay tenant-aware and admin-only where required.
          </p>
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
