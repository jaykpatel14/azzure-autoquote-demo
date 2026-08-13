export type InternalAdminNavItem = {
  href: string;
  label: string;
  active?: boolean;
};

const NAV_ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/tenants", label: "Tenants" },
  { href: "/admin/tenants/subscriptions", label: "Subscriptions" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/platform/api-keys", label: "API keys" },
  { href: "/admin/platform/settings", label: "Platform settings" }
] as const satisfies readonly InternalAdminNavItem[];

export function getInternalAdminNav(activeHref: string): InternalAdminNavItem[] {
  return NAV_ITEMS.map((item) => ({
    ...item,
    active: item.href === activeHref
  }));
}
