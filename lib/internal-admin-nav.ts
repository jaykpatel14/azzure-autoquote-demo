export type InternalAdminNavItem = {
  href: string;
  label: string;
  icon: string;
  priority: "primary" | "secondary";
  active?: boolean;
};

const NAV_ITEMS = [
  { href: "/admin", label: "Overview", icon: "dashboard", priority: "primary" },
  { href: "/admin/tenants", label: "Tenants", icon: "store", priority: "primary" },
  { href: "/admin/tenants/pending", label: "Approvals", icon: "how_to_reg", priority: "primary" },
  { href: "/admin/orders", label: "Orders [Staging]", icon: "shopping_bag", priority: "primary" },
  { href: "/admin/tenants/subscriptions", label: "Subscriptions", icon: "credit_card", priority: "secondary" },
  { href: "/admin/analytics", label: "Analytics", icon: "analytics", priority: "secondary" },
  { href: "/admin/platform/api-keys", label: "API keys", icon: "key", priority: "secondary" },
  { href: "/admin/platform/settings", label: "Settings", icon: "settings", priority: "secondary" }
] as const satisfies readonly InternalAdminNavItem[];

export function getInternalAdminNav(activeHref: string): InternalAdminNavItem[] {
  return NAV_ITEMS.map((item) => ({
    ...item,
    active: item.href === activeHref
  }));
}
