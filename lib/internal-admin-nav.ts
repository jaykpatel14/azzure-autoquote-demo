export type InternalAdminNavItem = {
  href: string;
  label: string;
  active?: boolean;
};

const NAV_ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/companies", label: "Companies" },
  { href: "/admin/settings", label: "API Keys" }
] as const satisfies readonly InternalAdminNavItem[];

export function getInternalAdminNav(activeHref: string): InternalAdminNavItem[] {
  return NAV_ITEMS.map((item) => ({
    ...item,
    active: item.href === activeHref
  }));
}
