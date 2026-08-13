import Link from "next/link";
import type { ReactNode } from "react";
import SignOutButton from "@/components/sign-out-button";
import type { InternalAdminNavItem } from "@/lib/internal-admin-nav";

type InternalAdminShellProps = {
  title: string;
  description?: string;
  navItems: InternalAdminNavItem[];
  actions?: ReactNode;
  children: ReactNode;
};

export default function InternalAdminShell({
  title,
  description,
  navItems,
  actions,
  children
}: InternalAdminShellProps) {
  return (
    <div className="workspaceShell">
      <a className="skipLink" href="#content">
        Skip to content
      </a>
      <aside className="workspaceSidebar">
        <div className="brandBlock">
          <div className="brandMark">A</div>
          <div>
            <p className="eyebrow">Azzure Internal</p>
            <strong className="brand">Operations console</strong>
            <p className="muted small">Internal support, billing recovery, and key rotation for the Azzure team.</p>
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
              {item.label}
            </Link>
          ))}
        </nav>

        <section className="sidebarPanel sidebarFooter" aria-label="Admin session actions">
          <p className="muted small">
            Only the allowlisted Azzure team can access this console.
          </p>
          <SignOutButton />
        </section>
      </aside>

      <main className="workspaceMain" id="content">
        <header className="pageHero">
          <div>
            <p className="eyebrow">Azzure team</p>
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
