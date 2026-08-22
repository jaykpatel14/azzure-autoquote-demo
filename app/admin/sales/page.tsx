import Link from "next/link";
import { redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav, requireAdminRouteAccess } from "@/lib/internal-admin-nav";
import { AdminSalesQuotingContainer } from "@/components/admin-sales-quoting-container";
import { getAdminSalesQuotes } from "@/src/services/admin-sales";
import { getSettingValue } from "@/lib/app-settings";
import { resolveMetalPricing } from "@/lib/metal-pricing";

export const dynamic = "force-dynamic";

export default async function AdminSalesDashboard() {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  requireAdminRouteAccess("/admin/sales", context.user.adminRole as any);

  const { companies } = await getAdminSalesQuotes();
  const cadCost = (await getSettingValue("cad_cost_per_quote")) ?? 0;
  const livePricing = await resolveMetalPricing();

  return (
    <InternalAdminShell
      title="Sales Dashboard"
      description="Create and assign quotes for your tenants directly from this dashboard."
      navItems={getInternalAdminNav("/admin/sales", context.user.adminRole as any)}
      adminName={context.user.name || context.user.email}
    >
      <AdminSalesQuotingContainer 
        companies={companies as any} 
        cadCost={cadCost} 
        livePricing={livePricing} 
      />
    </InternalAdminShell>
  );
}