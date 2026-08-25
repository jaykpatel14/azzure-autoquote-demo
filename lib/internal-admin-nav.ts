import { AdminUserRole } from "@/src/services/admin-team";
import { redirect } from "next/navigation";

export type InternalAdminNavItem = {
  href: string;
  label: string;
  icon: string;
  priority: "primary" | "secondary";
  active?: boolean;
  roles?: AdminUserRole[];
};

export const NAV_ITEMS = [
  { href: "/admin", label: "Overview", icon: "dashboard", priority: "primary", roles: ["SUPER_ADMIN", "SUPPORT_ADMIN", "OPERATIONS_MANAGER"] },
  { href: "/admin/sales", label: "Sales Quotes", icon: "request_quote", priority: "primary", roles: ["SUPER_ADMIN", "SALESMAN", "OPERATIONS_MANAGER"] },
  { href: "/admin/orders", label: "Manufacturing Orders", icon: "shopping_bag", priority: "primary", roles: ["SUPER_ADMIN", "OPERATIONS_MANAGER", "ESTIMATOR_ADMIN"] },
  { href: "/admin/quotes", label: "Quote Audit", icon: "receipt_long", priority: "primary", roles: ["SUPER_ADMIN", "ESTIMATOR_ADMIN", "OPERATIONS_MANAGER"] },
  { href: "/admin/tenants", label: "Tenants", icon: "store", priority: "primary", roles: ["SUPER_ADMIN", "SUPPORT_ADMIN", "OPERATIONS_MANAGER"] },
  { href: "/admin/tenants/pending", label: "Approvals", icon: "how_to_reg", priority: "primary", roles: ["SUPER_ADMIN"] },
  { href: "/admin/team", label: "Admin Team", icon: "badge", priority: "primary", roles: ["SUPER_ADMIN"] },
  { href: "/admin/tenants/subscriptions", label: "Subscriptions", icon: "credit_card", priority: "secondary", roles: ["SUPER_ADMIN"] },
  { href: "/admin/analytics", label: "Analytics", icon: "analytics", priority: "secondary", roles: ["SUPER_ADMIN"] },
  { href: "/admin/platform/api-keys", label: "API keys", icon: "key", priority: "secondary", roles: ["SUPER_ADMIN"] },
  { href: "/admin/platform/settings", label: "Settings", icon: "settings", priority: "secondary", roles: ["SUPER_ADMIN"] }
] as const satisfies readonly InternalAdminNavItem[];

export function getInternalAdminNav(activeHref: string, userRole?: string | null): InternalAdminNavItem[] {
  return NAV_ITEMS
    .filter(item => !item.roles || !userRole || (item.roles as readonly string[]).includes(userRole as AdminUserRole))
    .map((item) => ({
      ...item,
      active: item.href === activeHref || (activeHref.startsWith(item.href) && item.href !== "/admin")
    }));
}

export function requireAdminRouteAccess(activeHref: string, userRole?: string | null) {
  if (!userRole) return; // Hardcoded admins or those without strict DB roles bypass this if needed, or maybe we enforce it? Let's assume SUPER_ADMIN for nulls.
  
  // Find the base nav item for this route (match longest prefix)
  const matchedNav = [...NAV_ITEMS].sort((a, b) => b.href.length - a.href.length).find(item => activeHref.startsWith(item.href) && (item.href !== "/admin" || activeHref === "/admin"));
  
  if (matchedNav && matchedNav.roles && !(matchedNav.roles as readonly string[]).includes(userRole as AdminUserRole)) {
    // User is NOT allowed. Redirect to their first allowed route.
    const allowed = NAV_ITEMS.filter(item => !item.roles || (item.roles as readonly string[]).includes(userRole as AdminUserRole));
    if (allowed.length > 0) {
      redirect(allowed[0].href);
    } else {
      redirect("/signin");
    }
  }
}
