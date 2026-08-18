export type WorkspaceNavItem = {
  href: string;
  label: string;
  icon: string; // Material Symbol icon name
  active?: boolean;
};

const BASE_WORKSPACE_NAV: WorkspaceNavItem[] = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/quotes", label: "Quotes", icon: "request_quote" },
  { href: "/customers", label: "Customers", icon: "group" },
  { href: "/orders", label: "Orders", icon: "shopping_bag" },
  { href: "/settings", label: "Settings", icon: "settings" }
];

export function getWorkspaceNav(activeHref: string): WorkspaceNavItem[] {
  return BASE_WORKSPACE_NAV.map((item) => ({
    ...item,
    active: item.href === activeHref
  }));
}
