import Link from "next/link";
import { redirect } from "next/navigation";
import SettingsTabs from "@/components/settings-tabs";
import WorkspaceShell from "@/components/workspace-shell";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import { getSettingsProfileData } from "@/src/services/settings";

export default async function BrandingSettingsPage() {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  const data = await getSettingsProfileData(context.company.id, context.user.id);
  if (!data.company) {
    redirect("/settings");
  }

  const isEnterprise = context.company.subscription?.plan.code === "enterprise";

  return (
    <WorkspaceShell
      title="Company & branding"
      description="Control the company details that flow into quote previews and customer-facing links."
      navItems={getWorkspaceNav("/settings")}
      actions={
        <Link className="button secondary" href="/settings">
          Back to billing
        </Link>
      }
    >
      <SettingsTabs activeHref="/settings/branding" />

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Brand identity</h2>
            <p className="muted">Changes here affect future quote pages and customer links.</p>
          </div>
        </div>
        <form className="stack" action="/api/settings/branding" method="post">
          <label className="field">
            <span>Company name</span>
            <input name="companyName" defaultValue={data.company.name} />
          </label>
          <label className="field">
            <span>About us</span>
            <textarea
              name="aboutUs"
              rows={3}
              maxLength={300}
              defaultValue={data.company.aboutUs ?? ""}
              placeholder="A short description of your shop."
            />
          </label>
          <label className="field">
            <span>Website URL</span>
            <input name="websiteUrl" defaultValue={data.company.websiteUrl ?? ""} placeholder="https://..." />
          </label>
          <label className="field">
            <span>Logo URL</span>
            <input
              name="logoUrl"
              defaultValue={data.company.logoUrl ?? ""}
              placeholder={isEnterprise ? "https://..." : "Enterprise only"}
              disabled={!isEnterprise}
            />
          </label>
          {!isEnterprise ? (
            <p className="muted small">Upload your logo on the Enterprise plan. The website URL remains editable on all plans.</p>
          ) : null}
          <div className="card logoPreviewCard" style={{ background: "var(--color-ivory)" }}>
            <p className="eyebrow" style={{ color: "rgba(28,28,30,0.58)" }}>
              Quote preview
            </p>
            {data.company.logoUrl ? (
              <img className="companyLogoPreview" src={data.company.logoUrl} alt={data.company.name} />
            ) : (
              <strong style={{ color: "var(--color-obsidian)" }}>{data.company.name}</strong>
            )}
          </div>
          <button className="button primary" type="submit" style={{ width: "fit-content" }}>
            Save branding
          </button>
        </form>
      </section>
    </WorkspaceShell>
  );
}
