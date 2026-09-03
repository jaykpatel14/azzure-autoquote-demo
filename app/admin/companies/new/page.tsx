import Link from "next/link";
import { redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav, requireAdminRouteAccess } from "@/lib/internal-admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminCreateCompanyPage() {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  requireAdminRouteAccess("/admin/companies", context.user.adminRole );

  return (
    <InternalAdminShell
      title="Create company"
      description="Provision a new customer tenant and seed its first user from the internal admin console."
      navItems={getInternalAdminNav("/admin/companies", context.user.adminRole )}
      adminName={context.user.name || context.user.email}
      actions={
        <Link className="button secondary" href="/admin/companies">
          Back to companies
        </Link>
      }
    >
      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>New customer tenant</h2>
            <p className="muted">
              This creates the company, its default pricing profile, and the first team member.
            </p>
          </div>
        </div>

        <form className="stack" action="/api/admin/companies" method="post">
          <input type="hidden" name="redirectTo" value="/admin/companies" />

          <div className="grid twoUp">
            <label className="field">
              <span>Company name</span>
              <input name="companyName" placeholder="Acme Jewelry" required />
            </label>
            <label className="field">
              <span>Company slug</span>
              <input
                name="companySlug"
                placeholder="acme-jewelry"
                title="Optional. Leave blank to auto-generate."
              />
            </label>
          </div>

          <div className="grid twoUp">
            <label className="field">
              <span>First user name</span>
              <input name="memberName" placeholder="Azzure Owner" />
            </label>
            <label className="field">
              <span>First user email</span>
              <input name="memberEmail" type="email" placeholder="owner@acme.com" required />
            </label>
          </div>

          <label className="field">
            <span>First user password</span>
            <input
              name="memberPassword"
              type="password"
              placeholder="Set an initial password"
              minLength={8}
            />
          </label>

          <div className="grid twoUp">
            <label className="field">
              <span>Pricing tier</span>
              <select name="pricingTier" defaultValue="TIER_2" required>
                <option value="TIER_1">Tier 1 - Premium (divide by 0.6)</option>
                <option value="TIER_2">Tier 2 - Standard (divide by 0.7)</option>
                <option value="TIER_3">Tier 3 - Basic (divide by 0.8)</option>
              </select>
            </label>

            <label className="field">
              <span>Operating &amp; display currency</span>
              <select name="currency" defaultValue="USD" required>
                <option value="USD">USD ($) - United States Dollar</option>
                <option value="CAD">CAD (CA$) - Canadian Dollar</option>
              </select>
            </label>
          </div>

          <div className="grid twoUp">
            <label className="field">
              <span>Subscription plan</span>
              <select name="planCode" defaultValue="starter" required>
                <option value="starter">Starter Plan (300 quotes/mo)</option>
                <option value="professional">Professional Plan (1,200 quotes/mo)</option>
                <option value="enterprise">Enterprise Plan (2,500 quotes/mo)</option>
              </select>
            </label>

            <label className="field">
              <span>Account status</span>
              <select name="accountStatus" defaultValue="APPROVED" required>
                <option value="APPROVED">Approved &amp; Active</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </label>
          </div>

          <div className="grid twoUp">
            <label className="field">
              <span>Subscription billing status</span>
              <select name="subscriptionStatus" defaultValue="ACTIVE" required>
                <option value="ACTIVE">Active (Standard)</option>
                <option value="TRIALING">Trialing (14-day trial)</option>
              </select>
            </label>
          </div>

          <p className="disclaimer">
            If the email already exists, the system will reuse that account and add the
            company membership. When creating a brand new user, an initial password is required.
          </p>

          <div className="heroActions">
            <button className="button primary" type="submit">
              Create &amp; Provision Tenant
            </button>
          </div>
        </form>
      </section>
    </InternalAdminShell>
  );
}
