import Link from "next/link";
import { redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav } from "@/lib/internal-admin-nav";

export const dynamic = "force-dynamic";

export default async function AdminCreateCompanyPage() {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  return (
    <InternalAdminShell
      title="Create company"
      description="Provision a new customer tenant and seed its first user from the internal admin console."
      navItems={getInternalAdminNav("/admin/companies")}
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

          <p className="disclaimer">
            If the email already exists, the system will reuse that account and only add the
            company membership. When creating a brand new user, a password is required.
          </p>

          <div className="heroActions">
            <button className="button primary" type="submit">
              Create company
            </button>
          </div>
        </form>
      </section>
    </InternalAdminShell>
  );
}
