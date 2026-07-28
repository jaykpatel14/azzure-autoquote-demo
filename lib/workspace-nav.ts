import type { MembershipRole } from "@prisma/client";
import { hasMinimumRole } from "@/lib/tenant";

export type WorkspaceNavItem = {
  href: string;
  label: string;
  active?: boolean;
};

const BASE_WORKSPACE_NAV: WorkspaceNavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/quotes", label: "Quote history" },
  { href: "/customers", label: "Customers" },
  { href: "/settings", label: "Billing & settings" }
];

export function getWorkspaceNav(activeHref: string, role?: MembershipRole): WorkspaceNavItem[] {
  const items = [...BASE_WORKSPACE_NAV];

  if (role && hasMinimumRole(role, "ESTIMATOR")) {
    items.splice(2, 0, { href: "/quotes/new", label: "New estimate" });
  }

  if (role && hasMinimumRole(role, "ADMIN")) {
    items.push({ href: "/team", label: "Team" });
  }

  return items.map((item) => ({
    ...item,
    active: item.href === activeHref
  }));
}
