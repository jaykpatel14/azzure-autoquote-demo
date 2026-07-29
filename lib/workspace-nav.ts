export type WorkspaceNavItem = {
  href: string;
  label: string;
  active?: boolean;
};

const BASE_WORKSPACE_NAV: WorkspaceNavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/quotes/new", label: "New estimate" },
  { href: "/quotes", label: "Quote history" },
  { href: "/settings", label: "Subscription billing" }
];

export function getWorkspaceNav(activeHref: string): WorkspaceNavItem[] {
  return BASE_WORKSPACE_NAV.map((item) => ({
    ...item,
    active: item.href === activeHref
  }));
}
