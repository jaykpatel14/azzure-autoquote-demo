import Link from "next/link";
import { redirect } from "next/navigation";
import SettingsTabs from "@/components/settings-tabs";
import WorkspaceShell from "@/components/workspace-shell";
import LogoDropzone from "@/components/LogoDropzone";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import { getSettingsProfileData } from "@/src/services/settings";
import { getFeaturesForPlan, resolvePlanId } from "@/src/stripe/plans";

export default async function BrandingSettingsPage({
  searchParams
}: {
  searchParams: Promise<{ updated?: string; error?: string }>;
}) {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  const { updated, error } = await searchParams;
  const data = await getSettingsProfileData(context.company.id, context.user.id);
  if (!data.company) {
    redirect("/settings");
  }

  const subscription = context.company.subscription;
  const canUseLogo = Boolean(subscription && getFeaturesForPlan(resolvePlanId(subscription.plan, subscription.status)).pdfBranding !== "azzure_watermark");

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

      {updated ? (
        <div style={{ background: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: 12, padding: "14px 18px", color: "#10b981", fontWeight: 600, display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>check_circle</span>
          Branding details saved successfully.
        </div>
      ) : null}

      {error ? (
        <div style={{ background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.3)", borderRadius: 12, padding: "14px 18px", color: "#ef4444", fontWeight: 600, display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 22 }}>error</span>
          {error}
        </div>
      ) : null}

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Brand identity</h2>
            <p className="muted">Changes here affect future quote pages and customer links.</p>
          </div>
        </div>
        <form className="stack" action="/api/settings/branding" method="post" encType="multipart/form-data">
          <label className="field">
            <span>Company name</span>
            <input name="companyName" defaultValue={data.company.name} required />
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
            <span>Primary brand color</span>
            <div className="buttonRow">
              <input type="color" name="primaryColor" defaultValue={data.company.primaryColor ?? "#c9a84c"} style={{ width: 72, minHeight: 48, padding: 4 }} />
              <span className="muted small">Used for buttons and accents in Showroom Mode.</span>
            </div>
          </label>

          <LogoDropzone
            initialLogoUrl={data.company.logoUrl}
            companyName={data.company.name}
            canUseLogo={canUseLogo}
            initialShowroomBackgroundColor={data.company.showroomBackgroundColor}
            initialShowroomBackgroundMediaType={data.company.showroomBackgroundMediaType}
            initialShowroomMarketingImagesCount={Array.isArray(data.company.showroomMarketingImages) ? data.company.showroomMarketingImages.length : 0}
          />

          <button className="button primary button--lg" type="submit" style={{ width: "fit-content", marginTop: "var(--space-3)" }}>
            Save Branding Details
          </button>
        </form>
      </section>
    </WorkspaceShell>
  );
}
