import Link from "next/link";
import { redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav } from "@/lib/internal-admin-nav";
import { getAdminPlatformSettings } from "@/src/services/admin-platform";
import { getSettingHelpText, getSettingLabel } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

export default async function AdminPlatformSettingsPage() {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  const data = await getAdminPlatformSettings();

  return (
    <InternalAdminShell
      title="Platform settings"
      description="Manage runtime configuration and secret-backed environment overrides from one place."
      navItems={getInternalAdminNav("/admin/platform/settings")}
      adminName={context.user.name || context.user.email}
      actions={
        <Link className="button secondary" href="/admin/platform/api-keys">
          API keys
        </Link>
      }
    >
      <section className="statGrid">
        <article className="statCard statCard--admin">
          <span className="eyebrow">Editable keys</span>
          <strong>{data.editableKeys.length}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Public settings</span>
          <strong>{data.publicSettings.length}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Secret settings</span>
          <strong>{data.secretSettings.length}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Database-backed</span>
          <strong>{data.settings.filter((setting) => setting.source === "database").length}</strong>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Runtime overrides</h2>
            <p className="muted">
              Blank a field to remove the database value and fall back to the environment default.
            </p>
          </div>
        </div>
        <div className="stack">
          {data.settings.map((setting) => (
            <form key={setting.key} className="planCard" action="/api/admin/settings" method="post">
              <input type="hidden" name="key" value={setting.key} />
              <input type="hidden" name="redirectTo" value="/admin/platform/settings" />
              <div style={{ flex: 1 }}>
                <p className="planName">{getSettingLabel(setting.key)}</p>
                <p className="muted small">{getSettingHelpText(setting.key)}</p>
                <p className="muted small">
                  Current: {setting.maskedValue} · Source: {setting.source}
                </p>
              </div>
              <input
                type={setting.secret ? "password" : "text"}
                name="value"
                placeholder={setting.secret ? "Enter new secret value" : "Enter value"}
                defaultValue={setting.secret ? "" : setting.value}
              />
              <button className="button primary" type="submit">
                Save
              </button>
            </form>
          ))}
        </div>
      </section>
    </InternalAdminShell>
  );
}
