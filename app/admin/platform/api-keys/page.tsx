import Link from "next/link";
import { redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav, requireAdminRouteAccess } from "@/lib/internal-admin-nav";
import { getAdminPlatformSettings } from "@/src/services/admin-platform";

export const dynamic = "force-dynamic";

export default async function AdminApiKeysPage() {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  requireAdminRouteAccess("/admin/platform/api-keys", context.user.adminRole as any);

  const data = await getAdminPlatformSettings();

  return (
    <InternalAdminShell
      title="API key management"
      description="Rotate secrets and verify which platform keys are currently stored in the runtime settings table."
      navItems={getInternalAdminNav("/admin/platform/api-keys", context.user.adminRole as any)}
      adminName={context.user.name || context.user.email}
      actions={
        <Link className="button secondary" href="/admin/platform/settings">
          All settings
        </Link>
      }
    >
      <section className="statGrid">
        <article className="statCard statCard--admin">
          <span className="eyebrow">Secret values</span>
          <strong>{data.secretSettings.length}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Configured keys</span>
          <strong>{data.secretSettings.filter((setting) => setting.source === "database").length}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Env fallback</span>
          <strong>{data.secretSettings.filter((setting) => setting.source === "env").length}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Defaults</span>
          <strong>{data.secretSettings.filter((setting) => setting.source === "default").length}</strong>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Secrets</h2>
            <p className="muted">Leave a field blank to remove the database override and fall back to environment values.</p>
          </div>
        </div>
        <div className="stack">
          {data.secretSettings.map((setting) => (
            <form key={setting.key} className="planCard" action="/api/admin/settings" method="post">
              <input type="hidden" name="key" value={setting.key} />
              <input type="hidden" name="redirectTo" value="/admin/platform/api-keys" />
              <div style={{ flex: 1 }}>
                <p className="planName">{setting.key}</p>
                <p className="muted small">Current: {setting.maskedValue}</p>
                <p className="muted small">Source: {setting.source}</p>
              </div>
              <input type="password" name="value" placeholder="Enter new secret value" />
              <button className="button primary" type="submit">
                Rotate
              </button>
            </form>
          ))}
        </div>
      </section>
    </InternalAdminShell>
  );
}
