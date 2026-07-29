import Link from "next/link";
import { redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminNav } from "@/lib/internal-admin-nav";
import { getInternalAdminContext } from "@/lib/internal-admin";
import {
  ADMIN_SETTING_KEYS,
  getSettingHelpText,
  getSettingLabel,
  listRuntimeSettings
} from "@/lib/app-settings";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  const settings = await listRuntimeSettings();

  return (
    <InternalAdminShell
      title="System settings"
      description="Rotate shared provider keys and runtime defaults from one place. Secret values are encrypted before storage."
      navItems={getInternalAdminNav("/admin/settings")}
      actions={
        <Link className="button secondary" href="/admin/billing">
          Billing
        </Link>
      }
    >
      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Runtime settings</h2>
            <p className="muted">
              Values saved here override environment defaults without a redeploy.
            </p>
          </div>
        </div>
        <div className="stack">
          {settings.map((setting) => (
            <form key={setting.key} className="planCard" action="/api/admin/settings" method="post">
              <input type="hidden" name="key" value={setting.key} />
              <input type="hidden" name="redirectTo" value="/admin/settings" />
              <div style={{ flex: 1 }}>
                <p className="planName">{getSettingLabel(setting.key)}</p>
                <p className="muted small">{getSettingHelpText(setting.key)}</p>
                <p className="muted small">
                  Current: {setting.maskedValue} | Source: {setting.source}
                </p>
              </div>
              <input
                type={setting.secret ? "password" : "text"}
                name="value"
                placeholder={setting.secret ? "Enter new secret value" : setting.value || "Not set"}
                defaultValue={setting.secret ? "" : setting.value}
              />
              <button className="button primary" type="submit">
                Save
              </button>
            </form>
          ))}
        </div>
        <p className="disclaimer">
          <code>{ADMIN_SETTING_KEYS.join(", ")}</code> are the only values editable from this console.
          <code>APP_SETTINGS_ENCRYPTION_KEY</code> must be configured in production to encrypt secret
          values.
        </p>
      </section>
    </InternalAdminShell>
  );
}
