export type WorkspaceNavItem = {
  href: string;
  label: string;
  active?: boolean;
};

const BASE_WORKSPACE_NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/quotes", label: "Quote history" },
  { href: "/quotes/new", label: "New estimate" },
  { href: "/customers", label: "Customers" },
  { href: "/team", label: "Team" },
  { href: "/settings", label: "Billing & settings" }
] as const satisfies readonly WorkspaceNavItem[];

export function getWorkspaceNav(activeHref: string): WorkspaceNavItem[] {
  return BASE_WORKSPACE_NAV.map((item) => ({
    ...item,
    active: item.href === activeHref
  }));
}
