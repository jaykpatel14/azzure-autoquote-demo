import Link from "next/link";
import { redirect } from "next/navigation";
import SettingsTabs from "@/components/settings-tabs";
import WorkspaceShell from "@/components/workspace-shell";
import KioskPinForm from "@/components/kiosk-pin-form";
import { getAuthenticatedCompanyContext } from "@/lib/company";
import { getWorkspaceNav } from "@/lib/workspace-nav";
import { getSettingsProfileData } from "@/src/services/settings";

export default async function ProfileSettingsPage() {
  const context = await getAuthenticatedCompanyContext();
  if (!context) {
    redirect("/signin");
  }

  const data = await getSettingsProfileData(context.company.id, context.user.id);
  if (!data.user || !data.company) {
    redirect("/settings");
  }

  return (
    <WorkspaceShell
      title="Profile settings"
      description="Update your personal profile, avatar, and password."
      navItems={getWorkspaceNav("/settings")}
      actions={
        <Link className="button secondary" href="/settings">
          Back to billing
        </Link>
      }
    >
      <SettingsTabs activeHref="/settings/profile" />

      <section className="grid twoUp">
        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Personal profile</h2>
              <p className="muted">Changing email requires support, so it stays read-only here.</p>
            </div>
          </div>
          <form className="stack" action="/api/settings/profile" method="post">
            <label className="field">
              <span>Name</span>
              <input name="name" defaultValue={data.user.name ?? ""} />
            </label>
            <label className="field">
              <span>Email</span>
              <input defaultValue={data.user.email} readOnly />
            </label>
            <label className="field">
              <span>Avatar URL</span>
              <input
                name="avatarUrl"
                defaultValue={data.user.avatarUrl ?? ""}
                placeholder="https://..."
              />
            </label>
            <p className="muted small">Avatar images are stored outside the form for now, but the profile record is ready for an S3 upload flow.</p>
            <button className="button primary" type="submit" style={{ width: "fit-content" }}>
              Save profile
            </button>
          </form>
        </article>

        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Password change</h2>
              <p className="muted">Use your current password to set a new one.</p>
            </div>
          </div>
          <form className="stack" action="/api/settings/profile" method="post">
            <label className="field">
              <span>Current password</span>
              <input name="currentPassword" type="password" minLength={8} />
            </label>
            <label className="field">
              <span>New password</span>
              <input name="newPassword" type="password" minLength={8} />
            </label>
            <label className="field">
              <span>Confirm new password</span>
              <input name="confirmPassword" type="password" minLength={8} />
            </label>
            <button className="button primary" type="submit" style={{ width: "fit-content" }}>
              Update password
            </button>
          </form>
        </article>

        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Kiosk Staff PIN</h2>
              <p className="muted">Set a personal 4-digit PIN to access quote lookup mode on in-store showroom screens.</p>
            </div>
          </div>
          <KioskPinForm hasPin={Boolean(data.user.kioskPinHash)} />
        </article>

        <article className="card">
          <div className="sectionHeader">
            <div>
              <h2>Using Staff Mode</h2>
              <p className="muted">How associates access customer quotes in-store.</p>
            </div>
          </div>
          <div className="stack" style={{ gap: 12, color: "var(--color-on-surface-variant)", fontSize: "0.875rem", lineHeight: 1.5 }}>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--color-on-surface)" }}>1. Staff Access Button:</strong> On your showroom kiosk welcome screen, tap the discreet <em>Staff Access</em> link.
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--color-on-surface)" }}>2. Enter Your 4-Digit PIN:</strong> Tap your personal PIN on the touch numpad to unlock the sales lookup view.
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--color-on-surface)" }}>3. Fast Quote Lookup:</strong> Search any code (e.g. <code>QT-4821</code>) to view customer designs, specs, and selling prices. Making costs and margins remain strictly protected.
            </p>
            <p style={{ margin: 0 }}>
              <strong style={{ color: "var(--color-on-surface)" }}>4. Auto-Lock Protection:</strong> The kiosk automatically locks and returns to the customer welcome screen after 90 seconds of inactivity.
            </p>
          </div>
        </article>
      </section>
    </WorkspaceShell>
  );
}
