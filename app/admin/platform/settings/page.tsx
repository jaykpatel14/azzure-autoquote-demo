import Link from "next/link";
import { redirect } from "next/navigation";
import InternalAdminShell from "@/components/internal-admin-shell";
import { getInternalAdminContext } from "@/lib/internal-admin";
import { getInternalAdminNav, requireAdminRouteAccess } from "@/lib/internal-admin-nav";
import { getAdminPlatformSettings } from "@/src/services/admin-platform";
import { getSettingHelpText, getSettingLabel } from "@/lib/app-settings";
import { DEFAULT_PRICING_PROFILE } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function AdminPlatformSettingsPage() {
  const context = await getInternalAdminContext();
  if (!context) {
    redirect("/signin");
  }

  requireAdminRouteAccess("/admin/platform/settings", context.user.adminRole );

  const data = await getAdminPlatformSettings();
  const masterPricingSettings = data.publicSettings.filter((setting) => setting.key.startsWith("master_") || setting.key === "cad_cost_per_quote");
  const runtimeSettings = data.publicSettings.filter((setting) => !setting.key.startsWith("master_") && setting.key !== "cad_cost_per_quote");
  const masterDefaults: Record<string, number> = {
    master_gold_per_oz: DEFAULT_PRICING_PROFILE.goldSpotPerOz,
    master_platinum_per_oz: DEFAULT_PRICING_PROFILE.platinumSpotPerOz,
    master_platinum_labor_pct: DEFAULT_PRICING_PROFILE.platinumLaborPct,
    master_silver_per_oz: DEFAULT_PRICING_PROFILE.silverSpotPerOz,
    master_gold_wastage_pct: DEFAULT_PRICING_PROFILE.goldWastagePct,
    master_center_diamond_per_ct: DEFAULT_PRICING_PROFILE.standardCenterDiamondPerCarat,
    master_fancy_center_diamond_per_ct: DEFAULT_PRICING_PROFILE.fancyCenterDiamondPerCarat,
    master_round_side_diamond_per_ct: DEFAULT_PRICING_PROFILE.roundSideDiamondPerCarat,
    master_fancy_side_diamond_per_ct: DEFAULT_PRICING_PROFILE.fancySideDiamondPerCarat,
    master_gemstone_per_ct: DEFAULT_PRICING_PROFILE.gemstonePerCarat,
    master_center_setting_per_ct: DEFAULT_PRICING_PROFILE.centerSettingPerCarat,
    master_round_side_setting_per_stone: DEFAULT_PRICING_PROFILE.roundSideSettingPerStone,
    master_fancy_side_setting_per_stone: DEFAULT_PRICING_PROFILE.fancySideSettingPerStone,
    master_wax_per_piece: DEFAULT_PRICING_PROFILE.waxPerPiece,
    master_polishing_per_piece: DEFAULT_PRICING_PROFILE.polishingPerPiece,
    cad_cost_per_quote: 20
  };

  return (
    <InternalAdminShell
      title="Platform settings"
      description="Manage runtime configuration and secret-backed environment overrides from one place."
      navItems={getInternalAdminNav("/admin/platform/settings", context.user.adminRole )}
      adminName={context.user.name || context.user.email}
      actions={
        <Link className="button secondary" href="/admin/platform/api-keys">
          API keys
        </Link>
      }
    >
      <section className="statGrid">
        <article className="statCard statCard--admin">
          <span className="eyebrow">Public settings</span>
          <strong>{data.publicSettings.length}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Database-backed</span>
          <strong>{data.publicSettings.filter((setting) => setting.source === "database").length}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Environment fallback</span>
          <strong>{data.publicSettings.filter((setting) => setting.source === "env").length}</strong>
        </article>
        <article className="statCard statCard--admin">
          <span className="eyebrow">Secret keys</span>
          <strong>
            <Link href="/admin/platform/api-keys" style={{ color: "inherit" }}>
              {data.secretSettings.length}
            </Link>
          </strong>
        </article>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow">Master tab</span>
            <h2>Master Pricing</h2>
            <p className="muted">Platform-wide metal, diamond, setting, and manufacturing labor prices. Saved values feed new quote calculations immediately.</p>
          </div>
        </div>
        <div className="stack">
          {masterPricingSettings.map((setting) => (
            <form key={setting.key} className="planCard" action="/api/admin/settings" method="post">
              <input type="hidden" name="key" value={setting.key} />
              <input type="hidden" name="redirectTo" value="/admin/platform/settings" />
              <div style={{ flex: 1 }}>
                <p className="planName">{getSettingLabel(setting.key)}</p>
                <p className="muted small">{getSettingHelpText(setting.key)}</p>
              </div>
              <input type="number" min="0" step="0.01" name="value" defaultValue={setting.value || masterDefaults[setting.key]} />
              <button className="button primary" type="submit">Save</button>
            </form>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="sectionHeader">
          <div>
            <h2>Runtime overrides</h2>
            <p className="muted">
              Blank a field to remove the database value and fall back to the environment default. Secret values
              (API keys, webhook secrets) live on the dedicated <Link href="/admin/platform/api-keys">API keys</Link> page.
            </p>
          </div>
        </div>
        <div className="stack">
          {runtimeSettings.map((setting) => (
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
