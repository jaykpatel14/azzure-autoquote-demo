export type InternalAdminNavItem = {
  href: string;
  label: string;
  priority: "primary" | "secondary";
  active?: boolean;
};

const NAV_ITEMS = [
  { href: "/admin", label: "Overview", priority: "primary" },
  { href: "/admin/tenants", label: "Tenants", priority: "primary" },
  { href: "/admin/tenants/pending", label: "Pending approvals", priority: "primary" },
  { href: "/admin/orders", label: "Orders", priority: "primary" },
  { href: "/admin/tenants/subscriptions", label: "Subscriptions", priority: "secondary" },
  { href: "/admin/analytics", label: "Analytics", priority: "secondary" },
  { href: "/admin/platform/api-keys", label: "API keys", priority: "secondary" },
  { href: "/admin/platform/settings", label: "Platform settings", priority: "secondary" }
] as const satisfies readonly InternalAdminNavItem[];

export function getInternalAdminNav(activeHref: string): InternalAdminNavItem[] {
  return NAV_ITEMS.map((item) => ({
    ...item,
    active: item.href === activeHref
  }));
}
